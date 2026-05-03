import { supabase } from '../supabase'
import type { Database } from "../../types/database.types"
import type { PullEventSummary } from "../../types/pullWorkflow.types"
import type { StoreConfigAssociate, StoreConfigTask, StoreConfigInventoryItem, StoreConfigTableItem, StoreConfig } from "../../types/storeConfig.types"
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

// â”€â”€ Task Lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Check if a task lockout is currently active for a store and shift bucket.
 */
export async function checkLockoutActive(
  storeId: string,
  shiftBucket: string
): Promise<boolean> {
  const { data } = await supabase
    .from("task_lockout_windows")
    .select("lockout_start, lockout_end, is_active")
    .eq("store_id", storeId)
    .eq("shift_bucket", shiftBucket)
    .eq("is_active", true)
    .maybeSingle()

  if (!data) return false

  const now = new Date()
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`

  return currentTime >= data.lockout_start && currentTime < data.lockout_end
}

/**
 * Override lockout for this session (supervisor only).
 */
export async function overrideLockout(
  storeId: string,
  shiftBucket: string
): Promise<boolean> {
  const { error } = await supabase
    .from("task_lockout_windows")
    .update({ is_active: false })
    .eq("store_id", storeId)
    .eq("shift_bucket", shiftBucket)

  return !error
}

/**
 * Restore lockout after supervisor override.
 */
export async function restoreLockout(
  storeId: string,
  shiftBucket: string
): Promise<boolean> {
  const { error } = await supabase
    .from("task_lockout_windows")
    .update({ is_active: true })
    .eq("store_id", storeId)
    .eq("shift_bucket", shiftBucket)

  return !error
}

/**
 * Mark a task as partially complete with progress notes.
 * Called during extraction when an associate can't finish.
 */
export async function markTaskPartial(
  taskId: string,
  progressPct: number,
  progressNotes: string,
  associateName: string
): Promise<boolean> {
  const { error } = await supabase
    .from("tasks")
    .update({
      lifecycle_state: "partial",
      progress_pct: progressPct,
      progress_notes: progressNotes,
      last_progress_by: associateName,
      last_progress_at: new Date().toISOString(),
      is_completed: false,
      pending_verification: false,
    })
    .eq("id", taskId)

  return !error
}

/**
 * Fetch tasks for an associate filtered by their shift bucket.
 * Shows: tasks for their bucket + 'any' tasks + inherited cross-shift-critical tasks.
 * Excludes completed tasks from other buckets.
 */
export async function fetchTasksForShift(
  storeId: string,
  shiftBucket: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("store_id", storeId)
    .eq("is_completed", false)
    .or(`shift_bucket.eq.${shiftBucket},shift_bucket.eq.any,shift_bucket.is.null`)
    .not("lifecycle_state", "eq", "completed")
    .order("neglect_count", { ascending: false }) // neglected first
    .order("queue_position", { ascending: true })

  if (error || !data) return []
  return data
}

function getNextBucket(
  bucket: "6a-2p" | "2p-10p" | "10p-6a"
): "6a-2p" | "2p-10p" | "10p-6a" {
  const order: Array<"6a-2p" | "2p-10p" | "10p-6a"> = ["6a-2p", "2p-10p", "10p-6a"]
  const idx = order.indexOf(bucket)
  return order[(idx + 1) % 3]
}

/**
 * The Neglect Engine.
 * Run at the end of each shift bucket.
 * Escalates unfinished tasks through the lifecycle states.
 */
export async function runNeglectEngine(
  storeId: string,
  endingBucket: "6a-2p" | "2p-10p" | "10p-6a"
): Promise<void> {
  // Find all unfinished tasks for this shift bucket
  const { data: unfinished } = await supabase
    .from("tasks")
    .select("id, task_name, neglect_count, lifecycle_state, is_cross_shift_critical, progress_pct, progress_notes, last_progress_by, shift_bucket, last_neglected_at")
    .eq("store_id", storeId)
    .eq("is_completed", false)
    .eq("pending_verification", false)
    .or(`shift_bucket.eq.${endingBucket},shift_bucket.is.null`)
    .not("lifecycle_state", "in", '("completed","incident")')

  if (!unfinished) return

  const now = new Date().toISOString()

  for (const task of unfinished) {
    const newNeglectCount = task.neglect_count + 1

    // Determine new lifecycle state
    let newState: string
    if (newNeglectCount >= 4) newState = "incident"
    else if (newNeglectCount === 3) newState = "critical"
    else if (newNeglectCount === 2) newState = "neglected"
    else newState = "orphaned"

    // Update the task
    await supabase
      .from("tasks")
      .update({
        lifecycle_state: newState,
        neglect_count: newNeglectCount,
        last_neglected_at: now,
      })
      .eq("id", task.id)

    // Create incident record at 4+ neglects
    if (newNeglectCount >= 4) {
      const { data: existing } = await supabase
        .from("task_incidents")
        .select("id")
        .eq("task_id", task.id)
        .eq("is_resolved", false)
        .maybeSingle()

      if (!existing) {
        await supabase.from("task_incidents").insert({
          store_id: storeId,
          task_id: task.id,
          task_name: task.task_name,
          shift_bucket: endingBucket,
          neglect_count: newNeglectCount,
          first_neglected_at: task.last_neglected_at ?? now,
        })
      }
    }

    // Handle cross-shift-critical tasks â€” copy to next shift's queue
    if (task.is_cross_shift_critical && newState === "orphaned") {
      const nextBucket = getNextBucket(endingBucket)

      await supabase
        .from("tasks")
        .update({
          shift_bucket: nextBucket,
          inherited_from_bucket: endingBucket,
          inherited_from_associate: task.last_progress_by ?? "Previous shift",
          inherited_at: now,
          lifecycle_state: "active",
          neglect_count: newNeglectCount,
        })
      .eq("id", task.id)
    }
  }

  // Ping supervisor about neglected/critical tasks
  const neglected = unfinished.filter(t => t.neglect_count + 1 >= 2)
  if (neglected.length > 0) {
    const { data: supervisors } = await supabase
      .from("active_shifts")
      .select("associate_id")
      .eq("store_id", storeId)
      .eq("is_active", true)

    for (const sup of supervisors ?? []) {
      await supabase.from("pings").insert({
        store_id: storeId,
        from_associate_id: sup.associate_id,
        to_associate_id: sup.associate_id,
        message: `${neglected.length} task${neglected.length !== 1 ? "s" : ""} neglected from ${endingBucket} shift. Check the task queue.`,
        ping_type: "direct",
      })
    }
  }
}

/**
 * Fetch task incidents for Store Manager work order feed.
 */
export async function fetchTaskIncidents(storeId: string): Promise<Array<{
  id: string
  taskName: string
  shiftBucket: string
  neglectCount: number
  firstNeglectedAt: string
  isResolved: boolean
}>> {
  const { data, error } = await supabase
    .from("task_incidents")
    .select("*")
    .eq("store_id", storeId)
    .order("neglect_count", { ascending: false })

  if (error || !data) return []

  return data.map(i => ({
    id: i.id,
    taskName: i.task_name,
    shiftBucket: i.shift_bucket,
    neglectCount: i.neglect_count,
    firstNeglectedAt: i.first_neglected_at,
    isResolved: i.is_resolved,
  }))
}

export async function resolveTaskIncident(
  incidentId: string,
  resolvedById: string,
  notes: string
): Promise<boolean> {
  const { error } = await supabase
    .from("task_incidents")
    .update({
      is_resolved: true,
      resolved_by: resolvedById,
      resolved_at: new Date().toISOString(),
      resolution_notes: notes,
    })
    .eq("id", incidentId)

  return !error
}

export async function closeShift(
  associateId: string,
  storeId: string
): Promise<boolean> {
  // Get the shift bucket before closing
  const { data: shift } = await supabase
    .from("active_shifts")
    .select("shift_bucket")
    .eq("associate_id", associateId)
    .eq("store_id", storeId)
    .eq("is_active", true)
    .maybeSingle()

  // Close the shift
  const { error } = await supabase
    .from("active_shifts")
    .update({ is_active: false, expires_at: new Date().toISOString() })
    .eq("associate_id", associateId)
    .eq("store_id", storeId)

  if (error) return false

  // Check if this was the LAST active associate for this shift bucket
  if (shift?.shift_bucket) {
    const { count } = await supabase
      .from("active_shifts")
      .select("*", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("is_active", true)
      .eq("shift_bucket", shift.shift_bucket)

    // If no more active associates in this bucket, run neglect engine
    if ((count ?? 0) === 0) {
      await runNeglectEngine(storeId, shift.shift_bucket as "6a-2p" | "2p-10p" | "10p-6a")
    }
  }
  
  return true
}





