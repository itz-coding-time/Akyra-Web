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

// â”€â”€ OPS2: Holdover Protocol â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function initiateHoldover(
  associateId: string,
  storeId: string,
  shiftBucket: "6a-2p" | "2p-10p" | "10p-6a"
): Promise<string | null> {
  // Extend the associate's shift by 2 hours
  await extendShift(associateId, storeId, 120, "extending")

  const { data, error } = await (supabase as any)
    .from("holdover_events")
    .insert({
      store_id: storeId,
      associate_id: associateId,
      shift_bucket: shiftBucket,
      shift_date: new Date().toISOString().split("T")[0],
    })
    .select("id")
    .maybeSingle()

  if (error || !data) return null

  // Notify all supervisors on shift
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
        message: "No relief for next shift. Holdover protocol active. Who can I call?",
        ping_type: "direct",
      })
    }
  }

  return data.id
}

export async function resolveHoldover(
  holdoverId: string,
  reliefAssociateId: string
): Promise<boolean> {
  const { error } = await (supabase as any)
    .from("holdover_events")
    .update({
      resolved_at: new Date().toISOString(),
      relief_associate_id: reliefAssociateId,
    })
    .eq("id", holdoverId)

  return !error
}

