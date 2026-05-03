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

// â”€â”€ Profiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchProfileByEeid(eeid: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("eeid", eeid)
    .maybeSingle()

  if (error) {
    console.error("fetchProfileByEeid failed:", error.message)
    return null
  }
  return data
}

const WELCOME_CODE_KEY = "akyra_org_code"

/**
 * Fetch profile by EEID scoped to a specific org via welcome phrase.
 * Returns null if the EEID doesn't exist in that org.
 * This prevents cross-org profile discovery.
 */
export async function fetchProfileByEeidAndOrg(
  eeid: string,
  welcomePhrase: string
): Promise<Profile | null> {
  const { data: license, error: licenseError } = await supabase
    .from("licenses")
    .select("org_id, status")
    .eq("welcome_phrase", welcomePhrase)
    .maybeSingle()

  if (licenseError || !license) {
    console.log("[Auth] Welcome phrase not found:", welcomePhrase)
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("eeid", eeid)
    .eq("org_id", license.org_id)
    .maybeSingle()

  if (profileError || !profile) {
    console.log("[Auth] Profile not found for EEID in org:", eeid, license.org_id)
    return null
  }

  return profile
}

/**
 * Validate a welcome phrase and return the org info.
 * Used in step 0 of the login flow.
 */
export async function validateWelcomeCode(
  welcomePhrase: string
): Promise<{ orgId: string; orgName: string; brandName: string | null } | null> {
  const { data, error } = await supabase
    .from("licenses")
    .select(`
      org_id,
      status,
      organizations!org_id(name, brand_name)
    `)
    .eq("welcome_phrase", welcomePhrase)
    .maybeSingle()

  if (error || !data) return null

  if (data.status === "cancelled") return null

  const org = (data as any).organizations
  return {
    orgId: data.org_id,
    orgName: org?.name ?? "Unknown",
    brandName: org?.brand_name ?? null,
  }
}

/**
 * Cache welcome code to localStorage.
 */
export function cacheWelcomeCode(welcomePhrase: string): void {
  localStorage.setItem(WELCOME_CODE_KEY, welcomePhrase)
}

/**
 * Get cached welcome code from localStorage.
 */
export function getCachedWelcomeCode(): string | null {
  return localStorage.getItem(WELCOME_CODE_KEY)
}

/**
 * Clear cached welcome code (org switch or logout).
 */
export function clearWelcomeCode(): void {
  localStorage.removeItem(WELCOME_CODE_KEY)
}

