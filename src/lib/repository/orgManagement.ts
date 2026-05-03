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

// â”€â”€ Org Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function createOrganization(
  name: string,
  brandName: string,
  brandColor: string,
  welcomePhrase: string
): Promise<{ orgId: string; licenseId: string } | { error: string }> {
  console.log("[createOrganization] Starting:", { name, brandName, welcomePhrase })

  // Step 1: Create org
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name,
      brand_name: brandName,
      brand_color: brandColor,
    })
    .select()
    .maybeSingle()

  if (orgError || !org) {
    console.error("[createOrganization] Org insert failed:", orgError?.message)
    return { error: orgError?.message ?? "Organization insert failed." }
  }

  console.log("[createOrganization] Org created:", org.id)

  // Step 2: Create license
  const { data: license, error: licenseError } = await supabase
    .from("licenses")
    .insert({
      org_id: org.id,
      welcome_phrase: welcomePhrase,
      status: "active",
    })
    .select()
    .maybeSingle()

  if (licenseError || !license) {
    console.error("[createOrganization] License insert failed:", licenseError?.message)
    // Clean up the org we just created
    await supabase.from("organizations").delete().eq("id", org.id)
    return { error: licenseError?.message ?? "License insert failed." }
  }

  console.log("[createOrganization] License created:", license.id)

  // Step 3: Seed default stations
  const { error: stationsError } = await supabase.from("org_stations").insert([
    { org_id: org.id, name: "Kitchen", emoji: "ðŸ³", description: "Kitchen operations",   is_supervisor_only: false, is_float: false, display_order: 1 },
    { org_id: org.id, name: "POS",     emoji: "ðŸ–¥ï¸", description: "Front counter",       is_supervisor_only: false, is_float: false, display_order: 2 },
    { org_id: org.id, name: "Float",   emoji: "âš¡", description: "Fill in where needed", is_supervisor_only: false, is_float: true,  display_order: 3 },
    { org_id: org.id, name: "MOD",     emoji: "ðŸ‘‘", description: "Manager on duty",      is_supervisor_only: true,  is_float: false, display_order: 4 },
  ])

  if (stationsError) {
    console.error("[createOrganization] Stations insert failed:", stationsError.message)
    // Non-fatal â€” org and license were created successfully
  }

  console.log("[createOrganization] Complete:", { orgId: org.id, licenseId: license.id })
  return { orgId: org.id, licenseId: license.id }
}

export async function createStore(
  orgId: string,
  storeNumber: string,
  timezone: string = "America/New_York"
): Promise<string | null> {
  // Get license for this org
  const { data: license } = await supabase
    .from("licenses")
    .select("id")
    .eq("org_id", orgId)
    .maybeSingle()

  const { data: store, error } = await supabase
    .from("stores")
    .insert({
      org_id: orgId,
      store_number: storeNumber,
      timezone,
      license_id: license?.id ?? null,
      billing_status: "active",
    })
    .select()
    .maybeSingle()

  if (error || !store) {
    console.error("createStore failed:", error?.message)
    return null
  }

  return store.id
}

