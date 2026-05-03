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

// â”€â”€ OPS4: Early Departure â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function initiateEarlyDeparture(
  associateId: string,
  storeId: string,
  reason: string
): Promise<boolean> {
  // Orphan all assigned incomplete tasks
  await (supabase as any)
    .from("tasks")
    .update({ is_orphaned: true, assigned_to_associate_id: null })
    .eq("assigned_to_associate_id", associateId)
    .eq("store_id", storeId)
    .eq("is_completed", false)

  // Notify supervisor
  const { data: supervisors } = await (supabase as any)
    .from("active_shifts")
    .select("associate_id, associates!associate_id(role_rank)")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .neq("associate_id", associateId)

  for (const s of supervisors ?? []) {
    if ((s as any).associates?.role_rank >= 2) {
      await (supabase as any).from("pings").insert({
        store_id: storeId,
        from_associate_id: associateId,
        to_associate_id: s.associate_id,
        message: `Early departure: ${reason}. Their tasks have been orphaned.`,
        ping_type: "direct",
      })
    }
  }

  // Close the shift
  await closeShiftEarly(associateId, storeId)
  return true
}

