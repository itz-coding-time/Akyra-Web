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

// â”€â”€ Tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchTasksForAssociate(
  storeId: string,
  archetype: string,
  associateName: string
): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("store_id", storeId)
    .eq("is_completed", false)
    .eq("is_orphaned", false)
    .or(`archetype.eq.${archetype},assigned_to.eq.${associateName}`)
    .order("priority", { ascending: false })

  if (error) {
    console.error("fetchTasksForAssociate failed:", error.message)
    return []
  }

  const allTasks = data ?? []

  // Fetch completed task IDs to check dependencies against
  const { data: completedData } = await supabase
    .from("tasks")
    .select("id")
    .eq("store_id", storeId)
    .eq("is_completed", true)

  const allCompletedIds = new Set([
    ...(completedData ?? []).map(t => t.id),
    ...allTasks
      .filter(t => t.pending_verification)
      .map(t => t.id),
  ])

  // Filter out tasks whose dependency hasn't been completed yet
  return allTasks.filter(task => {
    const depId = (task as any).depends_on_task_id
    if (!depId) return true
    return allCompletedIds.has(depId)
  })
}

export async function fetchTasksForSupervisor(storeId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("store_id", storeId)
    .eq("is_completed", false)
    .order("priority", { ascending: false })

  if (error) {
    console.error("fetchTasksForSupervisor failed:", error.message)
    return []
  }
  return data ?? []
}

/**
 * Escalation Engine â€” runs after expireStaleShifts
 * Finds tasks assigned to associates whose sessions just expired,
 * clears the assignee, bumps priority to Critical, sets is_orphaned = true
 */
export async function orphanTasksForExpiredSessions(
  storeId: string,
  expiredAssociateIds: string[]
): Promise<number> {
  if (expiredAssociateIds.length === 0) return 0

  // Get names of expired associates to match against assigned_to
  const { data: associates } = await supabase
    .from("associates")
    .select("name")
    .in("id", expiredAssociateIds)

  if (!associates || associates.length === 0) return 0

  const names = associates.map(a => a.name)

  // Find tasks assigned to these associates that are not yet complete
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, task_name, assigned_to")
    .eq("store_id", storeId)
    .eq("is_completed", false)
    .in("assigned_to", names)

  if (!tasks || tasks.length === 0) return 0

  const taskIds = tasks.map(t => t.id)

  // Orphan them: clear assignee, bump to Critical, set orphaned flag
  const { error } = await supabase
    .from("tasks")
    .update({
      assigned_to: null,
      priority: "Critical",
      is_orphaned: true,
      pending_verification: false,
    })
    .in("id", taskIds)

  if (error) {
    console.error("orphanTasksForExpiredSessions failed:", error.message)
    return 0
  }

  console.log(`Escalation Engine: ${tasks.length} task(s) orphaned from expired sessions`)
  tasks.forEach(t => console.log(`  â†‘ "${t.task_name}" (was assigned to ${t.assigned_to})`))

  return tasks.length
}

export async function fetchOrphanedTasks(storeId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("store_id", storeId)
    .eq("is_orphaned", true)
    .eq("is_completed", false)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("fetchOrphanedTasks failed:", error.message)
    return []
  }
  return data ?? []
}

export async function clearOrphanFlag(taskId: string): Promise<boolean> {
  const { error } = await supabase
    .from("tasks")
    .update({ is_orphaned: false })
    .eq("id", taskId)

  if (error) {
    console.error("clearOrphanFlag failed:", error.message)
    return false
  }
  return true
}

export async function fetchPendingVerificationTasks(storeId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("store_id", storeId)
    .eq("pending_verification", true)
    .eq("is_completed", false)

  if (error) {
    console.error("fetchPendingVerificationTasks failed:", error.message)
    return []
  }
  return data ?? []
}

export async function markTaskPendingVerification(
  taskId: string,
  completedBy: string
): Promise<boolean> {
  const { data: task } = await supabase
    .from("tasks")
    .select("store_id, base_points, assigned_to_associate_id")
    .eq("id", taskId)
    .maybeSingle()

  const { error } = await (supabase as any)
    .from("tasks")
    .update({ 
      pending_verification: true, 
      completed_by: completedBy,
      completed_at: new Date().toISOString()
    })
    .eq("id", taskId)

  if (error) {
    console.error("markTaskPendingVerification failed:", error.message)
    return false
  }

  if (task?.store_id && task?.assigned_to_associate_id) {
    await logPoints(
      task.store_id,
      task.assigned_to_associate_id,
      task.base_points ?? 10,
      "task_complete",
      taskId
    )
  }

  return true
}

export async function verifyTaskComplete(taskId: string): Promise<boolean> {
  const { data: task } = await supabase
    .from("tasks")
    .select("store_id, base_points, assigned_to_associate_id")
    .eq("id", taskId)
    .maybeSingle()

  const { error } = await (supabase as any)
    .from("tasks")
    .update({ 
      is_completed: true, 
      pending_verification: false,
      completed_at: new Date().toISOString()
    })
    .eq("id", taskId)

  if (error) {
    console.error("verifyTaskComplete failed:", error.message)
    return false
  }

  if (task?.store_id && task?.assigned_to_associate_id) {
    const points = Math.round((task.base_points ?? 10) * 1.5)
    await logPoints(
      task.store_id,
      task.assigned_to_associate_id,
      points,
      "task_verified",
      taskId
    )
  }

  return true
}

export async function rejectTaskCompletion(taskId: string): Promise<boolean> {
  const { error } = await supabase
    .from("tasks")
    .update({ pending_verification: false, completed_by: null })
    .eq("id", taskId)

  if (error) {
    console.error("rejectTaskCompletion failed:", error.message)
    return false
  }
  return true
}

