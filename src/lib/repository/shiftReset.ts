import { supabase } from '../supabase'
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

// â”€â”€ Shift Reset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function resetShiftTasks(storeId: string): Promise<number> {
  const { data, error } = await supabase
    .from("tasks")
    .update({
      is_completed: false,
      pending_verification: false,
      is_orphaned: false,
      completed_by: null,
    })
    .eq("store_id", storeId)
    .select()

  if (error) {
    console.error("resetShiftTasks failed:", error.message)
    return 0
  }
  return data?.length ?? 0
}

export async function resetFlipChecklists(storeId: string): Promise<number> {
  const { data, error } = await supabase
    .from("table_items")
    .update({ is_initialed: true })
    .eq("store_id", storeId)
    .select()

  if (error) {
    console.error("resetFlipChecklists failed:", error.message)
    return 0
  }
  return data?.length ?? 0
}

export async function closeAllActiveShifts(storeId: string): Promise<number> {
  const { data, error } = await supabase
    .from("active_shifts")
    .update({ is_active: false })
    .eq("store_id", storeId)
    .eq("is_active", true)
    .select()

  if (error) {
    console.error("closeAllActiveShifts failed:", error.message)
    return 0
  }
  return data?.length ?? 0
}

export async function startShift(storeId: string): Promise<{
  tasksReset: number
  itemsReset: number
  shiftsClosed: number
}> {
  const [tasksReset, itemsReset, shiftsClosed] = await Promise.all([
    resetShiftTasks(storeId),
    resetFlipChecklists(storeId),
    closeAllActiveShifts(storeId),
  ])

  console.log(`Shift started: ${tasksReset} tasks reset, ${itemsReset} flip items reset, ${shiftsClosed} active shifts closed`)

  return { tasksReset, itemsReset, shiftsClosed }
}

