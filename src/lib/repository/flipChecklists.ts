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

// â”€â”€ Flip Checklists (table_items) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchTableItemsByStation(
  storeId: string,
  station: string
): Promise<TableItem[]> {
  const { data, error } = await supabase
    .from("table_items")
    .select("*")
    .eq("store_id", storeId)
    .eq("station", station)

  if (error) {
    console.error("fetchTableItemsByStation failed:", error.message)
    return []
  }
  return data ?? []
}

export async function flagTableItem(
  itemId: string,
  initialed: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from("table_items")
    .update({ is_initialed: initialed })
    .eq("id", itemId)

  if (error) {
    console.error("flagTableItem failed:", error.message)
    return false
  }
  return true
}





