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

// â”€â”€ Active Shifts (Ghost Protocol) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function createActiveShift(
  associateId: string,
  storeId: string,
  station: string
): Promise<ActiveShift | null> {
  // Deactivate any existing active shift for this associate first
  await supabase
    .from("active_shifts")
    .update({ is_active: false })
    .eq("associate_id", associateId)
    .eq("is_active", true)

  const expiresAt = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("active_shifts")
    .insert({
      associate_id: associateId,
      store_id: storeId,
      station,
      expires_at: expiresAt,
      is_active: true,
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error("createActiveShift failed:", error.message)
    return null
  }
  return data
}

export async function updateActiveShiftStation(
  associateId: string,
  station: string
): Promise<boolean> {
  const { error } = await supabase
    .from("active_shifts")
    .update({ station })
    .eq("associate_id", associateId)
    .eq("is_active", true)

  if (error) {
    console.error("updateActiveShiftStation failed:", error.message)
    return false
  }
  return true
}

export async function expireActiveShift(associateId: string): Promise<boolean> {
  const { error } = await supabase
    .from("active_shifts")
    .update({ is_active: false })
    .eq("associate_id", associateId)
    .eq("is_active", true)

  if (error) {
    console.error("expireActiveShift failed:", error.message)
    return false
  }
  return true
}

export async function fetchActiveShiftsForStore(storeId: string): Promise<ActiveShift[]> {
  const { data, error } = await supabase
    .from("active_shifts")
    .select("*, associates(id, name, current_archetype, role, role_rank)")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .gt("expires_at", new Date().toISOString())

  if (error) {
    console.error("fetchActiveShiftsForStore failed:", error.message)
    return []
  }
  return data ?? []
}

export async function fetchMyActiveShift(associateId: string): Promise<ActiveShift | null> {
  const { data, error } = await supabase
    .from("active_shifts")
    .select("*")
    .eq("associate_id", associateId)
    .eq("is_active", true)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()

  if (error) {
    console.error("fetchMyActiveShift failed:", error.message)
    return null
  }
  return data
}

// Expire sessions past their TTL â€” run on dashboard refresh
export async function expireStaleShifts(storeId: string): Promise<number> {
  const { data, error } = await supabase
    .from("active_shifts")
    .update({ is_active: false })
    .eq("store_id", storeId)
    .eq("is_active", true)
    .lt("expires_at", new Date().toISOString())
    .select()

  if (error) {
    console.error("expireStaleShifts failed:", error.message)
    return 0
  }
  return data?.length ?? 0
}

export async function updateScheduleEndTime(
  entryId: string,
  endTime: string
): Promise<boolean> {
  const { error } = await supabase
    .from("schedule_entries")
    .update({ end_time: endTime })
    .eq("id", entryId)

  if (error) {
    console.error("updateScheduleEndTime failed:", error.message)
    return false
  }
  return true
}

