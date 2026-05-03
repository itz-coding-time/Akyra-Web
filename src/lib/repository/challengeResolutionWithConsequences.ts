import { supabase } from '../supabase'
import type { Database } from "../../types/database.types"
import type { PullEventSummary } from "../../types/pullWorkflow.types"
import type { StoreConfigAssociate, StoreConfigTask, StoreConfigInventoryItem, StoreConfigTableItem, StoreConfig } from "../../types/storeConfig.types"
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser"
import { logPoints } from "./pointsEngine"
import { trackChallengePattern } from "./challengePatternTracking"
import { checkAndApplyDesync } from "./desyncCheck"

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

// â”€â”€ Challenge Resolution with Consequences â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function resolveChallenge(
  verificationId: string,
  storeManagerProfileId: string,
  verdict: "complete" | "incomplete"
): Promise<boolean> {
  const { data: v } = await supabase
    .from("task_verifications")
    .select(`
      *,
      tasks!task_id(task_name, store_id, base_points, archetype),
      associates!associate_id(id, name, store_id),
      associates!supervisor_id(id, name)
    `)
    .eq("id", verificationId)
    .maybeSingle()

  if (!v) return false

  const task = (v as any).tasks
  const associate = (v as any).associates
  const supervisor = (v as any).supervisor
  const storeId = task?.store_id ?? associate?.store_id

  const newStatus = verdict === "complete" ? "resolved_accepted" : "resolved_retry"
  const { error } = await supabase
    .from("task_verifications")
    .update({
      store_manager_id: storeManagerProfileId,
      store_manager_verdict: verdict,
      challenge_resolved: true,
      resolved_at: new Date().toISOString(),
      status: newStatus,
    })
    .eq("id", verificationId)

  if (error) return false

  if (verdict === "complete") {
    await supabase
      .from("tasks")
      .update({ is_completed: true, pending_verification: false })
      .eq("id", v.task_id)

    if (storeId && v.associate_id) {
      await logPoints(storeId, v.associate_id, 25, "challenge_vindicated", v.task_id)
    }

    if (storeId && supervisor?.id) {
      await trackChallengePattern({
        storeId,
        taskId: v.task_id,
        taskName: task?.task_name ?? "Unknown",
        associateId: v.associate_id,
        associateName: associate?.name ?? "Unknown",
        supervisorId: supervisor.id,
        supervisorName: supervisor.name,
        patternType: "supervisor_task",
      })

      await trackChallengePattern({
        storeId,
        taskId: v.task_id,
        taskName: task?.task_name ?? "Unknown",
        associateId: v.associate_id,
        associateName: associate?.name ?? "Unknown",
        supervisorId: supervisor.id,
        supervisorName: supervisor.name,
        patternType: "associate_supervisor",
      })

      await (supabase as any).from("pings").insert({
        store_id: storeId,
        from_associate_id: v.associate_id,
        to_associate_id: supervisor.id,
        message: `Store Manager ruled "${task?.task_name}" was completed. Your rejection was overturned.`,
        ping_type: "direct",
      })
    }
  } else {
    await (supabase as any)
      .from("tasks")
      .update({
        pending_verification: false,
        is_completed: false,
        started_at: null,
        completed_at: null,
      })
      .eq("id", v.task_id)

    if (storeId) {
      await trackChallengePattern({
        storeId,
        taskId: v.task_id,
        taskName: task?.task_name ?? "Unknown",
        associateId: v.associate_id,
        associateName: associate?.name ?? "Unknown",
        supervisorId: supervisor?.id ?? null,
        supervisorName: supervisor?.name ?? null,
        patternType: "associate_task",
      })

      await checkAndApplyDesync(storeId, v.associate_id, associate?.name ?? "Unknown")

      await (supabase as any).from("pings").insert({
        store_id: storeId,
        from_associate_id: storeManagerProfileId,
        to_associate_id: v.associate_id,
        message: `Store Manager reviewed "${task?.task_name}" â€” please complete it properly and try again.`,
        ping_type: "direct",
      })
    }
  }

  return true
}

export async function fetchChallengePatterns(storeId: string): Promise<Array<{
  id: string
  patternType: string
  taskName: string
  associateName: string
  supervisorName: string | null
  challengeCount: number
  flagLevel: string
  windowEnd: string
}>> {
  const { data, error } = await (supabase as any)
    .from("challenge_patterns")
    .select("*")
    .eq("store_id", storeId)
    .eq("is_resolved", false)
    .gt("window_end", new Date().toISOString().split("T")[0])
    .order("challenge_count", { ascending: false })

  if (error || !data) return []

  return data.map((p: any) => ({
    id: p.id,
    patternType: p.pattern_type,
    taskName: p.task_name,
    associateName: p.associate_name,
    supervisorName: p.supervisor_name,
    challengeCount: p.challenge_count,
    flagLevel: p.flag_level,
    windowEnd: p.window_end,
  }))
}

export async function resolveChallengePattern(
  patternId: string,
  resolvedById: string,
  notes: string
): Promise<boolean> {
  const { error } = await (supabase as any)
    .from("challenge_patterns")
    .update({
      is_resolved: true,
      resolved_by: resolvedById,
      resolved_at: new Date().toISOString(),
      resolution_notes: notes,
    })
    .eq("id", patternId)

  return !error
}

export async function logSlowCompletionReason(
  storeId: string,
  taskId: string,
  associateId: string,
  reasonCategory: string,
  reasonNotes: string | null,
  actualMinutes: number,
  expectedMinutes: number
): Promise<boolean> {
  const { error } = await supabase
    .from("slow_completion_reasons")
    .insert({
      store_id: storeId,
      task_id: taskId,
      associate_id: associateId,
      reason_category: reasonCategory,
      reason_notes: reasonNotes,
      actual_minutes: actualMinutes,
      expected_minutes: expectedMinutes,
    })

  return !error
}

export async function fetchTimeSuggestions(storeId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("task_time_suggestions")
    .select("*, tasks!task_id(task_name, expected_minutes)")
    .eq("store_id", storeId)
    .eq("is_reviewed", false)
    .order("created_at", { ascending: false })

  if (error) return []
  return data ?? []
}

export async function reviewTimeSuggestion(
  suggestionId: string,
  reviewedById: string,
  apply: boolean,
  taskId?: string,
  newMinutes?: number
): Promise<boolean> {
  if (apply && taskId && newMinutes) {
    await supabase
      .from("tasks")
      .update({ expected_minutes: newMinutes })
      .eq("id", taskId)
  }

  const { error } = await supabase
    .from("task_time_suggestions")
    .update({
      is_reviewed: true,
      reviewed_by: reviewedById,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", suggestionId)

  return !error
}





