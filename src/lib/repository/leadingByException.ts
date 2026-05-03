import { supabase } from "./supabase"
import type { Database } from "../types/database.types"
import type { PullEventSummary } from "../types/pullWorkflow.types"
import type { StoreConfigAssociate, StoreConfigTask, StoreConfigInventoryItem, StoreConfigTableItem, StoreConfig } from "../types/storeConfig.types"
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser"

type Profile = Database["public"]["Tables"]["profiles"]["Row"]
type ActiveShift = Database["public"]["Tables"]["active_shifts"]["Row"]
type EquipmentIssue = Database["public"]["Tables"]["equipment_issues"]["Row"]
type License = Database["public"]["Tables"]["licenses"]["Row"]
type Organization = Database["public"]["Tables"]["organizations"]["Row"]
type Store = Database["public"]["Tables"]["stores"]["Row"]
type Associate = Database["public"]["Tables"]["associates"]["Row"]
type Task = Database["public"]["Tables"]["tasks"]["Row"]
type ScheduleEntry = Database["public"]["Tables"]["schedule_entries"]["Row"]
type TableItem = Database["public"]["Tables"]["table_items"]["Row"]
type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"]

// â”€â”€ Leading By Exception â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function startTaskTimer(taskId: string): Promise<boolean> {
  const { error } = await supabase
    .from("tasks")
    .update({ started_at: new Date().toISOString() })
    .eq("id", taskId)
    .is("started_at", null) // only set if not already started

  if (error) {
    console.error("startTaskTimer failed:", error.message)
    return false
  }
  return true
}

export async function calculateTaskDelta(
  taskId: string
): Promise<{ deltaPct: number; actualMinutes: number; expectedMinutes: number } | null> {
  const { data: task } = await supabase
    .from("tasks")
    .select("started_at, expected_minutes, task_name")
    .eq("id", taskId)
    .maybeSingle()

  if (!task?.started_at || !task?.expected_minutes) return null

  const startedAt = new Date(task.started_at)
  const now = new Date()
  const actualMinutes = Math.round((now.getTime() - startedAt.getTime()) / 60000)
  const expectedMinutes = task.expected_minutes
  const deltaPct = ((actualMinutes - expectedMinutes) / expectedMinutes) * 100

  return { deltaPct, actualMinutes, expectedMinutes }
}

export async function createTaskVerification(
  storeId: string,
  taskId: string,
  associateId: string,
  expectedMinutes: number,
  actualMinutes: number,
  deltaPct: number,
  triggerType: "fast" | "slow"
): Promise<string | null> {
  const { data, error } = await supabase
    .from("task_verifications")
    .insert({
      store_id: storeId,
      task_id: taskId,
      associate_id: associateId,
      expected_minutes: expectedMinutes,
      actual_minutes: actualMinutes,
      delta_pct: deltaPct,
      trigger_type: triggerType,
      status: triggerType === "fast" ? "pending_associate_photo" : "resolved_slow",
    })
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("createTaskVerification failed:", error.message)
    return null
  }
  return data?.id ?? null
}

export async function submitAssociatePhoto(
  verificationId: string,
  photoUrl: string
): Promise<boolean> {
  const { error } = await supabase
    .from("task_verifications")
    .update({
      associate_photo_url: photoUrl,
      status: "pending_supervisor",
    })
    .eq("id", verificationId)

  if (error) {
    console.error("submitAssociatePhoto failed:", error.message)
    return false
  }
  return true
}

export async function supervisorReviewVerification(
  verificationId: string,
  supervisorId: string,
  verdict: "accepted" | "rejected",
  photoUrl: string | null,
  rejectionReason?: string
): Promise<boolean> {
  type TVUpdate = Database["public"]["Tables"]["task_verifications"]["Update"]
  const update: TVUpdate = {
    supervisor_id: supervisorId,
    supervisor_verdict: verdict,
    supervisor_photo_url: photoUrl,
    status: verdict === "accepted" ? "resolved_accepted" : "pending_associate_response",
  }

  if (verdict === "rejected" && rejectionReason) {
    update.rejection_reason = rejectionReason
  }

  if (verdict === "accepted") {
    update.resolved_at = new Date().toISOString()
    // Generate time suggestion
    const { data: verification } = await supabase
      .from("task_verifications")
      .select("task_id, actual_minutes, expected_minutes, store_id")
      .eq("id", verificationId)
      .maybeSingle()

    if (verification) {
      const suggestedMinutes = Math.round(
        (verification.actual_minutes + verification.expected_minutes) / 2
      )
      await supabase.from("task_time_suggestions").upsert({
        store_id: verification.store_id,
        task_id: verification.task_id,
        task_name: "",
        current_expected_minutes: verification.expected_minutes,
        suggested_minutes: suggestedMinutes,
        avg_actual_minutes: verification.actual_minutes,
        sample_count: 1,
      }, { onConflict: "store_id,task_id,is_reviewed", ignoreDuplicates: false })
    }
  }

  const { error } = await supabase
    .from("task_verifications")
    .update(update)
    .eq("id", verificationId)

  return !error
}

export async function associateRespondToRejection(
  verificationId: string,
  response: "verify_retry" | "challenge"
): Promise<boolean> {
  type TVUpdate = Database["public"]["Tables"]["task_verifications"]["Update"]
  const update: TVUpdate = {
    associate_response: response,
    status: response === "verify_retry" ? "resolved_retry" : "pending_store_manager",
    challenge_submitted: response === "challenge",
  }

  if (response === "verify_retry") {
    update.resolved_at = new Date().toISOString()
    // Reopen the task
    const { data: v } = await supabase
      .from("task_verifications")
      .select("task_id")
      .eq("id", verificationId)
      .maybeSingle()
    if (v) {
      await supabase.from("tasks")
        .update({ pending_verification: false, completed_by: null, started_at: null })
        .eq("id", v.task_id)
    }
  }

  const { error } = await supabase
    .from("task_verifications")
    .update(update)
    .eq("id", verificationId)

  return !error
}

export async function fetchPendingVerificationsForSupervisor(
  storeId: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from("task_verifications")
    .select(`
      *,
      tasks!task_id(task_name),
      associates!associate_id(name)
    `)
    .eq("store_id", storeId)
    .eq("status", "pending_supervisor")
    .order("created_at", { ascending: false })

  if (error) return []
  return data ?? []
}

export async function fetchChallengedTasksForStoreManager(
  storeId: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from("task_verifications")
    .select(`
      *,
      tasks!task_id(task_name),
      associates!associate_id(name)
    `)
    .eq("store_id", storeId)
    .eq("challenge_submitted", true)
    .eq("challenge_resolved", false)
    .order("created_at", { ascending: false })

  if (error) return []
  return data ?? []
}

