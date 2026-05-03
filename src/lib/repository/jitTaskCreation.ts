import { supabase } from '../supabase'
import type { Database } from "../../types/database.types"
import type { PullEventSummary } from "../../types/pullWorkflow.types"
import type { StoreConfigAssociate, StoreConfigTask, StoreConfigInventoryItem, StoreConfigTableItem, StoreConfig } from "../../types/storeConfig.types"
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser"
import { getCurrentShiftBucket } from "./pullWorkflow"

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

// â”€â”€ JIT Task Creation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function createJitTask(
  storeId: string,
  taskName: string,
  archetype: string,
  priority: string,
  isCrossShiftCritical: boolean = false
): Promise<Task | null> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      store_id: storeId,
      task_name: taskName,
      archetype,
      priority,
      is_sticky: false,
      is_completed: false,
      is_orphaned: false,
      pending_verification: false,
      base_points: 10,
      is_pull_task: false,
      is_truck_task: false,
      shift_bucket: getCurrentShiftBucket(),
      lifecycle_state: "active",
      is_cross_shift_critical: isCrossShiftCritical,
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error("createJitTask failed:", error.message)
    return null
  }
  return data
}





