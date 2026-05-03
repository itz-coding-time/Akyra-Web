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

// â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Get the welcome phrase for an org â€” used to construct synthetic email.
 * Returns null if no license found for the org.
 */
export async function fetchWelcomePhraseForOrg(orgId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("licenses")
    .select("welcome_phrase")
    .eq("org_id", orgId)
    .maybeSingle()

  if (error || !data) return null
  return data.welcome_phrase
}

/**
 * Construct the synthetic email for Supabase Auth.
 * Format: {eeid}.{welcome_phrase}@akyra.internal
 * Falls back to {eeid}@akyra.internal if no welcome phrase found (legacy/dev).
 */
export function buildSyntheticEmail(eeid: string, welcomePhrase: string | null): string {
  const email = welcomePhrase
    ? `${eeid}.${welcomePhrase}@akyra.internal`
    : `${eeid}@akyra.internal`
  console.log(`[Auth] Synthetic email: ${email}`)
  return email
}

/**
 * Migrate a user from old schema ({eeid}@akyra.internal)
 * to new schema ({eeid}.{welcomePhrase}@akyra.internal).
 * Called silently on login if old schema detected.
 */
export async function migrateAuthSchema(
  eeid: string,
  pin: string,
  welcomePhrase: string
): Promise<boolean> {
  const oldEmail = `${eeid}@akyra.internal`
  const newEmail = `${eeid}.${welcomePhrase}@akyra.internal`

  // Step 1: Sign in with old schema to verify PIN is correct
  const { data: oldSession, error: oldError } = await supabase.auth.signInWithPassword({
    email: oldEmail,
    password: pin,
  })

  if (oldError || !oldSession.user) {
    console.log("migrateAuthSchema: old schema sign-in failed, skipping migration")
    return false
  }

  // Step 2: Create new auth user with new schema
  const { data: newUser, error: newError } = await supabase.auth.signUp({
    email: newEmail,
    password: pin,
  })

  if (newError && !newError.message.includes("already registered")) {
    console.error("migrateAuthSchema: new schema signup failed:", newError.message)
    return false
  }

  // Step 3: Update profile auth_uid to new user if different
  const newAuthUid = newUser?.user?.id ?? null
  if (newAuthUid && newAuthUid !== oldSession.user.id) {
    await supabase
      .from("profiles")
      .update({ auth_uid: newAuthUid })
      .eq("eeid", eeid)
  }

  console.log(`migrateAuthSchema: ${eeid} migrated from old to new schema`)
  return true
}

export async function signInWithEeidAndPin(
  eeid: string,
  pin: string
): Promise<Profile | null> {
  // Get profile to find org
  const profile = await fetchProfileByEeid(eeid)
  if (!profile) return null

  // Get welcome phrase
  const welcomePhrase = profile.org_id
    ? await fetchWelcomePhraseForOrg(profile.org_id)
    : null

  const newEmail = buildSyntheticEmail(eeid, welcomePhrase)

  // Try new schema first
  const { data, error } = await supabase.auth.signInWithPassword({
    email: newEmail,
    password: pin,
  })

  if (!error && data.user) {
    return fetchProfileByEeid(eeid)
  }

  // New schema failed â€” try old schema (migration path)
  if (welcomePhrase) {
    console.log(`signInWithEeidAndPin: new schema failed, trying old schema for ${eeid}`)
    const oldEmail = `${eeid}@akyra.internal`
    const { data: oldData, error: oldError } = await supabase.auth.signInWithPassword({
      email: oldEmail,
      password: pin,
    })

    if (!oldError && oldData.user) {
      // Old schema worked â€” migrate silently
      console.log(`signInWithEeidAndPin: migrating ${eeid} to new schema`)
      await migrateAuthSchema(eeid, pin, welcomePhrase)
      return fetchProfileByEeid(eeid)
    }
  }

  console.error("signInWithEeidAndPin failed:", error?.message)
  return null
}

/**
 * Sign in with EEID, password, and welcome phrase (org-scoped).
 * Uses the synthetic email {eeid}.{welcomePhrase}@akyra.internal.
 */
export async function signInWithEeidAndOrg(
  eeid: string,
  password: string,
  welcomePhrase: string
): Promise<Profile | null> {
  const syntheticEmail = buildSyntheticEmail(eeid, welcomePhrase)
  console.log("[Auth] Attempting sign in:", syntheticEmail)

  const { data, error } = await supabase.auth.signInWithPassword({
    email: syntheticEmail,
    password,
  })

  if (error || !data.user) {
    console.error("[Auth] Sign in failed:", error?.message)
    return null
  }

  return fetchProfileByEeidAndOrg(eeid, welcomePhrase)
}

export async function registerAuthForProfile(
  eeid: string,
  pin: string
): Promise<Profile | null> {
  // Get the profile to find org_id
  const profile = await fetchProfileByEeid(eeid)
  if (!profile) {
    console.error("registerAuthForProfile: no profile found for EEID", eeid)
    return null
  }

  // Get welcome phrase for org
  const welcomePhrase = profile.org_id
    ? await fetchWelcomePhraseForOrg(profile.org_id)
    : null

  const syntheticEmail = buildSyntheticEmail(eeid, welcomePhrase)
  console.log("registerAuthForProfile: using email schema", syntheticEmail)

  // Attempt signup
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: syntheticEmail,
    password: pin,
  })

  let authUid: string | null = null

  if (signUpError) {
    if (signUpError.message.includes("already registered")) {
      // User exists â€” try signing in with same PIN to link
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password: pin,
      })

      if (signInError || !signInData.user) {
        console.error("registerAuthForProfile: user exists but PIN mismatch")
        return null
      }

      authUid = signInData.user.id
    } else {
      console.error("registerAuthForProfile signUp failed:", signUpError.message)
      return null
    }
  } else {
    authUid = signUpData.user?.id ?? null
  }

  if (!authUid) {
    console.error("registerAuthForProfile: no auth UID")
    return null
  }

  // Write auth_uid back to profile
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ auth_uid: authUid })
    .eq("eeid", eeid)

  if (updateError) {
    console.error("registerAuthForProfile profile update failed:", updateError.message)
    return null
  }

  return fetchProfileByEeid(eeid)
}

/**
 * Register auth credentials for a pre-seeded profile, org-scoped.
 * Called from ClaimAccountScreen on first login.
 */
export async function registerAuthForOrg(
  eeid: string,
  password: string,
  welcomePhrase: string
): Promise<Profile | null> {
  const { data: license, error: licenseError } = await supabase
    .from("licenses")
    .select("org_id")
    .eq("welcome_phrase", welcomePhrase)
    .maybeSingle()

  if (licenseError || !license) {
    console.error("[Auth] Registration org lookup failed:", licenseError?.message)
    return null
  }

  const syntheticEmail = buildSyntheticEmail(eeid, welcomePhrase)
  console.log("[Auth] Registering:", syntheticEmail)

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: syntheticEmail,
    password,
  })

  let authUid: string | null = null

  if (signUpError) {
    if (signUpError.message.includes("already registered")) {
      // Try signing in â€” previous incomplete registration
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password,
      })
      if (signInError || !signInData.user) {
        console.error("[Auth] Already registered but wrong password")
        return null
      }
      authUid = signInData.user.id
    } else {
      console.error("[Auth] Registration failed:", signUpError.message)
      return null
    }
  } else {
    authUid = signUpData.user?.id ?? null
  }

  if (!authUid) return null

  // Link auth_uid to the profile in this org only. EEIDs can repeat across orgs.
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ auth_uid: authUid })
    .eq("eeid", eeid)
    .eq("org_id", license.org_id)

  if (updateError) {
    console.error("[Auth] Profile auth link failed:", updateError.message)
    return null
  }

  return fetchProfileByEeidAndOrg(eeid, welcomePhrase)
}

