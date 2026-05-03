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

// â”€â”€ OPS3: Split Shift â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function markSplitShiftDeparture(
  associateId: string,
  storeId: string,
  returnTime: string
): Promise<boolean> {
  const { error } = await (supabase as any)
    .from("active_shifts")
    .update({
      is_active: false,
      is_split_shift: true,
      split_return_time: returnTime,
    })
    .eq("associate_id", associateId)
    .eq("store_id", storeId)
    .eq("is_active", true)

  return !error
}

export async function markSplitShiftReturn(
  associateId: string,
  storeId: string
): Promise<boolean> {
  const { error } = await (supabase as any)
    .from("active_shifts")
    .update({
      is_active: true,
      expires_at: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
    })
    .eq("associate_id", associateId)
    .eq("store_id", storeId)
    .eq("is_split_shift", true)

  return !error
}

