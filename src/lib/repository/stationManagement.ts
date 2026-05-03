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

// â”€â”€ Station Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function createOrgStation(
  orgId: string,
  station: Omit<import("../../types").OrgStation, "id" | "orgId">
): Promise<boolean> {
  const { error } = await supabase
    .from("org_stations")
    .insert({
      org_id: orgId,
      name: station.name,
      emoji: station.emoji,
      description: station.description,
      is_supervisor_only: station.isSupervisorOnly,
      is_float: station.isFloat,
      display_order: station.displayOrder,
    })

  if (error) {
    console.error("createOrgStation failed:", error.message)
    return false
  }
  return true
}

export async function updateOrgStation(
  stationId: string,
  updates: Partial<Omit<import("../../types").OrgStation, "id" | "orgId">>
): Promise<boolean> {
  type OrgStationUpdate = Database["public"]["Tables"]["org_stations"]["Update"]
  const update: OrgStationUpdate = {}
  if (updates.name !== undefined) update.name = updates.name
  if (updates.emoji !== undefined) update.emoji = updates.emoji
  if (updates.description !== undefined) update.description = updates.description
  if (updates.isSupervisorOnly !== undefined) update.is_supervisor_only = updates.isSupervisorOnly
  if (updates.isFloat !== undefined) update.is_float = updates.isFloat
  if (updates.displayOrder !== undefined) update.display_order = updates.displayOrder

  const { error } = await supabase
    .from("org_stations")
    .update(update)
    .eq("id", stationId)

  if (error) {
    console.error("updateOrgStation failed:", error.message)
    return false
  }
  return true
}

export async function deleteOrgStation(stationId: string): Promise<boolean> {
  const { error } = await supabase
    .from("org_stations")
    .delete()
    .eq("id", stationId)

  if (error) {
    console.error("deleteOrgStation failed:", error.message)
    return false
  }
  return true
}

export async function reorderOrgStations(
  stations: Array<{ id: string; displayOrder: number }>
): Promise<boolean> {
  for (const s of stations) {
    await supabase
      .from("org_stations")
      .update({ display_order: s.displayOrder })
      .eq("id", s.id)
  }
  return true
}





