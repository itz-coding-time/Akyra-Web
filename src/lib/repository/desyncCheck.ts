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

// â”€â”€ Desync Check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function checkAndApplyDesync(
  storeId: string,
  associateId: string,
  associateName: string
): Promise<void> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)

  const { count } = await supabase
    .from("task_verifications")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("associate_id", associateId)
    .in("status", ["resolved_retry", "resolved_challenged"])
    .gte("created_at", cutoff.toISOString())

  if ((count ?? 0) >= 3) {
    const { data: store } = await (supabase as any)
      .from("stores")
      .select("org_id, district_id")
      .eq("id", storeId)
      .maybeSingle()

    await (supabase as any)
      .from("associate_rankings")
      .upsert({
        store_id: storeId,
        associate_id: associateId,
        associate_name: associateName,
        org_id: store?.org_id ?? "",
        district_id: store?.district_id ?? null,
        is_desynced: true,
        desync_reason: "3+ verification failures in 30 days",
        desync_since: new Date().toISOString(),
        desync_assists_needed: 3,
        desync_assists_completed: 0,
      }, { onConflict: "store_id,associate_id" })
  }
}





