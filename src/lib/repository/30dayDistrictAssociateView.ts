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

// â”€â”€ 30-Day District Associate View â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchDistrictAssociatesLast30Days(
  storeId: string,
  _districtId: string
): Promise<Array<{
  associateId: string
  name: string
  role: string
  homeStore: string
  lastVisit: string
}>> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const cutoff = thirtyDaysAgo.toISOString().split("T")[0]

  const db = supabase as any
  const { data, error } = await db
    .from("associate_store_visits")
    .select(`
      associate_id,
      visited_at,
      associates!associate_id(name, role, store_id, stores!store_id(store_number))
    `)
    .eq("store_id", storeId)
    .gte("visited_at", cutoff)
    .order("visited_at", { ascending: false })

  if (error || !data) return []

  const seen = new Set<string>()
  const results: Array<{
    associateId: string
    name: string
    role: string
    homeStore: string
    lastVisit: string
  }> = []

  for (const visit of data as any[]) {
    if (seen.has(visit.associate_id)) continue
    seen.add(visit.associate_id)

    const assoc = visit.associates
    results.push({
      associateId: visit.associate_id,
      name: assoc?.name ?? "Unknown",
      role: assoc?.role ?? "crew",
      homeStore: assoc?.stores?.store_number ?? "?",
      lastVisit: visit.visited_at,
    })
  }

  return results
}





