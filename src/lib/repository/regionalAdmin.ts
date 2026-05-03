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

// â”€â”€ Regional Admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface RegionSummary {
  id: string
  name: string
  orgId: string
  regionalAdminId: string | null
  districtCount: number
  storeCount: number
}

export async function fetchRegionsForOrg(orgId: string): Promise<RegionSummary[]> {
  const db = supabase as any
  const { data, error } = await db
    .from("regions")
    .select(`
      id, name, org_id, regional_admin_id,
      districts(id, stores(id))
    `)
    .eq("org_id", orgId)
    .order("name")

  if (error || !data) return []

  return data.map((r: any) => {
    const districts = r.districts ?? []
    const storeCount = districts.reduce(
      (sum: number, d: any) => sum + (d.stores?.length ?? 0), 0
    )
    return {
      id: r.id,
      name: r.name,
      orgId: r.org_id,
      regionalAdminId: r.regional_admin_id,
      districtCount: districts.length,
      storeCount,
    }
  })
}

export async function createRegion(
  orgId: string,
  name: string
): Promise<string | null> {
  const db = supabase as any
  const { data, error } = await db
    .from("regions")
    .insert({ org_id: orgId, name })
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("createRegion failed:", error.message)
    return null
  }
  return data?.id ?? null
}

export async function assignRegionalAdmin(
  regionId: string,
  profileId: string | null
): Promise<boolean> {
  const db = supabase as any
  const { error } = await db
    .from("regions")
    .update({ regional_admin_id: profileId })
    .eq("id", regionId)

  if (error) {
    console.error("assignRegionalAdmin failed:", error.message)
    return false
  }

  if (profileId) {
    await db
      .from("profiles")
      .update({ role: "regional_admin", role_rank: 6, region_id: regionId })
      .eq("id", profileId)
  }

  return true
}

export async function fetchRegionalMetrics(
  regionId: string
): Promise<{
  totalStores: number
  avgCompletionPct: number
  totalDeadCodes: number
  totalWasteQuantity: number
  totalTasksCompleted: number
  totalTasksOrphaned: number
}> {
  const db = supabase as any
  const { data: districts } = await db
    .from("districts")
    .select("id, stores(id)")
    .eq("region_id", regionId)

  const empty = {
    totalStores: 0,
    avgCompletionPct: 0,
    totalDeadCodes: 0,
    totalWasteQuantity: 0,
    totalTasksCompleted: 0,
    totalTasksOrphaned: 0,
  }

  if (!districts) return empty

  const storeIds = (districts as any[]).flatMap(
    (d: any) => (d.stores ?? []).map((s: any) => s.id)
  )

  if (storeIds.length === 0) return empty

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffStr = cutoff.toISOString().split("T")[0]
  const today = new Date().toISOString().split("T")[0]

  const [shiftData, pullData] = await Promise.all([
    supabase
      .from("shift_results")
      .select("completion_pct, tasks_completed, tasks_orphaned")
      .in("store_id", storeIds)
      .gte("shift_date", cutoffStr),
    supabase
      .from("pull_events")
      .select("waste_quantity")
      .in("store_id", storeIds)
      .lte("expires_date", today)
      .eq("is_verified", false),
  ])

  const shifts = shiftData.data ?? []
  const pulls = pullData.data ?? []

  return {
    totalStores: storeIds.length,
    avgCompletionPct: shifts.length > 0
      ? Math.round(shifts.reduce((s, r) => s + (r.completion_pct ?? 0), 0) / shifts.length)
      : 0,
    totalDeadCodes: pulls.filter(p => p.waste_quantity && p.waste_quantity > 0).length,
    totalWasteQuantity: pulls.reduce((s, p) => s + (p.waste_quantity ?? 0), 0),
    totalTasksCompleted: shifts.reduce((s, r) => s + (r.tasks_completed ?? 0), 0),
    totalTasksOrphaned: shifts.reduce((s, r) => s + (r.tasks_orphaned ?? 0), 0),
  }
}

