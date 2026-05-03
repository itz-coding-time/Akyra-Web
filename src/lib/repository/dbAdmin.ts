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

// â”€â”€ DB Admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface OrgSummary {
  id: string
  name: string
  brandName: string | null
  storeCount: number
  associateCount: number
  licenseStatus: string | null
  welcomePhrase: string | null
}

export interface StoreSummary {
  id: string
  storeNumber: string
  billingStatus: string
  associateCount: number
  profileCount: number
}

export async function deleteOrganization(orgId: string): Promise<boolean> {
  const db = supabase as any
  const { error } = await db.from("organizations").delete().eq("id", orgId)
  if (error) {
    console.error("deleteOrganization failed:", error.message)
    return false
  }
  return true
}

export async function fetchAllOrgs(): Promise<OrgSummary[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select(`
      id,
      name,
      brand_name,
      stores(id),
      licenses(status, welcome_phrase)
    `)

  if (error || !data) return []

  const orgIds = data.map(o => o.id)
  const { data: assocData } = await supabase
    .from("associates")
    .select("store_id, stores!inner(org_id)")
    .in("stores.org_id", orgIds)

  return data.map(org => ({
    id: org.id,
    name: org.name,
    brandName: (org as any).brand_name,
    storeCount: (org as any).stores?.length ?? 0,
    associateCount: (assocData ?? []).filter(
      (a: any) => a.stores?.org_id === org.id
    ).length,
    licenseStatus: (org as any).licenses?.[0]?.status ?? null,
    welcomePhrase: (org as any).licenses?.[0]?.welcome_phrase ?? null,
  }))
}

export async function fetchStoresForOrg(orgId: string): Promise<StoreSummary[]> {
  const { data, error } = await supabase
    .from("stores")
    .select("id, store_number, billing_status")
    .eq("org_id", orgId)
    .order("store_number")

  if (error || !data) return []

  const summaries = await Promise.all(data.map(async store => {
    const { count: assocCount } = await supabase
      .from("associates")
      .select("*", { count: "exact", head: true })
      .eq("store_id", store.id)

    const { count: profileCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("current_store_id", store.id)

    return {
      id: store.id,
      storeNumber: store.store_number,
      billingStatus: store.billing_status,
      associateCount: assocCount ?? 0,
      profileCount: profileCount ?? 0,
    }
  }))

  return summaries
}

export async function fetchProfilesForStore(storeId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("current_store_id", storeId)
    .order("display_name")

  if (error) return []
  return data ?? []
}

export async function fetchProfilesForOrg(orgId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*, current_store_id!inner(org_id)")
    .eq("current_store_id.org_id", orgId)
    .order("display_name")

  if (error) return []
  return data ?? []
}

export async function updateProfileRole(
  profileId: string,
  role: string,
  roleRank: number
): Promise<boolean> {
  const { error } = await supabase
    .from("profiles")
    .update({ role, role_rank: roleRank })
    .eq("id", profileId)

  if (error) {
    console.error("updateProfileRole failed:", error.message)
    return false
  }
  return true
}





