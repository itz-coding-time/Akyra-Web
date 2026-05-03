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

// â”€â”€ Org Context â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function updateOrgBranding(
  orgId: string,
  updates: {
    brandName?: string
    brandColor?: string
    logoUrl?: string
    terminology?: Record<string, string>
  }
): Promise<boolean> {
  type OrgUpdate = Database["public"]["Tables"]["organizations"]["Update"]
  const update: OrgUpdate = {}
  if (updates.brandName !== undefined) update.brand_name = updates.brandName
  if (updates.brandColor !== undefined) update.brand_color = updates.brandColor
  if (updates.logoUrl !== undefined) update.logo_url = updates.logoUrl
  if (updates.terminology !== undefined) update.terminology = updates.terminology as OrgUpdate["terminology"]

  const { error } = await supabase
    .from("organizations")
    .update(update)
    .eq("id", orgId)

  if (error) {
    console.error("updateOrgBranding failed:", error.message)
    return false
  }
  return true
}

export async function uploadOrgLogo(
  orgId: string,
  file: File
): Promise<string | null> {
  const fileName = `logos/${orgId}-${Date.now()}.${file.name.split(".").pop()}`
  const { data, error } = await supabase.storage
    .from("equipment-photos") // reuse existing bucket
    .upload(fileName, file, { upsert: true })

  if (error || !data) {
    console.error("uploadOrgLogo failed:", error?.message)
    return null
  }

  const { data: urlData } = supabase.storage
    .from("equipment-photos")
    .getPublicUrl(data.path)

  return urlData.publicUrl
}

export async function fetchOrgBranding(orgId: string): Promise<import("../../types").OrgBranding | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, brand_name, brand_color, logo_url, terminology")
    .eq("id", orgId)
    .maybeSingle()

  if (error || !data) return null

  const terminology = (data.terminology as Record<string, unknown> | null) ?? {}
  const roles = (terminology.roles as Record<string, string> | null | undefined) ?? {}

  return {
    id: data.id,
    name: data.name,
    brandName: data.brand_name,
    brandColor: data.brand_color ?? "#E63946",
    logoUrl: data.logo_url,
    terminology: {
      associate:  (terminology.associate  as string) ?? "Associate",
      supervisor: (terminology.supervisor as string) ?? "Supervisor",
      station:    (terminology.station    as string) ?? "Station",
      shift:      (terminology.shift      as string) ?? "Shift",
      mod:        (terminology.mod        as string) ?? "MOD",
      roles: {
        crew:              roles.crew              ?? "Crew",
        supervisor:        roles.supervisor        ?? "Supervisor",
        assistant_manager: roles.assistant_manager ?? "Assistant Manager",
        store_manager:     roles.store_manager     ?? "Store Manager",
        district_admin:    roles.district_admin    ?? "District Admin",
        org_admin:         roles.org_admin         ?? "Org Admin",
        db_admin:          roles.db_admin          ?? "Platform Admin",
      },
    },
  }
}

/**
 * Get the display name for a role from org branding.
 * Falls back to the raw role string if no custom name is set.
 */
export function getRoleDisplayName(
  role: string,
  orgBranding: import("../../types").OrgBranding | null
): string {
  if (!orgBranding) return role
  const roles = orgBranding.terminology.roles as Record<string, string>
  return roles[role] ?? role
}

export async function fetchOrgStations(orgId: string): Promise<import("../../types").OrgStation[]> {
  const { data, error } = await supabase
    .from("org_stations")
    .select("*")
    .eq("org_id", orgId)
    .order("display_order")

  if (error || !data) return []

  return data.map(s => ({
    id: s.id,
    orgId: s.org_id,
    name: s.name,
    emoji: s.emoji,
    description: s.description,
    isSupervisorOnly: s.is_supervisor_only,
    isFloat: s.is_float,
    displayOrder: s.display_order,
  }))
}





