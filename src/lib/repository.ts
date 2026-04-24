import { supabase } from "./supabase"
import type { Database } from "../types/database.types"

type Profile = Database["public"]["Tables"]["profiles"]["Row"]
type License = Database["public"]["Tables"]["licenses"]["Row"]
type Organization = Database["public"]["Tables"]["organizations"]["Row"]
type Store = Database["public"]["Tables"]["stores"]["Row"]
type Associate = Database["public"]["Tables"]["associates"]["Row"]

// ── Profiles ──────────────────────────────────────────────────────────────

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

// ── Licensing ─────────────────────────────────────────────────────────────

export async function fetchLicenseByPhrase(phrase: string): Promise<License | null> {
  const { data, error } = await supabase
    .from("licenses")
    .select("*")
    .eq("welcome_phrase", phrase)
    .maybeSingle()

  if (error) {
    console.error("fetchLicenseByPhrase failed:", error.message)
    return null
  }
  return data
}

export function isLicenseUsable(license: License): boolean {
  return license.status === "active" || license.status === "past_due"
}

export function isLicenseOnboardable(license: License): boolean {
  return license.status === "active"
}

// ── Organizations ─────────────────────────────────────────────────────────

export async function fetchOrganizationById(id: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("fetchOrganizationById failed:", error.message)
    return null
  }
  return data
}

export async function fetchAllOrganizations(): Promise<Organization[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .order("name")

  if (error) {
    console.error("fetchAllOrganizations failed:", error.message)
    return []
  }
  return data ?? []
}

// ── Stores ────────────────────────────────────────────────────────────────

export async function fetchStoreByNumberAndOrg(
  storeNumber: string,
  orgId: string
): Promise<Store | null> {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("store_number", storeNumber)
    .eq("org_id", orgId)
    .maybeSingle()

  if (error) {
    console.error("fetchStoreByNumberAndOrg failed:", error.message)
    return null
  }
  return data
}

// ── Associates ────────────────────────────────────────────────────────────

export async function fetchAssociatesByStore(storeId: string): Promise<Associate[]> {
  const { data, error } = await supabase
    .from("associates")
    .select("*")
    .eq("store_id", storeId)
    .order("name")

  if (error) {
    console.error("fetchAssociatesByStore failed:", error.message)
    return []
  }
  return data ?? []
}

// ── Auth ──────────────────────────────────────────────────────────────────

export async function signInWithEeidAndPin(
  eeid: string,
  pin: string
): Promise<Profile | null> {
  const syntheticEmail = `${eeid}@akyra.internal`

  const { error } = await supabase.auth.signInWithPassword({
    email: syntheticEmail,
    password: pin,
  })

  if (error) {
    console.error("signInWithEeidAndPin failed:", error.message)
    return null
  }

  return fetchProfileByEeid(eeid)
}

export async function registerAuthForProfile(
  eeid: string,
  pin: string
): Promise<Profile | null> {
  const syntheticEmail = `${eeid}@akyra.internal`

  // Step 1: Create Supabase Auth user
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: syntheticEmail,
    password: pin,
  })

  if (signUpError || !signUpData.user) {
    console.error("registerAuthForProfile signUp failed:", signUpError?.message)
    return null
  }

  // Step 2: Write auth_uid back to the profile
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ auth_uid: signUpData.user.id })
    .eq("eeid", eeid)

  if (updateError) {
    console.error("registerAuthForProfile profile update failed:", updateError.message)
    return null
  }

  return fetchProfileByEeid(eeid)
}

export async function createProfileFromOnboarding(
  eeid: string,
  displayName: string,
  orgId: string,
  storeId: string,
  authUserId: string,
  role: string = "supervisor"
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: authUserId,
      auth_uid: authUserId,
      eeid,
      display_name: displayName,
      org_id: orgId,
      current_store_id: storeId,
      role: role as Profile["role"],
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error("createProfileFromOnboarding failed:", error.message)
    return null
  }
  return data
}

export async function fetchLicenseForProfile(
  profile: Profile
): Promise<License | null> {
  if (!profile.org_id) return null

  const { data, error } = await supabase
    .from("licenses")
    .select("*")
    .eq("org_id", profile.org_id)
    .maybeSingle()

  if (error) {
    console.error("fetchLicenseForProfile failed:", error.message)
    return null
  }
  return data
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
