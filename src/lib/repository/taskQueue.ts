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

// â”€â”€ Task Queue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Fetch the next task in an associate's personal queue.
 * Returns the lowest queue_position task assigned to this associate.
 */
export async function fetchNextQueuedTask(
  storeId: string,
  associateId: string
): Promise<Task | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("store_id", storeId)
    .eq("assigned_to_associate_id", associateId)
    .eq("is_completed", false)
    .eq("pending_verification", false)
    .not("queue_position", "is", null)
    .order("queue_position", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("fetchNextQueuedTask failed:", error.message)
    return null
  }
  return data
}

/**
 * Assign a task to an associate with a queue position.
 */
export async function assignTaskToAssociate(
  taskId: string,
  associateId: string,
  associateName: string,
  queuePosition: number
): Promise<boolean> {
  const { error } = await supabase
    .from("tasks")
    .update({
      assigned_to_associate_id: associateId,
      assigned_to: associateName,
      queue_position: queuePosition,
    })
    .eq("id", taskId)

  if (error) {
    console.error("assignTaskToAssociate failed:", error.message)
    return false
  }
  return true
}

/**
 * Fetch all queued tasks for an associate (supervisor view).
 */
export async function fetchAssociateTaskQueue(
  storeId: string,
  associateId: string
): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("store_id", storeId)
    .eq("assigned_to_associate_id", associateId)
    .eq("is_completed", false)
    .not("queue_position", "is", null)
    .order("queue_position", { ascending: true })

  if (error) {
    console.error("fetchAssociateTaskQueue failed:", error.message)
    return []
  }
  return data ?? []
}

/**
 * Fetch active shifts with their associates' current queued task.
 * Used for "Who's working with me?" panel.
 */
export async function fetchActiveShiftsWithCurrentTask(
  storeId: string,
  excludeAssociateId?: string
): Promise<Array<{
  associateId: string
  associateName: string
  station: string
  currentTask: string | null
  isExtended: boolean
}>> {
  const { data: shifts, error } = await (supabase as any).from("active_shifts").select("associate_id, station, is_extended, associates(id, name)")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .gt("expires_at", new Date().toISOString())

  if (error || !shifts) return []

  const results = await Promise.all(
    shifts
      .filter((s: any) => s.associate_id !== excludeAssociateId)
      .map(async (shift: any) => {
        const assoc = (shift as any).associates

        // Get their next queued task
        const { data: nextTask } = await supabase
          .from("tasks")
          .select("task_name")
          .eq("store_id", storeId)
          .eq("assigned_to_associate_id", shift.associate_id)
          .eq("is_completed", false)
          .not("queue_position", "is", null)
          .order("queue_position", { ascending: true })
          .limit(1)
          .maybeSingle()

        return {
          associateId: shift.associate_id,
          associateName: assoc?.name ?? "Unknown",
          station: shift.station ?? "Unknown",
          currentTask: nextTask?.task_name ?? null,
          isExtended: !!shift.is_extended,
        }
      })
  )

  return results
}





