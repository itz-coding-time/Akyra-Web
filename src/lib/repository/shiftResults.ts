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

// â”€â”€ Shift Results (GX1) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ShiftResult = Database["public"]["Tables"]["shift_results"]["Row"]

export interface TeamShiftResult {
  associateName: string
  result: ShiftResult
}

export async function fetchShiftResultsForStore(storeId: string): Promise<TeamShiftResult[]> {
  const today = new Date().toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("shift_results")
    .select("*, associates(name)")
    .eq("store_id", storeId)
    .eq("shift_date", today)

  if (error) {
    console.error("fetchShiftResultsForStore failed:", error.message)
    return []
  }

  return (data ?? []).map(row => ({
    associateName: (row as any).associates?.name ?? "Unknown",
    result: row as ShiftResult,
  }))
}

