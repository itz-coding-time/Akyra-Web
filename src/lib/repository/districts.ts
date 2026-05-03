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

// â”€â”€ Districts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchDistrictsForOrg(orgId: string): Promise<Array<{
  id: string
  name: string
  orgId: string
  districtManagerId: string | null
  storeCount: number
}>> {
  const db = supabase as any
  const { data, error } = await db
    .from("districts")
    .select("id, name, org_id, district_manager_id, stores(id)")
    .eq("org_id", orgId)
    .order("name")

  if (error || !data) return []

  return (data as any[]).map((d: any) => ({
    id: d.id,
    name: d.name,
    orgId: d.org_id,
    districtManagerId: d.district_manager_id,
    storeCount: d.stores?.length ?? 0,
  }))
}

export async function fetchDistrictsForRegion(regionId: string): Promise<Array<{
  id: string
  name: string
  orgId: string
  districtManagerId: string | null
  storeCount: number
}>> {
  const db = supabase as any
  const { data, error } = await db
    .from("districts")
    .select("id, name, org_id, district_manager_id, stores(id)")
    .eq("region_id", regionId)
    .order("name")

  if (error || !data) return []

  return (data as any[]).map((d: any) => ({
    id: d.id,
    name: d.name,
    orgId: d.org_id,
    districtManagerId: d.district_manager_id,
    storeCount: d.stores?.length ?? 0,
  }))
}

export async function createDistrict(
  orgId: string,
  regionId: string,
  name: string
): Promise<string | null> {
  const db = supabase as any
  const { data, error } = await db
    .from("districts")
    .insert({ org_id: orgId, region_id: regionId, name })
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("createDistrict failed:", error.message)
    return null
  }
  return data?.id ?? null
}

export async function updateDistrict(
  districtId: string,
  updates: { name?: string; districtManagerId?: string | null }
): Promise<boolean> {
  const update: Record<string, unknown> = {}
  if (updates.name !== undefined) update.name = updates.name
  if (updates.districtManagerId !== undefined) update.district_manager_id = updates.districtManagerId

  const db = supabase as any
  const { error } = await db
    .from("districts")
    .update(update)
    .eq("id", districtId)

  return !error
}

export async function deleteDistrict(districtId: string): Promise<boolean> {
  const db = supabase as any
  const { error } = await db
    .from("districts")
    .delete()
    .eq("id", districtId)

  return !error
}

export async function assignStoreToDistrict(
  storeId: string,
  districtId: string | null
): Promise<boolean> {
  const db = supabase as any
  const { error } = await db
    .from("stores")
    .update({ district_id: districtId })
    .eq("id", storeId)

  return !error
}

