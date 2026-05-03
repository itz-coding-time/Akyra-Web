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

// â”€â”€ Licensing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Organizations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Stores â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Associates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchAssociatesByStore(storeId: string | null | undefined): Promise<Associate[]> {
  if (!storeId) return []
  const { data, error } = await supabase
    .from("associates")
    .select(`*, profiles!profile_id (id, auth_uid, eeid)`)
    .eq("store_id", storeId)
    .order("name")

  if (error) {
    console.error("fetchAssociatesByStore failed:", error.message)
    return []
  }
  return data ?? []
}

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

// â”€â”€ Google Sign In â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DB_ADMIN_WHITELIST = ["therealbrancase@gmail.com"]

/**
 * Initiate Google OAuth sign in.
 * Supabase handles the OAuth flow and redirects back to the app.
 */
export async function signInWithGoogle(redirectTo: string): Promise<void> {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  })
}

/**
 * Handle Google OAuth callback.
 * Called when Supabase redirects back after Google sign in.
 * Links the Google email to the profile if not already linked.
 * Enforces db_admin whitelist.
 */
export async function handleGoogleCallback(
  eeid: string
): Promise<{ kind: "success"; profile: Profile } | { kind: "error"; message: string } | { kind: "not_linked" }> {
  // Get the current session from Supabase (set by OAuth callback)
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error || !session) {
    return { kind: "error", message: "Google sign in failed. Please try again." }
  }

  const googleEmail = session.user.email ?? ""

  // Fetch the profile by EEID
  const profile = await fetchProfileByEeid(eeid)

  if (!profile) {
    // No profile for this EEID â€” not a registered associate
    await supabase.auth.signOut()
    return { kind: "error", message: "No account found for this EEID." }
  }

  // DB Admin whitelist check
  if (profile.role === "db_admin" && !DB_ADMIN_WHITELIST.includes(googleEmail)) {
    await supabase.auth.signOut()
    return { kind: "error", message: "Link your EEID to continue." }
  }

  // If profile already has a google_email, verify it matches
  if ((profile as any).google_email && (profile as any).google_email !== googleEmail) {
    await supabase.auth.signOut()
    return { kind: "error", message: "This Google account is not linked to this EEID." }
  }

  // Link Google email to profile if not already linked
  if (!(profile as any).google_email) {
    await supabase
      .from("profiles")
      .update({
        google_email: googleEmail,
        auth_uid: session.user.id,
      })
      .eq("eeid", eeid)
  }

  return { kind: "success", profile }
}

/**
 * Check if a profile has Google Sign In linked.
 */
export async function hasGoogleLinked(eeid: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("google_email")
    .eq("eeid", eeid)
    .maybeSingle()

  return !!(data as any)?.google_email
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

// â”€â”€ Passkeys (WebAuthn) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function isPasskeySupported(): boolean {
  return browserSupportsWebAuthn()
}

/**
 * Register a passkey for the currently signed-in user.
 * Called after first PIN login when user opts in.
 * Uses Supabase Auth MFA enrollment for WebAuthn.
 */
export async function registerPasskey(
  displayName: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Step 1: Start MFA enrollment with Supabase
    const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "webauthn",
      friendlyName: displayName,
    } as any)

    if (enrollError || !enrollData) {
      console.error("registerPasskey enroll failed:", enrollError?.message)
      return { success: false, message: "Could not start passkey registration." }
    }

    // Step 2: Get the WebAuthn challenge from Supabase
    const challenge = (enrollData as any).totp?.uri ?? (enrollData as any).webauthn

    if (!challenge) {
      return { success: false, message: "WebAuthn challenge not returned." }
    }

    // Step 3: Trigger browser biometric prompt
    const registrationResponse = await startRegistration({ optionsJSON: challenge as any })

    // Step 4: Verify with Supabase
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: (enrollData as any).id,
      challengeId: (enrollData as any).challengeId ?? (enrollData as any).id,
      code: JSON.stringify(registrationResponse),
    })

    if (verifyError) {
      console.error("registerPasskey verify failed:", verifyError.message)
      return { success: false, message: "Passkey verification failed." }
    }

    console.log("Passkey registered successfully")
    return { success: true, message: "Passkey registered." }
  } catch (err: any) {
    if (err?.name === "NotAllowedError") {
      return { success: false, message: "Passkey registration cancelled." }
    }
    console.error("registerPasskey error:", err)
    return { success: false, message: "Passkey registration failed." }
  }
}

/**
 * Sign in with a passkey.
 * Called when user enters EEID and has a registered passkey.
 */
export async function signInWithPasskey(
  eeid: string
): Promise<Profile | null> {
  try {
    // Step 1: Get profile to find org and construct email
    const profile = await fetchProfileByEeid(eeid)
    if (!profile) return null

    const welcomePhrase = profile.org_id
      ? await fetchWelcomePhraseForOrg(profile.org_id)
      : null
    buildSyntheticEmail(eeid, welcomePhrase) // side effect: logs synthetic email for debugging

    // Step 2: Use MFA challenge approach
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const webauthnFactor = factors?.all?.find(f => f.factor_type === "webauthn")

    if (!webauthnFactor) {
      console.log("signInWithPasskey: no passkey enrolled for this user")
      return null
    }

    // Step 3: Create challenge
    const { data: challengeRes, error: challengeErr } =
      await supabase.auth.mfa.challenge({ factorId: webauthnFactor.id })

    if (challengeErr || !challengeRes) {
      console.error("signInWithPasskey challenge failed:", challengeErr?.message)
      return null
    }

    // Step 4: Trigger browser biometric
    const authResponse = await startAuthentication({
      optionsJSON: ((challengeRes as any).webauthn ?? challengeRes) as any,
    })

    // Step 5: Verify with Supabase
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: webauthnFactor.id,
      challengeId: challengeRes.id,
      code: JSON.stringify(authResponse),
    })

    if (verifyError) {
      console.error("signInWithPasskey verify failed:", verifyError.message)
      return null
    }

    return fetchProfileByEeid(eeid)
  } catch (err: any) {
    if (err?.name === "NotAllowedError") {
      console.log("signInWithPasskey: user cancelled biometric")
      return null
    }
    console.error("signInWithPasskey error:", err)
    return null
  }
}

/**
 * Check if the current user has a passkey enrolled.
 */
export async function hasPasskeyEnrolled(): Promise<boolean> {
  const { data } = await supabase.auth.mfa.listFactors()
  return (data?.all ?? []).some(f => f.factor_type === "webauthn")
}

/**
 * Remove all enrolled passkeys for the current user.
 */
export async function removePasskeys(): Promise<boolean> {
  const { data } = await supabase.auth.mfa.listFactors()
  const webauthnFactors = (data?.all ?? []).filter(f => f.factor_type === "webauthn")

  for (const factor of webauthnFactors) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
    if (error) {
      console.error("removePasskeys failed:", error.message)
      return false
    }
  }
  return true
}

// â”€â”€ Station â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Infer shift bucket from a start time string.
 * Used as fallback when schedule_entries.shift_bucket is null.
 */
function inferShiftBucket(
  startTime: string
): "6a-2p" | "2p-10p" | "10p-6a" {
  const hour = startTime.includes("T")
    ? new Date(startTime).getHours()
    : parseInt(startTime.split(":")[0])

  if (hour >= 6 && hour < 14) return "6a-2p"
  if (hour >= 14 && hour < 22) return "2p-10p"
  return "10p-6a"
}

export async function claimStation(
  associateId: string,
  storeId: string,
  station: string
): Promise<boolean> {
  // Update current_archetype on associate row for realtime notifications
  await supabase
    .from("associates")
    .update({ current_archetype: station })
    .eq("id", associateId)

  // Look up today's schedule entry for this associate
  const today = new Date().toISOString().split("T")[0]

  const { data: scheduleEntry } = await supabase
    .from("schedule_entries")
    .select("start_time, end_time, shift_bucket")
    .eq("associate_id", associateId)
    .eq("store_id", storeId)
    .eq("shift_date", today)
    .maybeSingle()

  // Calculate TTL:
  // If schedule entry exists â†’ use end_time + 30min buffer
  // If no schedule entry â†’ fall back to 10 hours from now
  let expiresAt: string
  let scheduledEndTime: string | null = null
  let shiftBucket: string | null = null

  if (scheduleEntry?.end_time) {
    const [hours, mins] = scheduleEntry.end_time.split(":").map(Number)
    const endTime = new Date()
    endTime.setHours(hours, mins, 0, 0)

    // Handle midnight wrap
    if (scheduleEntry.start_time) {
      const [sHours] = scheduleEntry.start_time.split(":").map(Number)
      if (sHours > hours) endTime.setDate(endTime.getDate() + 1)
    }

    endTime.setMinutes(endTime.getMinutes() + 30) // 30min buffer
    expiresAt = endTime.toISOString()

    const schedEnd = new Date()
    schedEnd.setHours(hours, mins, 0, 0)
    if (scheduleEntry.start_time) {
      const [sHours] = scheduleEntry.start_time.split(":").map(Number)
      if (sHours > hours) schedEnd.setDate(schedEnd.getDate() + 1)
    }
    scheduledEndTime = schedEnd.toISOString()

    shiftBucket = scheduleEntry.shift_bucket ?? inferShiftBucket(scheduleEntry.start_time)
  } else {
    // Fallback â€” 10 hours from now
    expiresAt = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString()
  }

  // Upsert active shift
  const { error } = await supabase
    .from("active_shifts")
    .upsert({
      associate_id: associateId,
      store_id: storeId,
      station,
      is_active: true,
      expires_at: expiresAt,
      scheduled_end_time: scheduledEndTime,
      shift_bucket: shiftBucket,
      original_end_time: scheduledEndTime, // preserve original for extension tracking
    }, { onConflict: "associate_id,store_id" })

  return !error
}

// â”€â”€ Tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchTasksForAssociate(
  storeId: string,
  archetype: string,
  associateName: string
): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("store_id", storeId)
    .eq("is_completed", false)
    .eq("is_orphaned", false)
    .or(`archetype.eq.${archetype},assigned_to.eq.${associateName}`)
    .order("priority", { ascending: false })

  if (error) {
    console.error("fetchTasksForAssociate failed:", error.message)
    return []
  }

  const allTasks = data ?? []

  // Fetch completed task IDs to check dependencies against
  const { data: completedData } = await supabase
    .from("tasks")
    .select("id")
    .eq("store_id", storeId)
    .eq("is_completed", true)

  const allCompletedIds = new Set([
    ...(completedData ?? []).map(t => t.id),
    ...allTasks
      .filter(t => t.pending_verification)
      .map(t => t.id),
  ])

  // Filter out tasks whose dependency hasn't been completed yet
  return allTasks.filter(task => {
    const depId = (task as any).depends_on_task_id
    if (!depId) return true
    return allCompletedIds.has(depId)
  })
}

export async function fetchTasksForSupervisor(storeId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("store_id", storeId)
    .eq("is_completed", false)
    .order("priority", { ascending: false })

  if (error) {
    console.error("fetchTasksForSupervisor failed:", error.message)
    return []
  }
  return data ?? []
}

/**
 * Escalation Engine â€” runs after expireStaleShifts
 * Finds tasks assigned to associates whose sessions just expired,
 * clears the assignee, bumps priority to Critical, sets is_orphaned = true
 */
export async function orphanTasksForExpiredSessions(
  storeId: string,
  expiredAssociateIds: string[]
): Promise<number> {
  if (expiredAssociateIds.length === 0) return 0

  // Get names of expired associates to match against assigned_to
  const { data: associates } = await supabase
    .from("associates")
    .select("name")
    .in("id", expiredAssociateIds)

  if (!associates || associates.length === 0) return 0

  const names = associates.map(a => a.name)

  // Find tasks assigned to these associates that are not yet complete
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, task_name, assigned_to")
    .eq("store_id", storeId)
    .eq("is_completed", false)
    .in("assigned_to", names)

  if (!tasks || tasks.length === 0) return 0

  const taskIds = tasks.map(t => t.id)

  // Orphan them: clear assignee, bump to Critical, set orphaned flag
  const { error } = await supabase
    .from("tasks")
    .update({
      assigned_to: null,
      priority: "Critical",
      is_orphaned: true,
      pending_verification: false,
    })
    .in("id", taskIds)

  if (error) {
    console.error("orphanTasksForExpiredSessions failed:", error.message)
    return 0
  }

  console.log(`Escalation Engine: ${tasks.length} task(s) orphaned from expired sessions`)
  tasks.forEach(t => console.log(`  â†‘ "${t.task_name}" (was assigned to ${t.assigned_to})`))

  return tasks.length
}

export async function fetchOrphanedTasks(storeId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("store_id", storeId)
    .eq("is_orphaned", true)
    .eq("is_completed", false)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("fetchOrphanedTasks failed:", error.message)
    return []
  }
  return data ?? []
}

export async function clearOrphanFlag(taskId: string): Promise<boolean> {
  const { error } = await supabase
    .from("tasks")
    .update({ is_orphaned: false })
    .eq("id", taskId)

  if (error) {
    console.error("clearOrphanFlag failed:", error.message)
    return false
  }
  return true
}

export async function fetchPendingVerificationTasks(storeId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("store_id", storeId)
    .eq("pending_verification", true)
    .eq("is_completed", false)

  if (error) {
    console.error("fetchPendingVerificationTasks failed:", error.message)
    return []
  }
  return data ?? []
}

export async function markTaskPendingVerification(
  taskId: string,
  completedBy: string
): Promise<boolean> {
  const { data: task } = await supabase
    .from("tasks")
    .select("store_id, base_points, assigned_to_associate_id")
    .eq("id", taskId)
    .maybeSingle()

  const { error } = await (supabase as any)
    .from("tasks")
    .update({ 
      pending_verification: true, 
      completed_by: completedBy,
      completed_at: new Date().toISOString()
    })
    .eq("id", taskId)

  if (error) {
    console.error("markTaskPendingVerification failed:", error.message)
    return false
  }

  if (task?.store_id && task?.assigned_to_associate_id) {
    await logPoints(
      task.store_id,
      task.assigned_to_associate_id,
      task.base_points ?? 10,
      "task_complete",
      taskId
    )
  }

  return true
}

export async function verifyTaskComplete(taskId: string): Promise<boolean> {
  const { data: task } = await supabase
    .from("tasks")
    .select("store_id, base_points, assigned_to_associate_id")
    .eq("id", taskId)
    .maybeSingle()

  const { error } = await (supabase as any)
    .from("tasks")
    .update({ 
      is_completed: true, 
      pending_verification: false,
      completed_at: new Date().toISOString()
    })
    .eq("id", taskId)

  if (error) {
    console.error("verifyTaskComplete failed:", error.message)
    return false
  }

  if (task?.store_id && task?.assigned_to_associate_id) {
    const points = Math.round((task.base_points ?? 10) * 1.5)
    await logPoints(
      task.store_id,
      task.assigned_to_associate_id,
      points,
      "task_verified",
      taskId
    )
  }

  return true
}

export async function rejectTaskCompletion(taskId: string): Promise<boolean> {
  const { error } = await supabase
    .from("tasks")
    .update({ pending_verification: false, completed_by: null })
    .eq("id", taskId)

  if (error) {
    console.error("rejectTaskCompletion failed:", error.message)
    return false
  }
  return true
}

// â”€â”€ Flip Checklists (table_items) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchTableItemsByStation(
  storeId: string,
  station: string
): Promise<TableItem[]> {
  const { data, error } = await supabase
    .from("table_items")
    .select("*")
    .eq("store_id", storeId)
    .eq("station", station)

  if (error) {
    console.error("fetchTableItemsByStation failed:", error.message)
    return []
  }
  return data ?? []
}

export async function flagTableItem(
  itemId: string,
  initialed: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from("table_items")
    .update({ is_initialed: initialed })
    .eq("id", itemId)

  if (error) {
    console.error("flagTableItem failed:", error.message)
    return false
  }
  return true
}

// â”€â”€ Pull Lists (inventory_items) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchInventoryByCategory(
  storeId: string,
  category: string
): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("store_id", storeId)
    .eq("category", category)
    .order("item_name")

  if (error) {
    console.error("fetchInventoryByCategory failed:", error.message)
    return []
  }
  return data ?? []
}

export async function updateInventoryAmountHave(
  itemId: string,
  amountHave: number
): Promise<boolean> {
  const { error } = await supabase
    .from("inventory_items")
    .update({ amount_have: amountHave })
    .eq("id", itemId)

  if (error) {
    console.error("updateInventoryAmountHave failed:", error.message)
    return false
  }
  return true
}

// â”€â”€ Shift Reset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function resetShiftTasks(storeId: string): Promise<number> {
  const { data, error } = await supabase
    .from("tasks")
    .update({
      is_completed: false,
      pending_verification: false,
      is_orphaned: false,
      completed_by: null,
    })
    .eq("store_id", storeId)
    .select()

  if (error) {
    console.error("resetShiftTasks failed:", error.message)
    return 0
  }
  return data?.length ?? 0
}

export async function resetFlipChecklists(storeId: string): Promise<number> {
  const { data, error } = await supabase
    .from("table_items")
    .update({ is_initialed: true })
    .eq("store_id", storeId)
    .select()

  if (error) {
    console.error("resetFlipChecklists failed:", error.message)
    return 0
  }
  return data?.length ?? 0
}

export async function closeAllActiveShifts(storeId: string): Promise<number> {
  const { data, error } = await supabase
    .from("active_shifts")
    .update({ is_active: false })
    .eq("store_id", storeId)
    .eq("is_active", true)
    .select()

  if (error) {
    console.error("closeAllActiveShifts failed:", error.message)
    return 0
  }
  return data?.length ?? 0
}

export async function startShift(storeId: string): Promise<{
  tasksReset: number
  itemsReset: number
  shiftsClosed: number
}> {
  const [tasksReset, itemsReset, shiftsClosed] = await Promise.all([
    resetShiftTasks(storeId),
    resetFlipChecklists(storeId),
    closeAllActiveShifts(storeId),
  ])

  console.log(`Shift started: ${tasksReset} tasks reset, ${itemsReset} flip items reset, ${shiftsClosed} active shifts closed`)

  return { tasksReset, itemsReset, shiftsClosed }
}

// â”€â”€ Pull Workflow & Code Tracking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Called when an associate confirms a bread pull is complete.
 * Creates pull_event rows for each item that was actually pulled (quantity > 0).
 */
export async function confirmPull(
  storeId: string,
  items: Array<{
    itemId: string
    itemName: string
    category: string
    quantityPulled: number
    codeLifeDays: number
  }>
): Promise<boolean> {
  const today = new Date()
  const pulledDate = today.toISOString().split("T")[0]

  const events = items
    .filter(item => item.quantityPulled > 0 && item.codeLifeDays > 0)
    .map(item => {
      const expires = new Date(today)
      expires.setDate(expires.getDate() + item.codeLifeDays)

      return {
        store_id: storeId,
        item_id: item.itemId,
        item_name: item.itemName,
        category: item.category,
        quantity_pulled: item.quantityPulled,
        pulled_date: pulledDate,
        expires_date: expires.toISOString().split("T")[0],
      }
    })

  if (events.length === 0) return true

  const { error } = await supabase
    .from("pull_events")
    .insert(events)

  if (error) {
    console.error("confirmPull failed:", error.message)
    return false
  }

  console.log(`Pull confirmed: ${events.length} pull events created`)
  return true
}

/**
 * Fetch pull events expiring on or before today.
 * Groups by item, calculates rolling math to determine if used through.
 */
export async function fetchExpiringPullEvents(
  storeId: string
): Promise<PullEventSummary[]> {
  const today = new Date().toISOString().split("T")[0]

  // Fetch expiring events
  const { data: expiring, error: expiringError } = await supabase
    .from("pull_events")
    .select("*")
    .eq("store_id", storeId)
    .lte("expires_date", today)
    .eq("is_verified", false)

  if (expiringError || !expiring || expiring.length === 0) return []

  // For each unique item, calculate total pulled in the code window
  const itemIds = [...new Set(expiring.map(e => e.item_id))]

  const summaries: PullEventSummary[] = []

  for (const itemId of itemIds) {
    const itemEvents = expiring.filter(e => e.item_id === itemId)
    const firstEvent = itemEvents[0]

    // Get the build_to (amount_needed) for this item
    const { data: inventoryItem } = await supabase
      .from("inventory_items")
      .select("amount_needed, code_life_days")
      .eq("id", itemId)
      .maybeSingle()

    const buildTo = inventoryItem?.amount_needed ?? 0
    const codeLifeDays = inventoryItem?.code_life_days ?? 3

    // Total pulled in the full code window (not just expiring events)
    const windowStart = new Date(firstEvent.expires_date)
    windowStart.setDate(windowStart.getDate() - codeLifeDays)
    const windowStartStr = windowStart.toISOString().split("T")[0]

    const { data: windowEvents } = await supabase
      .from("pull_events")
      .select("quantity_pulled")
      .eq("store_id", storeId)
      .eq("item_id", itemId)
      .gte("pulled_date", windowStartStr)
      .lte("pulled_date", today)

    const totalPulled = (windowEvents ?? []).reduce(
      (sum, e) => sum + e.quantity_pulled, 0
    )

    // If total pulled >= build_to, likely used through
    const likelyUsedThrough = totalPulled >= buildTo

    summaries.push({
      itemId,
      itemName: firstEvent.item_name,
      category: firstEvent.category,
      expiresDate: firstEvent.expires_date,
      totalPulled,
      buildTo,
      likelyUsedThrough,
      pullEventIds: itemEvents.map(e => e.id),
    })
  }

  return summaries
}

/**
 * Mark expiring pull events as verified (used through â€” no waste).
 */
export async function verifyPullEventsUsedThrough(
  pullEventIds: string[]
): Promise<boolean> {
  const { error } = await supabase
    .from("pull_events")
    .update({ is_verified: true })
    .in("id", pullEventIds)

  if (error) {
    console.error("verifyPullEventsUsedThrough failed:", error.message)
    return false
  }
  return true
}

/**
 * Record waste for pull events that were NOT fully used through.
 * Creates a waste confirmation task.
 */
export async function recordPullWaste(
  storeId: string,
  pullEventIds: string[],
  itemName: string,
  wasteQuantity: number
): Promise<boolean> {
  // Mark pull events with waste quantity
  const { error: updateError } = await supabase
    .from("pull_events")
    .update({
      is_verified: true,
      waste_quantity: wasteQuantity,
    })
    .in("id", pullEventIds)

  if (updateError) {
    console.error("recordPullWaste update failed:", updateError.message)
    return false
  }

  // Create a waste confirmation task
  const { error: taskError } = await supabase
    .from("tasks")
    .insert({
      store_id: storeId,
      task_name: `Waste Sheet: ${wasteQuantity}x ${itemName}`,
      archetype: "MOD",
      priority: "High",
      is_sticky: false,
      expected_minutes: 5,
      base_points: 10,
      is_completed: false,
      is_pull_task: false,
      is_truck_task: false,
      task_description: `Record ${wasteQuantity} unit(s) of ${itemName} on the waste sheet and confirm.`,
    })

  if (taskError) {
    console.error("recordPullWaste task creation failed:", taskError.message)
    return false
  }

  return true
}

/**
 * Check if there are any expiring pull events for today.
 * Used to show/hide the Code Check task.
 */
export async function hasExpiringPullEvents(storeId: string): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0]

  const { count, error } = await supabase
    .from("pull_events")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId)
    .lte("expires_date", today)
    .eq("is_verified", false)

  if (error) return false
  return (count ?? 0) > 0
}

function getCurrentShiftBucket(): "6a-2p" | "2p-10p" | "10p-6a" {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 14) return "6a-2p"
  if (hour >= 14 && hour < 22) return "2p-10p"
  return "10p-6a"
}

// â”€â”€ JIT Task Creation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function createJitTask(
  storeId: string,
  taskName: string,
  archetype: string,
  priority: string,
  isCrossShiftCritical: boolean = false
): Promise<Task | null> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      store_id: storeId,
      task_name: taskName,
      archetype,
      priority,
      is_sticky: false,
      is_completed: false,
      is_orphaned: false,
      pending_verification: false,
      base_points: 10,
      is_pull_task: false,
      is_truck_task: false,
      shift_bucket: getCurrentShiftBucket(),
      lifecycle_state: "active",
      is_cross_shift_critical: isCrossShiftCritical,
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error("createJitTask failed:", error.message)
    return null
  }
  return data
}

// â”€â”€ Task Queue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Fetch the next task in an associate's personal queue.
 * Returns the lowest queue_position task assigned to this associate.
 */
export async function fetchNextQueuedTask(
  storeId: string,
  associateId: string
): Promise<Task | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("store_id", storeId)
    .eq("assigned_to_associate_id", associateId)
    .eq("is_completed", false)
    .eq("pending_verification", false)
    .not("queue_position", "is", null)
    .order("queue_position", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("fetchNextQueuedTask failed:", error.message)
    return null
  }
  return data
}

/**
 * Assign a task to an associate with a queue position.
 */
export async function assignTaskToAssociate(
  taskId: string,
  associateId: string,
  associateName: string,
  queuePosition: number
): Promise<boolean> {
  const { error } = await supabase
    .from("tasks")
    .update({
      assigned_to_associate_id: associateId,
      assigned_to: associateName,
      queue_position: queuePosition,
    })
    .eq("id", taskId)

  if (error) {
    console.error("assignTaskToAssociate failed:", error.message)
    return false
  }
  return true
}

/**
 * Fetch all queued tasks for an associate (supervisor view).
 */
export async function fetchAssociateTaskQueue(
  storeId: string,
  associateId: string
): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("store_id", storeId)
    .eq("assigned_to_associate_id", associateId)
    .eq("is_completed", false)
    .not("queue_position", "is", null)
    .order("queue_position", { ascending: true })

  if (error) {
    console.error("fetchAssociateTaskQueue failed:", error.message)
    return []
  }
  return data ?? []
}

/**
 * Fetch active shifts with their associates' current queued task.
 * Used for "Who's working with me?" panel.
 */
export async function fetchActiveShiftsWithCurrentTask(
  storeId: string,
  excludeAssociateId?: string
): Promise<Array<{
  associateId: string
  associateName: string
  station: string
  currentTask: string | null
  isExtended: boolean
}>> {
  const { data: shifts, error } = await (supabase as any).from("active_shifts").select("associate_id, station, is_extended, associates(id, name)")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .gt("expires_at", new Date().toISOString())

  if (error || !shifts) return []

  const results = await Promise.all(
    shifts
      .filter((s: any) => s.associate_id !== excludeAssociateId)
      .map(async (shift: any) => {
        const assoc = (shift as any).associates

        // Get their next queued task
        const { data: nextTask } = await supabase
          .from("tasks")
          .select("task_name")
          .eq("store_id", storeId)
          .eq("assigned_to_associate_id", shift.associate_id)
          .eq("is_completed", false)
          .not("queue_position", "is", null)
          .order("queue_position", { ascending: true })
          .limit(1)
          .maybeSingle()

        return {
          associateId: shift.associate_id,
          associateName: assoc?.name ?? "Unknown",
          station: shift.station ?? "Unknown",
          currentTask: nextTask?.task_name ?? null,
          isExtended: !!shift.is_extended,
        }
      })
  )

  return results
}

// â”€â”€ Schedule â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchScheduleForStore(
  storeId: string,
  date?: string
): Promise<ScheduleEntry[]> {
  let query = supabase
    .from("schedule_entries")
    .select("*, associates(id, name, current_archetype, role)")
    .eq("store_id", storeId)

  if (date) {
    query = query.eq("shift_date", date)
  }

  const { data, error } = await query

  if (error) {
    console.error("fetchScheduleForStore failed:", error.message)
    return []
  }
  return (data ?? []) as unknown as ScheduleEntry[]
}

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

export async function createDistrict(
  orgId: string,
  name: string
): Promise<string | null> {
  const db = supabase as any
  const { data, error } = await db
    .from("districts")
    .insert({ org_id: orgId, name })
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

// â”€â”€ Password Reset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function resetAssociatePassword(
  authUid: string,
  newPassword: string
): Promise<boolean> {
  const { error } = await (supabase.auth as any).admin.updateUserById(authUid, {
    password: newPassword,
  })

  if (error) {
    console.error("resetAssociatePassword failed:", error.message)
    return false
  }
  return true
}

export function generateTempPassword(): string {
  const words = ["Shift", "Floor", "Akyra", "Squad", "Store", "Team", "Work"]
  const word = words[Math.floor(Math.random() * words.length)]
  const num = Math.floor(Math.random() * 900) + 100
  return `${word}${num}!`
}

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

export async function fetchOrgBranding(orgId: string): Promise<import("../types").OrgBranding | null> {
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
  orgBranding: import("../types").OrgBranding | null
): string {
  if (!orgBranding) return role
  const roles = orgBranding.terminology.roles as Record<string, string>
  return roles[role] ?? role
}

export async function fetchOrgStations(orgId: string): Promise<import("../types").OrgStation[]> {
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

// â”€â”€ Station Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function createOrgStation(
  orgId: string,
  station: Omit<import("../types").OrgStation, "id" | "orgId">
): Promise<boolean> {
  const { error } = await supabase
    .from("org_stations")
    .insert({
      org_id: orgId,
      name: station.name,
      emoji: station.emoji,
      description: station.description,
      is_supervisor_only: station.isSupervisorOnly,
      is_float: station.isFloat,
      display_order: station.displayOrder,
    })

  if (error) {
    console.error("createOrgStation failed:", error.message)
    return false
  }
  return true
}

export async function updateOrgStation(
  stationId: string,
  updates: Partial<Omit<import("../types").OrgStation, "id" | "orgId">>
): Promise<boolean> {
  type OrgStationUpdate = Database["public"]["Tables"]["org_stations"]["Update"]
  const update: OrgStationUpdate = {}
  if (updates.name !== undefined) update.name = updates.name
  if (updates.emoji !== undefined) update.emoji = updates.emoji
  if (updates.description !== undefined) update.description = updates.description
  if (updates.isSupervisorOnly !== undefined) update.is_supervisor_only = updates.isSupervisorOnly
  if (updates.isFloat !== undefined) update.is_float = updates.isFloat
  if (updates.displayOrder !== undefined) update.display_order = updates.displayOrder

  const { error } = await supabase
    .from("org_stations")
    .update(update)
    .eq("id", stationId)

  if (error) {
    console.error("updateOrgStation failed:", error.message)
    return false
  }
  return true
}

export async function deleteOrgStation(stationId: string): Promise<boolean> {
  const { error } = await supabase
    .from("org_stations")
    .delete()
    .eq("id", stationId)

  if (error) {
    console.error("deleteOrgStation failed:", error.message)
    return false
  }
  return true
}

export async function reorderOrgStations(
  stations: Array<{ id: string; displayOrder: number }>
): Promise<boolean> {
  for (const s of stations) {
    await supabase
      .from("org_stations")
      .update({ display_order: s.displayOrder })
      .eq("id", s.id)
  }
  return true
}

// â”€â”€ Equipment Issues (The Black Box) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchEquipmentIssues(storeId: string): Promise<EquipmentIssue[]> {
  const { data, error } = await supabase
    .from("equipment_issues")
    .select("*, associates!reported_by_associate_id(name)")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("fetchEquipmentIssues failed:", error.message)
    return []
  }
  return data ?? []
}

export async function createEquipmentIssue(
  storeId: string,
  reportedAtStoreId: string,
  associateId: string,
  category: string,
  description: string,
  photoFile?: File
): Promise<EquipmentIssue | null> {
  let photoUrl: string | null = null

  // Upload photo if provided
  if (photoFile) {
    const fileName = `${storeId}/${Date.now()}-${photoFile.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("equipment-photos")
      .upload(fileName, photoFile, { upsert: false })

    if (uploadError) {
      console.error("Photo upload failed:", uploadError.message)
    } else {
      const { data: urlData } = supabase.storage
        .from("equipment-photos")
        .getPublicUrl(uploadData.path)
      photoUrl = urlData.publicUrl
    }
  }

  const { data, error } = await supabase
    .from("equipment_issues")
    .insert({
      store_id: storeId,
      reported_at_store_id: reportedAtStoreId,
      reported_by_associate_id: associateId || null,
      category,
      description,
      photo_url: photoUrl,
      status: "New",
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error("createEquipmentIssue failed:", error.message)
    return null
  }
  return data
}

export async function updateEquipmentIssueStatus(
  issueId: string,
  status: "New" | "Pending" | "Resolved",
  resolvedByAssociateId?: string
): Promise<boolean> {
  type EquipmentIssueUpdate = Database["public"]["Tables"]["equipment_issues"]["Update"]
  const update: EquipmentIssueUpdate = { status }

  if (status === "Resolved" && resolvedByAssociateId) {
    update.resolved_by_associate_id = resolvedByAssociateId
    update.resolved_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from("equipment_issues")
    .update(update)
    .eq("id", issueId)

  if (error) {
    console.error("updateEquipmentIssueStatus failed:", error.message)
    return false
  }
  return true
}

// â”€â”€ Assistance Requests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function createAssistanceRequest(
  storeId: string,
  taskId: string,
  associateId: string,
  level: 1 | 2
): Promise<string | null> {
  const supervisorCode = level === 2
    ? Math.random().toString(36).substring(2, 8).toUpperCase()
    : null

  const { data, error } = await supabase
    .from("assistance_requests")
    .insert({
      store_id: storeId,
      task_id: taskId,
      requested_by_associate_id: associateId,
      request_level: level,
      supervisor_code: supervisorCode,
    })
    .select("id, supervisor_code")
    .maybeSingle()

  if (error) {
    console.error("createAssistanceRequest failed:", error.message)
    return null
  }

  await supabase
    .from("tasks")
    .update({ priority: level === 2 ? "Critical" : "High" })
    .eq("id", taskId)

  return data?.id ?? null
}

export async function fetchActiveAssistanceRequests(
  storeId: string
): Promise<Array<{
  id: string
  taskId: string
  taskName: string
  associateName: string
  level: number
  supervisorCode: string | null
  createdAt: string
}>> {
  const { data, error } = await supabase
    .from("assistance_requests")
    .select(`
      id,
      request_level,
      supervisor_code,
      created_at,
      tasks!task_id(task_name),
      associates!requested_by_associate_id(name)
    `)
    .eq("store_id", storeId)
    .eq("is_resolved", false)
    .order("created_at", { ascending: false })

  if (error || !data) return []

  return data.map(r => ({
    id: r.id,
    taskId: (r as any).tasks?.id ?? "",
    taskName: (r as any).tasks?.task_name ?? "Unknown task",
    associateName: (r as any).associates?.name ?? "Unknown",
    level: r.request_level,
    supervisorCode: r.supervisor_code,
    createdAt: r.created_at,
  }))
}

export async function resolveAssistanceRequest(
  requestId: string,
  resolvedByAssociateId: string,
  supervisorCode?: string
): Promise<{ success: boolean; message: string }> {
  const { data: request } = await supabase
    .from("assistance_requests")
    .select("supervisor_code, request_level")
    .eq("id", requestId)
    .maybeSingle()

  if (!request) return { success: false, message: "Request not found" }

  if (request.request_level === 2 && request.supervisor_code !== supervisorCode) {
    return { success: false, message: "Invalid code" }
  }

  const { error } = await supabase
    .from("assistance_requests")
    .update({
      is_resolved: true,
      resolved_by_associate_id: resolvedByAssociateId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", requestId)

  if (error) return { success: false, message: error.message }
  return { success: true, message: "Resolved" }
}

// â”€â”€ Leading By Exception â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function startTaskTimer(taskId: string): Promise<boolean> {
  const { error } = await supabase
    .from("tasks")
    .update({ started_at: new Date().toISOString() })
    .eq("id", taskId)
    .is("started_at", null) // only set if not already started

  if (error) {
    console.error("startTaskTimer failed:", error.message)
    return false
  }
  return true
}

export async function calculateTaskDelta(
  taskId: string
): Promise<{ deltaPct: number; actualMinutes: number; expectedMinutes: number } | null> {
  const { data: task } = await supabase
    .from("tasks")
    .select("started_at, expected_minutes, task_name")
    .eq("id", taskId)
    .maybeSingle()

  if (!task?.started_at || !task?.expected_minutes) return null

  const startedAt = new Date(task.started_at)
  const now = new Date()
  const actualMinutes = Math.round((now.getTime() - startedAt.getTime()) / 60000)
  const expectedMinutes = task.expected_minutes
  const deltaPct = ((actualMinutes - expectedMinutes) / expectedMinutes) * 100

  return { deltaPct, actualMinutes, expectedMinutes }
}

export async function createTaskVerification(
  storeId: string,
  taskId: string,
  associateId: string,
  expectedMinutes: number,
  actualMinutes: number,
  deltaPct: number,
  triggerType: "fast" | "slow"
): Promise<string | null> {
  const { data, error } = await supabase
    .from("task_verifications")
    .insert({
      store_id: storeId,
      task_id: taskId,
      associate_id: associateId,
      expected_minutes: expectedMinutes,
      actual_minutes: actualMinutes,
      delta_pct: deltaPct,
      trigger_type: triggerType,
      status: triggerType === "fast" ? "pending_associate_photo" : "resolved_slow",
    })
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("createTaskVerification failed:", error.message)
    return null
  }
  return data?.id ?? null
}

export async function submitAssociatePhoto(
  verificationId: string,
  photoUrl: string
): Promise<boolean> {
  const { error } = await supabase
    .from("task_verifications")
    .update({
      associate_photo_url: photoUrl,
      status: "pending_supervisor",
    })
    .eq("id", verificationId)

  if (error) {
    console.error("submitAssociatePhoto failed:", error.message)
    return false
  }
  return true
}

export async function supervisorReviewVerification(
  verificationId: string,
  supervisorId: string,
  verdict: "accepted" | "rejected",
  photoUrl: string | null,
  rejectionReason?: string
): Promise<boolean> {
  type TVUpdate = Database["public"]["Tables"]["task_verifications"]["Update"]
  const update: TVUpdate = {
    supervisor_id: supervisorId,
    supervisor_verdict: verdict,
    supervisor_photo_url: photoUrl,
    status: verdict === "accepted" ? "resolved_accepted" : "pending_associate_response",
  }

  if (verdict === "rejected" && rejectionReason) {
    update.rejection_reason = rejectionReason
  }

  if (verdict === "accepted") {
    update.resolved_at = new Date().toISOString()
    // Generate time suggestion
    const { data: verification } = await supabase
      .from("task_verifications")
      .select("task_id, actual_minutes, expected_minutes, store_id")
      .eq("id", verificationId)
      .maybeSingle()

    if (verification) {
      const suggestedMinutes = Math.round(
        (verification.actual_minutes + verification.expected_minutes) / 2
      )
      await supabase.from("task_time_suggestions").upsert({
        store_id: verification.store_id,
        task_id: verification.task_id,
        task_name: "",
        current_expected_minutes: verification.expected_minutes,
        suggested_minutes: suggestedMinutes,
        avg_actual_minutes: verification.actual_minutes,
        sample_count: 1,
      }, { onConflict: "store_id,task_id,is_reviewed", ignoreDuplicates: false })
    }
  }

  const { error } = await supabase
    .from("task_verifications")
    .update(update)
    .eq("id", verificationId)

  return !error
}

export async function associateRespondToRejection(
  verificationId: string,
  response: "verify_retry" | "challenge"
): Promise<boolean> {
  type TVUpdate = Database["public"]["Tables"]["task_verifications"]["Update"]
  const update: TVUpdate = {
    associate_response: response,
    status: response === "verify_retry" ? "resolved_retry" : "pending_store_manager",
    challenge_submitted: response === "challenge",
  }

  if (response === "verify_retry") {
    update.resolved_at = new Date().toISOString()
    // Reopen the task
    const { data: v } = await supabase
      .from("task_verifications")
      .select("task_id")
      .eq("id", verificationId)
      .maybeSingle()
    if (v) {
      await supabase.from("tasks")
        .update({ pending_verification: false, completed_by: null, started_at: null })
        .eq("id", v.task_id)
    }
  }

  const { error } = await supabase
    .from("task_verifications")
    .update(update)
    .eq("id", verificationId)

  return !error
}

export async function fetchPendingVerificationsForSupervisor(
  storeId: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from("task_verifications")
    .select(`
      *,
      tasks!task_id(task_name),
      associates!associate_id(name)
    `)
    .eq("store_id", storeId)
    .eq("status", "pending_supervisor")
    .order("created_at", { ascending: false })

  if (error) return []
  return data ?? []
}

export async function fetchChallengedTasksForStoreManager(
  storeId: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from("task_verifications")
    .select(`
      *,
      tasks!task_id(task_name),
      associates!associate_id(name)
    `)
    .eq("store_id", storeId)
    .eq("challenge_submitted", true)
    .eq("challenge_resolved", false)
    .order("created_at", { ascending: false })

  if (error) return []
  return data ?? []
}

// â”€â”€ Points Engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function logPoints(
  storeId: string,
  associateId: string,
  points: number,
  reason: "task_complete" | "task_verified" | "assist_given" | "kill_leader" | "mvp" | "challenge_vindicated" | "desync_cleared",
  taskId?: string
): Promise<void> {
  await (supabase as any).from("points_log").insert({
    store_id: storeId,
    associate_id: associateId,
    points,
    reason,
    task_id: taskId ?? null,
    shift_date: new Date().toISOString().split("T")[0],
  })
}

// â”€â”€ Challenge Pattern Tracking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function trackChallengePattern(params: {
  storeId: string
  taskId: string
  taskName: string
  associateId: string
  associateName: string
  supervisorId: string | null
  supervisorName: string | null
  patternType: "associate_task" | "supervisor_task" | "associate_supervisor"
}): Promise<void> {
  const { data: store } = await (supabase as any)
    .from("stores")
    .select("org_id, district_id")
    .eq("id", params.storeId)
    .maybeSingle()

  let query = (supabase as any)
    .from("challenge_patterns")
    .select("id, challenge_count")
    .eq("store_id", params.storeId)
    .eq("pattern_type", params.patternType)
    .eq("is_resolved", false)
    .gt("window_end", new Date().toISOString().split("T")[0])

  if (params.patternType === "associate_task") {
    query = query.eq("associate_id", params.associateId).eq("task_id", params.taskId)
  } else if (params.patternType === "supervisor_task") {
    query = query.eq("supervisor_id", params.supervisorId).eq("task_id", params.taskId)
  } else {
    query = query.eq("associate_id", params.associateId).eq("supervisor_id", params.supervisorId)
  }

  const { data: existing } = await query.maybeSingle()

  if (existing) {
    const newCount = existing.challenge_count + 1
    const flagLevel =
      params.patternType === "associate_task"
        ? newCount >= 3 ? "retrain" : "watch"
        : params.patternType === "supervisor_task"
        ? newCount >= 2 ? "sop_review" : "watch"
        : newCount >= 3 ? "bias_review" : "watch"

    await (supabase as any)
      .from("challenge_patterns")
      .update({ challenge_count: newCount, flag_level: flagLevel, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
  } else {
    await (supabase as any).from("challenge_patterns").insert({
      store_id: params.storeId,
      org_id: store?.org_id ?? "",
      district_id: store?.district_id ?? null,
      task_id: params.taskId,
      task_name: params.taskName,
      associate_id: params.associateId,
      associate_name: params.associateName,
      supervisor_id: params.supervisorId,
      supervisor_name: params.supervisorName,
      pattern_type: params.patternType,
      challenge_count: 1,
      flag_level: "watch",
    })
  }
}

// â”€â”€ Desync Check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function checkAndApplyDesync(
  storeId: string,
  associateId: string,
  associateName: string
): Promise<void> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)

  const { count } = await supabase
    .from("task_verifications")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("associate_id", associateId)
    .in("status", ["resolved_retry", "resolved_challenged"])
    .gte("created_at", cutoff.toISOString())

  if ((count ?? 0) >= 3) {
    const { data: store } = await (supabase as any)
      .from("stores")
      .select("org_id, district_id")
      .eq("id", storeId)
      .maybeSingle()

    await (supabase as any)
      .from("associate_rankings")
      .upsert({
        store_id: storeId,
        associate_id: associateId,
        associate_name: associateName,
        org_id: store?.org_id ?? "",
        district_id: store?.district_id ?? null,
        is_desynced: true,
        desync_reason: "3+ verification failures in 30 days",
        desync_since: new Date().toISOString(),
        desync_assists_needed: 3,
        desync_assists_completed: 0,
      }, { onConflict: "store_id,associate_id" })
  }
}

// â”€â”€ Challenge Resolution with Consequences â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function resolveChallenge(
  verificationId: string,
  storeManagerProfileId: string,
  verdict: "complete" | "incomplete"
): Promise<boolean> {
  const { data: v } = await supabase
    .from("task_verifications")
    .select(`
      *,
      tasks!task_id(task_name, store_id, base_points, archetype),
      associates!associate_id(id, name, store_id),
      associates!supervisor_id(id, name)
    `)
    .eq("id", verificationId)
    .maybeSingle()

  if (!v) return false

  const task = (v as any).tasks
  const associate = (v as any).associates
  const supervisor = (v as any).supervisor
  const storeId = task?.store_id ?? associate?.store_id

  const newStatus = verdict === "complete" ? "resolved_accepted" : "resolved_retry"
  const { error } = await supabase
    .from("task_verifications")
    .update({
      store_manager_id: storeManagerProfileId,
      store_manager_verdict: verdict,
      challenge_resolved: true,
      resolved_at: new Date().toISOString(),
      status: newStatus,
    })
    .eq("id", verificationId)

  if (error) return false

  if (verdict === "complete") {
    await supabase
      .from("tasks")
      .update({ is_completed: true, pending_verification: false })
      .eq("id", v.task_id)

    if (storeId && v.associate_id) {
      await logPoints(storeId, v.associate_id, 25, "challenge_vindicated", v.task_id)
    }

    if (storeId && supervisor?.id) {
      await trackChallengePattern({
        storeId,
        taskId: v.task_id,
        taskName: task?.task_name ?? "Unknown",
        associateId: v.associate_id,
        associateName: associate?.name ?? "Unknown",
        supervisorId: supervisor.id,
        supervisorName: supervisor.name,
        patternType: "supervisor_task",
      })

      await trackChallengePattern({
        storeId,
        taskId: v.task_id,
        taskName: task?.task_name ?? "Unknown",
        associateId: v.associate_id,
        associateName: associate?.name ?? "Unknown",
        supervisorId: supervisor.id,
        supervisorName: supervisor.name,
        patternType: "associate_supervisor",
      })

      await (supabase as any).from("pings").insert({
        store_id: storeId,
        from_associate_id: v.associate_id,
        to_associate_id: supervisor.id,
        message: `Store Manager ruled "${task?.task_name}" was completed. Your rejection was overturned.`,
        ping_type: "direct",
      })
    }
  } else {
    await (supabase as any)
      .from("tasks")
      .update({
        pending_verification: false,
        is_completed: false,
        started_at: null,
        completed_at: null,
      })
      .eq("id", v.task_id)

    if (storeId) {
      await trackChallengePattern({
        storeId,
        taskId: v.task_id,
        taskName: task?.task_name ?? "Unknown",
        associateId: v.associate_id,
        associateName: associate?.name ?? "Unknown",
        supervisorId: supervisor?.id ?? null,
        supervisorName: supervisor?.name ?? null,
        patternType: "associate_task",
      })

      await checkAndApplyDesync(storeId, v.associate_id, associate?.name ?? "Unknown")

      await (supabase as any).from("pings").insert({
        store_id: storeId,
        from_associate_id: storeManagerProfileId,
        to_associate_id: v.associate_id,
        message: `Store Manager reviewed "${task?.task_name}" â€” please complete it properly and try again.`,
        ping_type: "direct",
      })
    }
  }

  return true
}

export async function fetchChallengePatterns(storeId: string): Promise<Array<{
  id: string
  patternType: string
  taskName: string
  associateName: string
  supervisorName: string | null
  challengeCount: number
  flagLevel: string
  windowEnd: string
}>> {
  const { data, error } = await (supabase as any)
    .from("challenge_patterns")
    .select("*")
    .eq("store_id", storeId)
    .eq("is_resolved", false)
    .gt("window_end", new Date().toISOString().split("T")[0])
    .order("challenge_count", { ascending: false })

  if (error || !data) return []

  return data.map((p: any) => ({
    id: p.id,
    patternType: p.pattern_type,
    taskName: p.task_name,
    associateName: p.associate_name,
    supervisorName: p.supervisor_name,
    challengeCount: p.challenge_count,
    flagLevel: p.flag_level,
    windowEnd: p.window_end,
  }))
}

export async function resolveChallengePattern(
  patternId: string,
  resolvedById: string,
  notes: string
): Promise<boolean> {
  const { error } = await (supabase as any)
    .from("challenge_patterns")
    .update({
      is_resolved: true,
      resolved_by: resolvedById,
      resolved_at: new Date().toISOString(),
      resolution_notes: notes,
    })
    .eq("id", patternId)

  return !error
}

export async function logSlowCompletionReason(
  storeId: string,
  taskId: string,
  associateId: string,
  reasonCategory: string,
  reasonNotes: string | null,
  actualMinutes: number,
  expectedMinutes: number
): Promise<boolean> {
  const { error } = await supabase
    .from("slow_completion_reasons")
    .insert({
      store_id: storeId,
      task_id: taskId,
      associate_id: associateId,
      reason_category: reasonCategory,
      reason_notes: reasonNotes,
      actual_minutes: actualMinutes,
      expected_minutes: expectedMinutes,
    })

  return !error
}

export async function fetchTimeSuggestions(storeId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("task_time_suggestions")
    .select("*, tasks!task_id(task_name, expected_minutes)")
    .eq("store_id", storeId)
    .eq("is_reviewed", false)
    .order("created_at", { ascending: false })

  if (error) return []
  return data ?? []
}

export async function reviewTimeSuggestion(
  suggestionId: string,
  reviewedById: string,
  apply: boolean,
  taskId?: string,
  newMinutes?: number
): Promise<boolean> {
  if (apply && taskId && newMinutes) {
    await supabase
      .from("tasks")
      .update({ expected_minutes: newMinutes })
      .eq("id", taskId)
  }

  const { error } = await supabase
    .from("task_time_suggestions")
    .update({
      is_reviewed: true,
      reviewed_by: reviewedById,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", suggestionId)

  return !error
}

// â”€â”€ Kill Leader & Burn Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function calculateAndSaveShiftResults(
  storeId: string,
  shiftBucket: "6a-2p" | "2p-10p" | "10p-6a",
  shiftDate: string,
  associateResults: Array<{
    associateId: string
    tasksCompleted: number
    tasksOrphaned: number
    tasksTotal: number
  }>
): Promise<void> {
  if (associateResults.length === 0) return

  // Fetch assists for each associate this shift
  const db = supabase as any
  const { data: assistData } = await db
    .from("assists")
    .select("assist_associate_id, original_associate_id")
    .eq("store_id", storeId)
    .eq("shift_date", shiftDate)
    .eq("shift_bucket", shiftBucket)

  const assists = (assistData ?? []) as Array<{
    assist_associate_id: string
    original_associate_id: string
  }>

  // Calculate benchmarks
  const withBenchmarks = associateResults.map(r => {
    const pct = r.tasksTotal > 0 ? r.tasksCompleted / r.tasksTotal : 0
    const benchmark =
      pct >= 0.9 ? "Exceeded" :
      pct >= 0.7 ? "Performed" :
      "Executed"

    const assistsGiven = assists.filter(a => a.original_associate_id === r.associateId).length
    const assistsReceived = assists.filter(a => a.assist_associate_id === r.associateId).length

    return { ...r, pct, benchmark, assistsGiven, assistsReceived }
  })

  // Kill leader = highest completion pct
  const sortedByCompletion = [...withBenchmarks].sort((a, b) => b.pct - a.pct)
  const killLeaderId = sortedByCompletion[0]?.associateId ?? null

  // MVP = most assists given
  const sortedByAssists = [...withBenchmarks].sort((a, b) => b.assistsGiven - a.assistsGiven)
  const mvpId = (sortedByAssists[0]?.assistsGiven ?? 0) > 0
    ? sortedByAssists[0]?.associateId ?? null
    : null

  // Upsert shift results
  const rows = withBenchmarks.map(r => ({
    store_id: storeId,
    shift_bucket: shiftBucket,
    shift_date: shiftDate,
    associate_id: r.associateId,
    tasks_completed: r.tasksCompleted,
    tasks_orphaned: r.tasksOrphaned,
    tasks_total: r.tasksTotal,
    benchmark: r.benchmark,
    burn_cards_earned: r.associateId === killLeaderId ? 1 : 0,
    squad_cards_earned: r.associateId === mvpId && mvpId !== killLeaderId ? 1 : 0,
    is_kill_leader: r.associateId === killLeaderId,
    is_mvp: r.associateId === mvpId,
    assists_given: r.assistsGiven,
    assists_received: r.assistsReceived,
  }))

  await db.from("shift_results").upsert(rows, {
    onConflict: "store_id,shift_bucket,shift_date,associate_id",
  })

  // Award burn card to kill leader
  if (killLeaderId) {
    const { data: klProfile } = await supabase
      .from("profiles")
      .select("burn_cards, lifetime_burn_cards")
      .eq("id", killLeaderId)
      .maybeSingle()

    if (klProfile) {
      await supabase.from("profiles").update({
        burn_cards: (klProfile.burn_cards ?? 0) + 1,
        lifetime_burn_cards: (klProfile.lifetime_burn_cards ?? 0) + 1,
      }).eq("id", killLeaderId)
    }
  }

  // Award squad card to MVP (only if different from kill leader)
  if (mvpId && mvpId !== killLeaderId) {
    const { data: mvpProfile } = await (supabase as any)
      .from("profiles")
      .select("squad_cards, lifetime_squad_cards")
      .eq("id", mvpId)
      .maybeSingle()

    if (mvpProfile) {
      await (supabase as any).from("profiles").update({
        squad_cards: (mvpProfile.squad_cards ?? 0) + 1,
        lifetime_squad_cards: (mvpProfile.lifetime_squad_cards ?? 0) + 1,
      }).eq("id", mvpId)
    }
  }

  await calculateStoreRankings(storeId)
}

/**
 * Get combined spendable cards (burn + squad) for an associate.
 */
export async function getAssociateSpendableCards(profileId: string): Promise<{
  burnCards: number
  squadCards: number
  total: number
}> {
  const { data } = await (supabase as any)
    .from("profiles")
    .select("burn_cards, squad_cards")
    .eq("id", profileId)
    .maybeSingle()

  const burnCards = (data as any)?.burn_cards ?? 0
  const squadCards = (data as any)?.squad_cards ?? 0

  return { burnCards, squadCards, total: burnCards + squadCards }
}

/**
 * Spend a card (burn or squad â€” same mechanic).
 * Deducts from burn cards first, then squad cards.
 */
export async function spendCard(
  profileId: string,
  taskId: string,
  supervisorAssociateId: string,
  supervisorName: string
): Promise<boolean> {
  const cards = await getAssociateSpendableCards(profileId)
  if (cards.total <= 0) return false

  // Assign task to supervisor
  const success = await assignTaskToAssociate(
    taskId,
    supervisorAssociateId,
    supervisorName,
    1
  )
  if (!success) return false

  // Deduct from burn first, then squad
  const { data } = await (supabase as any)
    .from("profiles")
    .select("burn_cards, squad_cards")
    .eq("id", profileId)
    .maybeSingle()

  if (!data) return false

  const profile = data as any
  const update: Record<string, number> = {}
  if ((profile.burn_cards ?? 0) > 0) {
    update.burn_cards = (profile.burn_cards ?? 0) - 1
  } else {
    update.squad_cards = (profile.squad_cards ?? 0) - 1
  }

  await (supabase as any).from("profiles").update(update).eq("id", profileId)
  return true
}

export async function fetchShiftResults(
  storeId: string,
  shiftBucket: string,
  shiftDate: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from("shift_results")
    .select("*, associates!associate_id(name)")
    .eq("store_id", storeId)
    .eq("shift_bucket", shiftBucket)
    .eq("shift_date", shiftDate)

  if (error) return []
  return data ?? []
}

export async function getAssociateBurnCards(profileId: string): Promise<number> {
  const { data } = await supabase
    .from("profiles")
    .select("burn_cards")
    .eq("id", profileId)
    .maybeSingle()

  return data?.burn_cards ?? 0
}

export async function useBurnCard(
  profileId: string,
  taskId: string,
  supervisorAssociateId: string,
  supervisorName: string
): Promise<boolean> {
  // Check has burn cards
  const burnCards = await getAssociateBurnCards(profileId)
  if (burnCards <= 0) return false

  // Assign task to supervisor
  const success = await assignTaskToAssociate(
    taskId,
    supervisorAssociateId,
    supervisorName,
    1 // queue position 1 â€” immediate
  )

  if (!success) return false

  // Deduct burn card
  const { error } = await supabase
    .from("profiles")
    .update({ burn_cards: burnCards - 1 })
    .eq("id", profileId)

  return !error
}

export function getShiftBucket(timeStr: string): "6a-2p" | "2p-10p" | "10p-6a" {
  const [h] = timeStr.split(":").map(Number)
  if (h >= 6 && h < 14) return "6a-2p"
  if (h >= 14 && h < 22) return "2p-10p"
  return "10p-6a"
}

// â”€â”€ Store Setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function seedAssociatesForStore(
  storeId: string,
  associates: StoreConfigAssociate[]
): Promise<{ success: number; failed: number; errors?: string[] }> {
  let success = 0
  let failed = 0
  const errors: string[] = []

  const ROLE_RANK: Record<string, number> = {
    crew: 1, supervisor: 2, assistant_manager: 3,
    store_manager: 4, district_admin: 5, org_admin: 6, db_admin: 7,
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("org_id")
    .eq("id", storeId)
    .maybeSingle()

  if (storeError || !store) {
    return {
      success: 0,
      failed: associates.length,
      errors: [storeError?.message ?? "Store not found for associate seed."],
    }
  }

  for (const assoc of associates) {
    const eeid = assoc.eeid?.trim()
    const name = assoc.name?.trim()
    const role = assoc.role || "crew"
    const roleRank = ROLE_RANK[role] ?? 1

    if (!eeid || !name) {
      failed++
      errors.push(`Skipped associate with missing ${!eeid ? "EEID" : "name"}.`)
      continue
    }

    const { data: existingProfile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("eeid", eeid)
      .eq("org_id", store.org_id)
      .maybeSingle()

    if (profileLookupError) {
      failed++
      errors.push(`${name}: ${profileLookupError.message}`)
      continue
    }

    let profileId = existingProfile?.id ?? null

    if (profileId) {
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({
          display_name: name,
          role,
          role_rank: roleRank,
          current_store_id: storeId,
        })
        .eq("id", profileId)

      if (profileUpdateError) {
        failed++
        errors.push(`${name}: ${profileUpdateError.message}`)
        continue
      }
    } else {
      profileId = crypto.randomUUID()
      const { error: profileInsertError } = await supabase
        .from("profiles")
        .insert({
          id: profileId,
          eeid,
          display_name: name,
          role,
          role_rank: roleRank,
          org_id: store.org_id,
          current_store_id: storeId,
        })

      if (profileInsertError) {
        failed++
        errors.push(`${name}: ${profileInsertError.message}`)
        continue
      }
    }

    const { error } = await supabase
      .from("associates")
      .upsert({
        store_id: storeId,
        profile_id: profileId,
        name,
        role,
        role_rank: roleRank,
        current_archetype: "Float",
        scheduled_days: "",
        default_start_time: assoc.default_start_time,
        default_end_time: assoc.default_end_time,
      }, { onConflict: "store_id,name" })

    if (error) {
      failed++
      errors.push(`${name}: ${error.message}`)
    } else {
      success++
    }
  }

  return { success, failed, errors: errors.length ? errors : undefined }
}

export async function deleteProfileAndRosterEntry(profile: Profile): Promise<boolean> {
  if (profile.current_store_id) {
    const { error: associateError } = await supabase
      .from("associates")
      .delete()
      .eq("store_id", profile.current_store_id)
      .eq("profile_id", profile.id)

    if (associateError) {
      console.error("deleteProfileAndRosterEntry associate delete failed:", associateError.message)
      return false
    }
  }

  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", profile.id)

  if (error) {
    console.error("deleteProfileAndRosterEntry profile delete failed:", error.message)
    return false
  }

  return true
}

export async function seedTasksForStore(
  storeId: string,
  tasks: StoreConfigTask[]
): Promise<{ success: number; failed: number; errors?: string[] }> {
  // Clear existing tasks first
  const { error: deleteError } = await supabase.from("tasks").delete().eq("store_id", storeId)
  if (deleteError) return { success: 0, failed: tasks.length, errors: [deleteError.message] }

  const { error } = await supabase.from("tasks").insert(
    tasks.map(t => ({
      store_id: storeId,
      task_name: t.task_name,
      archetype: t.archetype,
      priority: t.priority,
      is_sticky: t.is_sticky,
      expected_minutes: t.expected_minutes,
      sop_content: t.sop_content ?? null,
      base_points: 10,
      is_completed: false,
      is_pull_task: false,
      is_truck_task: false,
    }))
  )

  if (error) return { success: 0, failed: tasks.length, errors: [error.message] }
  return { success: tasks.length, failed: 0 }
}

export async function seedInventoryForStore(
  storeId: string,
  items: StoreConfigInventoryItem[]
): Promise<{ success: number; failed: number; errors?: string[] }> {
  const { error: deleteError } = await supabase.from("inventory_items").delete().eq("store_id", storeId)
  if (deleteError) return { success: 0, failed: items.length, errors: [deleteError.message] }

  const { error } = await supabase.from("inventory_items").insert(
    items.map(i => ({
      store_id: storeId,
      item_name: i.item_name,
      build_to: i.category,
      category: i.category,
      amount_needed: i.amount_needed,
      code_life_days: i.code_life_days ?? null,
      amount_have: null,
      is_pulled: false,
    }))
  )

  if (error) return { success: 0, failed: items.length, errors: [error.message] }
  return { success: items.length, failed: 0 }
}

export async function seedTableItemsForStore(
  storeId: string,
  items: StoreConfigTableItem[]
): Promise<{ success: number; failed: number; errors?: string[] }> {
  const { error: deleteError } = await supabase.from("table_items").delete().eq("store_id", storeId)
  if (deleteError) return { success: 0, failed: items.length, errors: [deleteError.message] }

  const { error } = await supabase.from("table_items").insert(
    items.map(i => ({
      store_id: storeId,
      item_name: i.item_name,
      station: i.station,
      is_initialed: true,
    }))
  )

  if (error) return { success: 0, failed: items.length, errors: [error.message] }
  return { success: items.length, failed: 0 }
}

export async function exportStoreConfig(storeId: string): Promise<StoreConfig> {
  const [associates, tasks, inventory, tableItems] = await Promise.all([
    supabase.from("associates").select("*").eq("store_id", storeId),
    supabase.from("tasks").select("*").eq("store_id", storeId),
    supabase.from("inventory_items").select("*").eq("store_id", storeId),
    supabase.from("table_items").select("*").eq("store_id", storeId),
  ])

  return {
    associates: (associates.data ?? []).map(a => ({
      eeid: "", // EEIDs are on profiles, not associates
      name: a.name,
      role: a.role,
      default_start_time: a.default_start_time,
      default_end_time: a.default_end_time,
    })),
    tasks: (tasks.data ?? []).map(t => ({
      task_name: t.task_name,
      archetype: t.archetype,
      priority: t.priority as StoreConfigTask["priority"],
      is_sticky: t.is_sticky,
      expected_minutes: t.expected_minutes ?? 15,
      sop_content: t.sop_content ?? undefined,
    })),
    inventory: (inventory.data ?? []).map(i => ({
      item_name: i.item_name,
      category: i.category,
      amount_needed: i.amount_needed ?? 0,
      code_life_days: i.code_life_days ?? undefined,
    })),
    table_items: (tableItems.data ?? []).map(i => ({
      item_name: i.item_name,
      station: i.station,
    })),
  }
}

// â”€â”€ Shift Results (GX1) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ShiftResult = Database["public"]["Tables"]["shift_results"]["Row"]

export interface TeamShiftResult {
  associateName: string
  result: ShiftResult
}

export async function fetchShiftResultsForStore(storeId: string): Promise<TeamShiftResult[]> {
  const today = new Date().toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("shift_results")
    .select("*, associates(name)")
    .eq("store_id", storeId)
    .eq("shift_date", today)

  if (error) {
    console.error("fetchShiftResultsForStore failed:", error.message)
    return []
  }

  return (data ?? []).map(row => ({
    associateName: (row as any).associates?.name ?? "Unknown",
    result: row as ShiftResult,
  }))
}

// â”€â”€ Report Aliases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ReportAliasItem {
  id: string
  name: string
  reportAlias: string | null
  category?: string
  archetype?: string
  type: "inventory" | "task"
}

/**
 * Fetch all inventory items and tasks for a store
 * with their current report aliases.
 */
export async function fetchReportAliases(
  storeId: string
): Promise<ReportAliasItem[]> {
  const [inventoryRes, tasksRes] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("id, item_name, category, report_alias")
      .eq("store_id", storeId)
      .order("category")
      .order("item_name"),
    supabase
      .from("tasks")
      .select("id, task_name, archetype, report_alias")
      .eq("store_id", storeId)
      .order("archetype")
      .order("task_name"),
  ])

  const inventoryItems: ReportAliasItem[] = (inventoryRes.data ?? []).map(i => ({
    id: i.id,
    name: i.item_name,
    reportAlias: i.report_alias,
    category: i.category,
    type: "inventory",
  }))

  const taskItems: ReportAliasItem[] = (tasksRes.data ?? []).map(t => ({
    id: t.id,
    name: t.task_name,
    reportAlias: t.report_alias,
    archetype: t.archetype,
    type: "task",
  }))

  return [...inventoryItems, ...taskItems]
}

/**
 * Update report alias for a single inventory item or task.
 */
export async function updateReportAlias(
  id: string,
  type: "inventory" | "task",
  alias: string | null
): Promise<boolean> {
  if (type === "inventory") {
    const { error } = await supabase
      .from("inventory_items")
      .update({ report_alias: alias || null })
      .eq("id", id)
    if (error) {
      console.error("updateReportAlias failed:", error.message)
      return false
    }
  } else {
    const { error } = await supabase
      .from("tasks")
      .update({ report_alias: alias || null })
      .eq("id", id)
    if (error) {
      console.error("updateReportAlias failed:", error.message)
      return false
    }
  }
  return true
}

/**
 * Bulk update report aliases for a store.
 * Used when auto-generating aliases.
 */
export async function bulkUpdateReportAliases(
  updates: Array<{ id: string; type: "inventory" | "task"; alias: string }>
): Promise<boolean> {
  for (const update of updates) {
    const success = await updateReportAlias(update.id, update.type, update.alias)
    if (!success) return false
  }
  return true
}

/**
 * Auto-generate report aliases for all items in a store.
 * Groups by category/archetype and assigns sequential aliases.
 *
 * Inventory: "Bread Item A", "Bread Item B", "Prep Item A"...
 * Tasks: "Kitchen Task A", "MOD Task A"...
 *
 * Only generates aliases for items that don't already have one.
 */
export async function autoGenerateAliases(
  storeId: string
): Promise<number> {
  const items = await fetchReportAliases(storeId)
  const unaliased = items.filter(i => !i.reportAlias)

  if (unaliased.length === 0) return 0

  // Group by category/archetype
  const groups: Record<string, ReportAliasItem[]> = {}
  for (const item of unaliased) {
    const group = item.type === "inventory"
      ? `${item.category} (Inventory)`
      : `${item.archetype} (Task)`
    if (!groups[group]) groups[group] = []
    groups[group].push(item)
  }

  const updates: Array<{ id: string; type: "inventory" | "task"; alias: string }> = []
  const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

  // Get existing aliases to avoid collisions
  const existing = items.filter(i => i.reportAlias).map(i => i.reportAlias)

  for (const [group, groupItems] of Object.entries(groups)) {
    const isInventory = group.includes("(Inventory)")
    const categoryName = group.replace(" (Inventory)", "").replace(" (Task)", "")
    const prefix = isInventory ? `${categoryName} Item` : `${categoryName} Task`

    let letterIndex = 0
    for (const item of groupItems) {
      // Find next available letter
      let alias = `${prefix} ${ALPHA[letterIndex]}`
      while (existing.includes(alias) || updates.some(u => u.alias === alias)) {
        letterIndex++
        alias = `${prefix} ${ALPHA[letterIndex] ?? letterIndex}`
      }
      updates.push({ id: item.id, type: item.type, alias })
      letterIndex++
    }
  }

  await bulkUpdateReportAliases(updates)
  return updates.length
}

/**
 * Generate a research-ready report for a store.
 * Uses report_alias everywhere â€” no org-specific names.
 */
export async function generateResearchReport(
  storeId: string,
  startDate: string,
  endDate: string
): Promise<{
  period: { start: string; end: string }
  taskMetrics: Array<{
    alias: string
    archetype: string
    completions: number
    avgActualMinutes: number
    expectedMinutes: number
    deltaAvgPct: number
    fastCompletions: number
    slowCompletions: number
  }>
  inventoryMetrics: Array<{
    alias: string
    category: string
    totalPulled: number
    wasteEvents: number
    wasteQuantity: number
    avgCodeLife: number
  }>
  shiftMetrics: {
    totalShifts: number
    avgTasksCompleted: number
    avgCompletionPct: number
    killLeaderCount: number
    burnCardsEarned: number
  }
}> {
  // Task metrics â€” uses report_alias
  const { data: verifications } = await supabase
    .from("task_verifications")
    .select(`
      actual_minutes,
      expected_minutes,
      delta_pct,
      trigger_type,
      tasks!task_id(report_alias, archetype, expected_minutes)
    `)
    .eq("store_id", storeId)
    .gte("created_at", startDate)
    .lte("created_at", endDate)

  // Group task metrics by alias
  const taskMap: Record<string, any> = {}
  for (const v of (verifications ?? [])) {
    const alias = (v as any).tasks?.report_alias ?? "Unaliased Task"
    const archetype = (v as any).tasks?.archetype ?? "Unknown"
    if (!taskMap[alias]) {
      taskMap[alias] = {
        alias,
        archetype,
        completions: 0,
        totalActualMinutes: 0,
        expectedMinutes: (v as any).tasks?.expected_minutes ?? 0,
        totalDeltaPct: 0,
        fastCompletions: 0,
        slowCompletions: 0,
      }
    }
    taskMap[alias].completions++
    taskMap[alias].totalActualMinutes += v.actual_minutes
    taskMap[alias].totalDeltaPct += v.delta_pct
    if (v.trigger_type === "fast") taskMap[alias].fastCompletions++
    if (v.trigger_type === "slow") taskMap[alias].slowCompletions++
  }

  const taskMetrics = Object.values(taskMap).map((t: any) => ({
    alias: t.alias,
    archetype: t.archetype,
    completions: t.completions,
    avgActualMinutes: t.completions > 0 ? Math.round(t.totalActualMinutes / t.completions) : 0,
    expectedMinutes: t.expectedMinutes,
    deltaAvgPct: t.completions > 0 ? Math.round(t.totalDeltaPct / t.completions) : 0,
    fastCompletions: t.fastCompletions,
    slowCompletions: t.slowCompletions,
  }))

  // Inventory metrics â€” uses report_alias
  const { data: pullEvents } = await supabase
    .from("pull_events")
    .select(`
      quantity_pulled,
      waste_quantity,
      expires_date,
      pulled_date,
      inventory_items!item_id(report_alias, category, code_life_days)
    `)
    .eq("store_id", storeId)
    .gte("pulled_date", startDate)
    .lte("pulled_date", endDate)

  const inventoryMap: Record<string, any> = {}
  for (const p of (pullEvents ?? [])) {
    const alias = (p as any).inventory_items?.report_alias ?? "Unaliased Item"
    const category = (p as any).inventory_items?.category ?? "Unknown"
    const codeLife = (p as any).inventory_items?.code_life_days ?? 0
    if (!inventoryMap[alias]) {
      inventoryMap[alias] = {
        alias,
        category,
        totalPulled: 0,
        wasteEvents: 0,
        wasteQuantity: 0,
        codeLifeTotal: 0,
        codeLifeCount: 0,
      }
    }
    inventoryMap[alias].totalPulled += p.quantity_pulled
    if (p.waste_quantity) {
      inventoryMap[alias].wasteEvents++
      inventoryMap[alias].wasteQuantity += p.waste_quantity
    }
    if (codeLife > 0) {
      inventoryMap[alias].codeLifeTotal += codeLife
      inventoryMap[alias].codeLifeCount++
    }
  }

  const inventoryMetrics = Object.values(inventoryMap).map((i: any) => ({
    alias: i.alias,
    category: i.category,
    totalPulled: i.totalPulled,
    wasteEvents: i.wasteEvents,
    wasteQuantity: i.wasteQuantity,
    avgCodeLife: i.codeLifeCount > 0 ? Math.round(i.codeLifeTotal / i.codeLifeCount) : 0,
  }))

  // Shift metrics
  const { data: shiftResults } = await supabase
    .from("shift_results")
    .select("tasks_completed, tasks_total, completion_pct, is_kill_leader, burn_cards_earned")
    .eq("store_id", storeId)
    .gte("shift_date", startDate)
    .lte("shift_date", endDate)

  const results = shiftResults ?? []
  const shiftMetrics = {
    totalShifts: results.length,
    avgTasksCompleted: results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.tasks_completed, 0) / results.length)
      : 0,
    avgCompletionPct: results.length > 0
      ? Math.round(results.reduce((s, r) => s + (r.completion_pct ?? 0), 0) / results.length)
      : 0,
    killLeaderCount: results.filter(r => r.is_kill_leader).length,
    burnCardsEarned: results.reduce((s, r) => s + (r.burn_cards_earned ?? 0), 0),
  }

  return {
    period: { start: startDate, end: endDate },
    taskMetrics,
    inventoryMetrics,
    shiftMetrics,
  }
}

// â”€â”€ Store Manager Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchTopPerformers(
  storeId: string,
  days: number = 30
): Promise<Array<{
  associateId: string
  associateName: string
  avgCompletionPct: number
  totalShifts: number
  burnCardsEarned: number
  squadCardsEarned: number
  killLeaderCount: number
  mvpCount: number
}>> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split("T")[0]

  const db = supabase as any
  const { data, error } = await db
    .from("shift_results")
    .select(`
      associate_id,
      completion_pct,
      burn_cards_earned,
      is_kill_leader,
      associates!associate_id(name)
    `)
    .eq("store_id", storeId)
    .gte("shift_date", cutoffStr)

  if (error || !data) return []

  const grouped: Record<string, any> = {}
  for (const r of data as any[]) {
    const id = r.associate_id
    if (!grouped[id]) {
      grouped[id] = {
        associateId: id,
        associateName: r.associates?.name ?? "Unknown",
        totalCompletionPct: 0,
        totalShifts: 0,
        burnCardsEarned: 0,
        squadCardsEarned: 0,
        killLeaderCount: 0,
        mvpCount: 0,
      }
    }
    grouped[id].totalCompletionPct += r.completion_pct ?? 0
    grouped[id].totalShifts++
    grouped[id].burnCardsEarned += r.burn_cards_earned ?? 0
    grouped[id].squadCardsEarned += r.squad_cards_earned ?? 0
    if (r.is_kill_leader) grouped[id].killLeaderCount++
    if (r.is_mvp) grouped[id].mvpCount++
  }

  return Object.values(grouped)
    .map((g: any) => ({
      ...g,
      avgCompletionPct: g.totalShifts > 0
        ? Math.round(g.totalCompletionPct / g.totalShifts)
        : 0,
    }))
    .sort((a, b) => b.avgCompletionPct - a.avgCompletionPct)
}

export async function fetchAccountabilityFeed(
  storeId: string,
  limit: number = 20
): Promise<Array<{
  id: string
  type: "fast" | "slow" | "challenge" | "accepted"
  taskName: string
  associateName: string
  supervisorName: string | null
  deltaPct: number
  status: string
  createdAt: string
}>> {
  const db = supabase as any
  const { data, error } = await db
    .from("task_verifications")
    .select(`
      id,
      trigger_type,
      delta_pct,
      status,
      created_at,
      challenge_submitted,
      tasks!task_id(task_name),
      associates!associate_id(name),
      supervisor:associates!supervisor_id(name)
    `)
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return (data as any[]).map(v => ({
    id: v.id,
    type: v.challenge_submitted ? "challenge" as const :
          v.status === "resolved_accepted" ? "accepted" as const :
          v.trigger_type as "fast" | "slow",
    taskName: v.tasks?.task_name ?? "Unknown",
    associateName: v.associates?.name ?? "Unknown",
    supervisorName: v.supervisor?.name ?? null,
    deltaPct: v.delta_pct,
    status: v.status,
    createdAt: v.created_at,
  }))
}

export async function fetchStoreMetrics(
  storeId: string,
  days: number = 30
): Promise<{
  deadCodes: number
  wasteQuantity: number
  totalPulled: number
  wastePercent: number
  tasksCompleted: number
  tasksOrphaned: number
  hoursInTasks: number
  hoursOrphaned: number
}> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split("T")[0]

  const [pullData, shiftData] = await Promise.all([
    supabase
      .from("pull_events")
      .select("quantity_pulled, waste_quantity, is_verified")
      .eq("store_id", storeId)
      .gte("pulled_date", cutoffStr),
    supabase
      .from("shift_results")
      .select("tasks_completed, tasks_orphaned, tasks_total")
      .eq("store_id", storeId)
      .gte("shift_date", cutoffStr),
  ])

  const pulls = pullData.data ?? []
  const shifts = shiftData.data ?? []

  const deadCodes = pulls.filter(p => p.waste_quantity && p.waste_quantity > 0).length
  const wasteQuantity = pulls.reduce((s, p) => s + (p.waste_quantity ?? 0), 0)
  const totalPulled = pulls.reduce((s, p) => s + p.quantity_pulled, 0)
  const wastePercent = totalPulled > 0 ? Math.round((wasteQuantity / totalPulled) * 100) : 0

  const tasksCompleted = shifts.reduce((s, r) => s + r.tasks_completed, 0)
  const tasksOrphaned = shifts.reduce((s, r) => s + (r.tasks_orphaned ?? 0), 0)

  return {
    deadCodes,
    wasteQuantity,
    totalPulled,
    wastePercent,
    tasksCompleted,
    tasksOrphaned,
    hoursInTasks: Math.round(tasksCompleted * 0.25),
    hoursOrphaned: Math.round(tasksOrphaned * 0.25),
  }
}

// â”€â”€ Ping System â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function sendPing(
  storeId: string,
  fromAssociateId: string,
  message: string,
  pingType: "task_offer" | "general" | "all_hands" | "direct",
  options?: {
    toAssociateId?: string
    targetArchetype?: string
    taskId?: string
  }
): Promise<string | null> {
  const db = supabase as any
  const { data, error } = await db
    .from("pings")
    .insert({
      store_id: storeId,
      from_associate_id: fromAssociateId,
      to_associate_id: options?.toAssociateId ?? null,
      target_archetype: options?.targetArchetype ?? null,
      task_id: options?.taskId ?? null,
      message,
      ping_type: pingType,
    })
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("sendPing failed:", error.message)
    return null
  }
  return data?.id ?? null
}

export async function fetchActivePingsForAssociate(
  storeId: string,
  associateId: string,
  archetype: string
): Promise<Array<{
  id: string
  message: string
  pingType: string
  taskId: string | null
  fromAssociateId: string
  fromName: string
  createdAt: string
}>> {
  const db = supabase as any
  const { data, error } = await db
    .from("pings")
    .select(`
      id, message, ping_type, task_id, from_associate_id, created_at,
      associates!from_associate_id(name)
    `)
    .eq("store_id", storeId)
    .eq("is_acknowledged", false)
    .or(`to_associate_id.eq.${associateId},target_archetype.eq.${archetype},ping_type.eq.all_hands`)
    .order("created_at", { ascending: false })

  if (error || !data) return []

  return (data as any[]).map(p => ({
    id: p.id,
    message: p.message,
    pingType: p.ping_type,
    taskId: p.task_id,
    fromAssociateId: p.from_associate_id,
    fromName: (p as any).associates?.name ?? "Unknown",
    createdAt: p.created_at,
  }))
}

export async function acknowledgePing(
  pingId: string,
  acknowledgedByAssociateId: string
): Promise<boolean> {
  const db = supabase as any
  const { error } = await db
    .from("pings")
    .update({
      is_acknowledged: true,
      acknowledged_by: acknowledgedByAssociateId,
      acknowledged_at: new Date().toISOString(),
    })
    .eq("id", pingId)

  return !error
}

export async function acceptTaskOffer(
  pingId: string,
  taskId: string,
  acceptingAssociateId: string,
  acceptingAssociateName: string,
  originalAssociateId: string,
  storeId: string,
  startTime: string
): Promise<boolean> {
  // Acknowledge the ping
  await acknowledgePing(pingId, acceptingAssociateId)

  // Assign the task to the accepting associate
  await supabase
    .from("tasks")
    .update({
      assigned_to: acceptingAssociateName,
      assigned_to_associate_id: acceptingAssociateId,
      queue_position: 1,
    })
    .eq("id", taskId)

  // Create assist record
  const bucket = getShiftBucket(startTime)
  const db = supabase as any
  await db.from("assists").insert({
    store_id: storeId,
    original_associate_id: originalAssociateId,
    assist_associate_id: acceptingAssociateId,
    task_id: taskId,
    ping_id: pingId,
    shift_date: new Date().toISOString().split("T")[0],
    shift_bucket: bucket,
  })

  // Get task base_points for assist log
  const { data: task } = await supabase
    .from("tasks")
    .select("base_points")
    .eq("id", taskId)
    .maybeSingle()

  // Log 2x points for assist
  await logPoints(
    storeId,
    acceptingAssociateId,
    Math.round((task?.base_points ?? 10) * 2),
    "assist_given",
    taskId
  )

  // Check if this assist helps resync
  const resynced = await checkDesyncResync(storeId, acceptingAssociateId)
  if (resynced) {
    // Notify associate they've resynced
    await (supabase as any).from("pings").insert({
      store_id: storeId,
      from_associate_id: originalAssociateId,
      to_associate_id: acceptingAssociateId,
      message: "You're back in sync with the squad. Keep it up. ðŸ”¥",
      ping_type: "direct",
    })
  }

  return true
}

/**
 * Calculate and update associate_rankings for a store.
 * Called at end of shift or on demand.
 * Uses rolling 30-day points from points_log.
 */
export async function calculateStoreRankings(storeId: string): Promise<void> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffStr = cutoff.toISOString().split("T")[0]

  // Get store metadata
  const { data: store } = await (supabase as any)
    .from("stores")
    .select("org_id, district_id")
    .eq("id", storeId)
    .maybeSingle()

  if (!store) return

  // Get district's region_id
  let regionId: string | null = null
  if (store.district_id) {
    const { data: district } = await (supabase as any)
      .from("districts")
      .select("region_id")
      .eq("id", store.district_id)
      .maybeSingle()
    regionId = district?.region_id ?? null
  }

  // Aggregate points by associate from points_log
  const { data: pointsData } = await (supabase as any)
    .from("points_log")
    .select("associate_id, points, reason")
    .eq("store_id", storeId)
    .gte("shift_date", cutoffStr)

  if (!pointsData) return

  // Group by associate
  const byAssociate: Record<string, {
    points_tasks: number
    points_verified: number
    points_assists: number
    points_kill_leader: number
    points_mvp: number
    points_vindicated: number
    total: number
  }> = {}

  for (const row of pointsData as any[]) {
    if (!byAssociate[row.associate_id]) {
      byAssociate[row.associate_id] = {
        points_tasks: 0,
        points_verified: 0,
        points_assists: 0,
        points_kill_leader: 0,
        points_mvp: 0,
        points_vindicated: 0,
        total: 0,
      }
    }
    const g = byAssociate[row.associate_id]
    g.total += row.points

    switch (row.reason) {
      case "task_complete": g.points_tasks += row.points; break
      case "task_verified": g.points_verified += row.points; break
      case "assist_given": g.points_assists += row.points; break
      case "kill_leader": g.points_kill_leader += row.points; break
      case "mvp": g.points_mvp += row.points; break
      case "challenge_vindicated": g.points_vindicated += row.points; break
    }
  }

  // Sort by total points to determine tiers and Predator status
  const sorted = Object.entries(byAssociate)
    .sort(([, a], [, b]) => b.total - a.total)

  // Determine tiers
  // Top 3 = Predator, then Master/Diamond/Platinum by quartile
  const predatorIds = new Set(sorted.slice(0, 3).map(([id]) => id))

  function getTier(rank: number, totalPoints: number): "Platinum" | "Diamond" | "Master" | "Predator" {
    if (predatorIds.has(sorted[rank]?.[0] ?? "")) return "Predator"
    if (totalPoints >= 500) return "Master"
    if (totalPoints >= 200) return "Diamond"
    return "Platinum"
  }

  // Fetch existing rankings to detect tier changes
  const { data: existingRankings } = await (supabase as any)
    .from("associate_rankings")
    .select("associate_id, tier, is_desynced, desync_assists_needed, desync_assists_completed")
    .eq("store_id", storeId)

  const existingMap: Record<string, any> = {}
  for (const r of existingRankings ?? []) {
    existingMap[r.associate_id] = r
  }

  // Fetch associate names
  const associateIds = sorted.map(([id]) => id)
  const { data: associates } = await (supabase as any)
    .from("associates")
    .select("id, name")
    .in("id", associateIds)

  const nameMap: Record<string, string> = {}
  for (const a of associates ?? []) nameMap[a.id] = a.name

  // Upsert rankings
  const upsertRows = sorted.map(([associateId, points], rank) => {
    const existing = existingMap[associateId]
    const newTier = getTier(rank, points.total)
    const isPredator = newTier === "Predator"
    const isSuccessionCandidate = isPredator

    const tierChanged = existing?.tier !== newTier

    return {
      store_id: storeId,
      org_id: store.org_id,
      district_id: store.district_id ?? null,
      region_id: regionId,
      associate_id: associateId,
      associate_name: nameMap[associateId] ?? "Unknown",
      points_tasks: points.points_tasks,
      points_verified: points.points_verified,
      points_assists: points.points_assists,
      points_kill_leader: points.points_kill_leader,
      points_mvp: points.points_mvp,
      points_vindicated: points.points_vindicated,
      points_total: points.total,
      tier: newTier,
      previous_tier: tierChanged ? (existing?.tier ?? null) : undefined,
      tier_changed_at: tierChanged ? new Date().toISOString() : undefined,
      is_predator: isPredator,
      is_succession_candidate: isSuccessionCandidate,
      last_calculated: new Date().toISOString(),
    }
  })

  if (upsertRows.length > 0) {
    await (supabase as any)
      .from("associate_rankings")
      .upsert(upsertRows, { onConflict: "store_id,associate_id" })
  }
}

/**
 * Check if a desynced associate has completed enough assists to resync.
 * Called whenever an assist is logged.
 */
export async function checkDesyncResync(
  storeId: string,
  associateId: string
): Promise<boolean> {
  const { data: ranking } = await (supabase as any)
    .from("associate_rankings")
    .select("is_desynced, desync_assists_needed, desync_assists_completed, desync_since")
    .eq("store_id", storeId)
    .eq("associate_id", associateId)
    .maybeSingle()

  if (!ranking?.is_desynced) return false

  const newCount = (ranking.desync_assists_completed ?? 0) + 1

  if (newCount >= (ranking.desync_assists_needed ?? 3)) {
    // Resync!
    await (supabase as any)
      .from("associate_rankings")
      .update({
        is_desynced: false,
        desync_cleared_at: new Date().toISOString(),
        desync_assists_completed: newCount,
      })
      .eq("store_id", storeId)
      .eq("associate_id", associateId)

    // Award resync bonus
    await logPoints(storeId, associateId, 100, "desync_cleared")

    return true // resynced
  } else {
    // Increment assists completed
    await (supabase as any)
      .from("associate_rankings")
      .update({ desync_assists_completed: newCount })
      .eq("store_id", storeId)
      .eq("associate_id", associateId)

    return false // not yet
  }
}

/**
 * Fetch ranking for a single associate.
 */
export async function fetchAssociateRanking(
  storeId: string,
  associateId: string
): Promise<{
  tier: string
  isPredator: boolean
  isDesynced: boolean
  desyncAssistsNeeded: number
  desyncAssistsCompleted: number
  pointsTotal: number
} | null> {
  const { data } = await (supabase as any)
    .from("associate_rankings")
    .select("*")
    .eq("store_id", storeId)
    .eq("associate_id", associateId)
    .maybeSingle()

  if (!data) return null

  return {
    tier: data.tier,
    isPredator: data.is_predator,
    isDesynced: data.is_desynced,
    desyncAssistsNeeded: data.desync_assists_needed,
    desyncAssistsCompleted: data.desync_assists_completed,
    pointsTotal: data.points_total,
  }
}

/**
 * Fetch store rankings leaderboard.
 */
export async function fetchStoreLeaderboard(storeId: string): Promise<Array<{
  associateId: string
  associateName: string
  tier: string
  isPredator: boolean
  isDesynced: boolean
  pointsTotal: number
  pointsAssists: number
}>> {
  const { data, error } = await (supabase as any)
    .from("associate_rankings")
    .select("*")
    .eq("store_id", storeId)
    .order("points_total", { ascending: false })

  if (error || !data) return []

  return data.map((r: any) => ({
    associateId: r.associate_id,
    associateName: r.associate_name,
    tier: r.tier,
    isPredator: r.is_predator,
    isDesynced: r.is_desynced,
    pointsTotal: r.points_total,
    pointsAssists: r.points_assists,
  }))
}

export async function fetchDistrictPredators(districtId: string): Promise<Array<{
  associateId: string
  associateName: string
  storeId: string
  storeNumber: string
  pointsTotal: number
}>> {
  const { data, error } = await (supabase as any)
    .from("associate_rankings")
    .select(`
      associate_id, associate_name, store_id, points_total,
      stores!store_id(store_number)
    `)
    .eq("district_id", districtId)
    .eq("is_predator", true)
    .order("points_total", { ascending: false })

  if (error || !data) return []

  return data.map((r: any) => ({
    associateId: r.associate_id,
    associateName: r.associate_name,
    storeId: r.store_id,
    storeNumber: r.stores?.store_number ?? "?",
    pointsTotal: r.points_total,
  }))
}

// â”€â”€ The Lobby â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface LobbySquadMember {
  associateId: string
  associateName: string
  scheduledStart: string
  scheduledEnd: string
  isDeployed: boolean
  currentStation: string | null
  isExtended: boolean
  tier: string
  isPredator: boolean
}

/**
 * Fetch squad data for the Lobby screen.
 * Returns associates scheduled for the same shift bucket as the current associate.
 */
export async function fetchLobbySquad(
  storeId: string,
  shiftDate: string,
  shiftBucket: "6a-2p" | "2p-10p" | "10p-6a"
): Promise<LobbySquadMember[]> {
  // Get scheduled associates for this shift bucket
  const { data: scheduled } = await (supabase as any)
    .from("schedule_entries")
    .select("associate_id, start_time, end_time, associates!associate_id(name)")
    .eq("store_id", storeId)
    .eq("shift_date", shiftDate)

  if (!scheduled) return []

  // Filter to same shift bucket by time range
  const bucketRanges: Record<string, { start: number; end: number }> = {
    "6a-2p": { start: 6, end: 14 },
    "2p-10p": { start: 14, end: 22 },
    "10p-6a": { start: 22, end: 30 }, // 30 = 6am next day
  }
  const range = bucketRanges[shiftBucket]

  const inBucket = scheduled.filter((s: any) => {
    const startHour = new Date(s.start_time).getHours()
    return startHour >= range.start && startHour < (range.end > 24 ? 24 : range.end)
  })

  const associateIds = inBucket.map((s: any) => s.associate_id)

  // Get active shifts (deployed)
  const { data: activeShifts } = await (supabase as any)
    .from("active_shifts")
    .select("associate_id, station, is_extended")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .in("associate_id", associateIds)

  // Get rankings for tier display
  const { data: rankings } = await (supabase as any)
    .from("associate_rankings")
    .select("associate_id, tier, is_predator")
    .eq("store_id", storeId)
    .in("associate_id", associateIds)

  const activeMap: Record<string, any> = {}
  for (const a of activeShifts ?? []) activeMap[a.associate_id] = a

  const rankingMap: Record<string, any> = {}
  for (const r of rankings ?? []) rankingMap[r.associate_id] = r

  return inBucket.map((s: any) => ({
    associateId: s.associate_id,
    associateName: (s as any).associates?.name ?? "Unknown",
    scheduledStart: s.start_time,
    scheduledEnd: s.end_time,
    isDeployed: !!activeMap[s.associate_id],
    currentStation: activeMap[s.associate_id]?.station ?? null,
    isExtended: activeMap[s.associate_id]?.is_extended ?? false,
    tier: rankingMap[s.associate_id]?.tier ?? "Platinum",
    isPredator: rankingMap[s.associate_id]?.is_predator ?? false,
  }))
}

/**
 * Fetch extended associates from the PREVIOUS shift bucket.
 * These are people who were scheduled for the last shift but are still active.
 */
export async function fetchExtendedAssociates(storeId: string): Promise<Array<{
  associateId: string
  associateName: string
  station: string
  extendedSince: string
}>> {
  const { data } = await (supabase as any)
    .from("active_shifts")
    .select("associate_id, station, updated_at, associates!associate_id(name)")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .eq("is_extended", true)

  if (!data) return []

  return data.map((s: any) => ({
    associateId: s.associate_id,
    associateName: s.associates?.name ?? "Unknown",
    station: s.station,
    extendedSince: s.updated_at,
  }))
}

/**
 * Get the current associate's scheduled start time for today.
 * Returns null if no schedule entry found.
 */
export async function fetchAssociateScheduleToday(
  associateId: string,
  storeId: string
): Promise<{ startTime: string; endTime: string } | null> {
  const today = new Date().toISOString().split("T")[0]

  const { data } = await (supabase as any)
    .from("schedule_entries")
    .select("start_time, end_time")
    .eq("associate_id", associateId)
    .eq("store_id", storeId)
    .eq("shift_date", today)
    .maybeSingle()

  if (!data) return null
  return { startTime: data.start_time, endTime: data.end_time }
}

/**
 * Determine shift bucket from a time string.
 */
export function getShiftBucketFromTime(
  timeStr: string
): "6a-2p" | "2p-10p" | "10p-6a" {
  const hour = new Date(timeStr).getHours()
  if (hour >= 6 && hour < 14) return "6a-2p"
  if (hour >= 14 && hour < 22) return "2p-10p"
  return "10p-6a"
}

// â”€â”€ Supervisor Personal Metrics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchSupervisorPersonalMetrics(
  storeId: string,
  _supervisorName: string,
  days: number = 7
): Promise<{
  shiftsWorked: number
  avgCompletionPct: number
  tasksCompleted: number
  tasksOrphaned: number
  hoursInTasks: number
  hoursOrphaned: number
  deadCodesTonight: number
  killLeaderCount: number
}> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split("T")[0]
  const today = new Date().toISOString().split("T")[0]

  const [shiftData, codeData] = await Promise.all([
    supabase
      .from("shift_results")
      .select("completion_pct, tasks_completed, tasks_orphaned, is_kill_leader")
      .eq("store_id", storeId)
      .gte("shift_date", cutoffStr),
    supabase
      .from("pull_events")
      .select("id")
      .eq("store_id", storeId)
      .lte("expires_date", today)
      .eq("is_verified", false),
  ])

  const shifts = shiftData.data ?? []
  const deadCodes = codeData.data?.length ?? 0

  const avgCompletion = shifts.length > 0
    ? Math.round(shifts.reduce((s, r) => s + (r.completion_pct ?? 0), 0) / shifts.length)
    : 0

  const tasksCompleted = shifts.reduce((s, r) => s + r.tasks_completed, 0)
  const tasksOrphaned = shifts.reduce((s, r) => s + (r.tasks_orphaned ?? 0), 0)

  return {
    shiftsWorked: shifts.length,
    avgCompletionPct: avgCompletion,
    tasksCompleted,
    tasksOrphaned,
    hoursInTasks: Math.round(tasksCompleted * 0.25),
    hoursOrphaned: Math.round(tasksOrphaned * 0.25),
    deadCodesTonight: deadCodes,
    killLeaderCount: shifts.filter(r => r.is_kill_leader).length,
  }
}

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

// â”€â”€ Respawn Protocol â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const RESPAWN_PIN_TTL_SECONDS = 300 // 5 minutes

/**
 * Generate a device fingerprint for binding the PIN to a device.
 * Not cryptographically strong â€” just a basic uniqueness signal.
 */
function generateDeviceFingerprint(): string {
  const ua = navigator.userAgent
  const screen = `${window.screen.width}x${window.screen.height}`
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  return btoa(`${ua}|${screen}|${tz}`).slice(0, 32)
}

/**
 * Generate a simple hash for the PIN (non-cryptographic, for display matching).
 * Real security comes from the TTL + single-use + supervisor auth.
 */
function hashPin(pin: string): string {
  let hash = 0
  for (let i = 0; i < pin.length; i++) {
    hash = ((hash << 5) - hash) + pin.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36).toUpperCase()
}

/**
 * Request a Respawn PIN for a locked-out associate.
 * Called from the associate's device when all other auth methods fail.
 */
export async function requestRespawnPin(
  eeid: string,
  welcomePhrase: string
): Promise<{
  pin: string
  channel: string
  expiresAt: string
} | null> {
  const org = await validateWelcomeCode(welcomePhrase)
  if (!org) return null

  const profile = await fetchProfileByEeidAndOrg(eeid, welcomePhrase)
  if (!profile) return null

  // Only T1/T2/T3 can use Respawn Protocol
  if ((profile.role_rank ?? 0) > 3) {
    console.log("[Respawn] Protocol only available for T1-T3")
    return null
  }

  const pin = Math.floor(100000 + Math.random() * 900000).toString()
  const pinHash = hashPin(pin)
  const channel = `respawn-${pinHash}-${Date.now()}`
  const expiresAt = new Date(Date.now() + RESPAWN_PIN_TTL_SECONDS * 1000).toISOString()
  const fingerprint = generateDeviceFingerprint()

  const storeId = profile.current_store_id
  if (!storeId) return null

  const db = supabase as any
  const { error } = await db
    .from("respawn_pins")
    .insert({
      store_id: storeId,
      associate_eeid: eeid,
      associate_org_id: org.orgId,
      pin_hash: pinHash,
      pin_channel: channel,
      expires_at: expiresAt,
      device_fingerprint: fingerprint,
    })

  if (error) {
    console.error("[Respawn] Failed to create PIN:", error.message)
    return null
  }

  return { pin, channel, expiresAt }
}

/**
 * Supervisor looks up a Respawn PIN to see who needs help.
 * Returns associate identity if PIN is valid.
 */
export async function lookupRespawnPin(
  pin: string
): Promise<{
  channel: string
  associateEeid: string
  associateName: string
  associateRole: string
  storeId: string
  expiresAt: string
} | null> {
  const pinHash = hashPin(pin)

  const db = supabase as any
  const { data, error } = await db
    .from("respawn_pins")
    .select("*")
    .eq("pin_hash", pinHash)
    .eq("is_used", false)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()

  if (error || !data) {
    console.log("[Respawn] PIN not found or expired")
    return null
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("display_name, role, role_rank")
    .eq("eeid", data.associate_eeid)
    .eq("org_id", data.associate_org_id)
    .maybeSingle()

  if (!profileData) return null

  return {
    channel: data.pin_channel,
    associateEeid: data.associate_eeid,
    associateName: profileData.display_name ?? "Unknown",
    associateRole: profileData.role ?? "crew",
    storeId: data.store_id,
    expiresAt: data.expires_at,
  }
}

/**
 * Supervisor authorizes the respawn.
 * Broadcasts to the associate's Realtime channel.
 */
export async function authorizeRespawn(
  pin: string,
  supervisorAssociateId: string
): Promise<boolean> {
  const pinHash = hashPin(pin)

  const db = supabase as any
  const { data, error } = await db
    .from("respawn_pins")
    .update({
      authorized_by_associate_id: supervisorAssociateId,
      authorized_at: new Date().toISOString(),
    })
    .eq("pin_hash", pinHash)
    .eq("is_used", false)
    .gt("expires_at", new Date().toISOString())
    .select("pin_channel")
    .maybeSingle()

  if (error || !data) {
    console.error("[Respawn] Authorization failed:", error?.message)
    return false
  }

  await supabase.channel(data.pin_channel).send({
    type: "broadcast",
    event: "authorized",
    payload: { supervisorId: supervisorAssociateId },
  })

  console.log("[Respawn] Authorization broadcast sent")
  return true
}

/**
 * Complete the respawn â€” called after associate sets new password + passkey.
 * Updates the auth credentials and marks the PIN as used.
 */
export async function completeRespawn(
  eeid: string,
  welcomePhrase: string,
  newPassword: string,
  channel: string
): Promise<boolean> {
  const profile = await registerAuthForOrg(eeid, newPassword, welcomePhrase)
  if (!profile) return false

  const db = supabase as any
  await db
    .from("respawn_pins")
    .update({ is_used: true })
    .eq("pin_channel", channel)

  await supabase.channel(channel).send({
    type: "broadcast",
    event: "respawned",
    payload: { eeid },
  })

  return true
}

// â”€â”€ OPS1: Shift Extension â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function extendShift(
  associateId: string,
  storeId: string,
  extensionMinutes: number,
  reason: "extending" | "leaving_soon"
): Promise<boolean> {
  // Get current shift to find scheduled_end_time
  const { data: shift } = await supabase
    .from("active_shifts")
    .select("scheduled_end_time, expires_at")
    .eq("associate_id", associateId)
    .eq("store_id", storeId)
    .eq("is_active", true)
    .maybeSingle()

  // Extend from scheduled_end_time if available, otherwise from now
  const baseTime = shift?.scheduled_end_time
    ? new Date(shift.scheduled_end_time)
    : new Date()

  const newExpiry = new Date(
    baseTime.getTime() + extensionMinutes * 60 * 1000
  ).toISOString()

  const { error } = await supabase
    .from("active_shifts")
    .update({
      expires_at: newExpiry,
      is_extended: true,
      extension_reason: reason === "extending"
        ? `Extended ${extensionMinutes} minutes past scheduled end`
        : "Wrapping up â€” leaving soon",
    })
    .eq("associate_id", associateId)
    .eq("store_id", storeId)
    .eq("is_active", true)

  return !error
}

export async function closeShiftEarly(
  associateId: string,
  storeId: string
): Promise<boolean> {
  const { error } = await (supabase as any)
    .from("active_shifts")
    .update({
      is_active: false,
      expires_at: new Date().toISOString(),
    })
    .eq("associate_id", associateId)
    .eq("store_id", storeId)
    .eq("is_active", true)

  return !error
}

/**
 * Check if an associate's shift has ended but they're still active.
 * Returns minutes past scheduled end, or 0 if not overdue.
 */
export async function checkShiftOverdue(
  associateId: string,
  storeId: string
): Promise<number> {
  const { data } = await (supabase as any)
    .from("active_shifts")
    .select("scheduled_end_time, is_extended")
    .eq("associate_id", associateId)
    .eq("store_id", storeId)
    .eq("is_active", true)
    .maybeSingle()

  if (!data?.scheduled_end_time || data.is_extended) return 0

  const endTime = new Date(data.scheduled_end_time).getTime()
  const now = Date.now()
  const overdueMs = now - endTime

  return overdueMs > 0 ? Math.floor(overdueMs / 60000) : 0
}

// â”€â”€ OPS2: Holdover Protocol â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function initiateHoldover(
  associateId: string,
  storeId: string,
  shiftBucket: "6a-2p" | "2p-10p" | "10p-6a"
): Promise<string | null> {
  // Extend the associate's shift by 2 hours
  await extendShift(associateId, storeId, 120, "extending")

  const { data, error } = await (supabase as any)
    .from("holdover_events")
    .insert({
      store_id: storeId,
      associate_id: associateId,
      shift_bucket: shiftBucket,
      shift_date: new Date().toISOString().split("T")[0],
    })
    .select("id")
    .maybeSingle()

  if (error || !data) return null

  // Notify all supervisors on shift
  const { data: supervisors } = await (supabase as any)
    .from("active_shifts")
    .select("associate_id, associates!associate_id(role_rank)")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .neq("associate_id", associateId)

  for (const s of supervisors ?? []) {
    if ((s as any).associates?.role_rank >= 2) {
      await (supabase as any).from("pings").insert({
        store_id: storeId,
        from_associate_id: associateId,
        to_associate_id: s.associate_id,
        message: "No relief for next shift. Holdover protocol active. Who can I call?",
        ping_type: "direct",
      })
    }
  }

  return data.id
}

export async function resolveHoldover(
  holdoverId: string,
  reliefAssociateId: string
): Promise<boolean> {
  const { error } = await (supabase as any)
    .from("holdover_events")
    .update({
      resolved_at: new Date().toISOString(),
      relief_associate_id: reliefAssociateId,
    })
    .eq("id", holdoverId)

  return !error
}

// â”€â”€ OPS3: Split Shift â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function markSplitShiftDeparture(
  associateId: string,
  storeId: string,
  returnTime: string
): Promise<boolean> {
  const { error } = await (supabase as any)
    .from("active_shifts")
    .update({
      is_active: false,
      is_split_shift: true,
      split_return_time: returnTime,
    })
    .eq("associate_id", associateId)
    .eq("store_id", storeId)
    .eq("is_active", true)

  return !error
}

export async function markSplitShiftReturn(
  associateId: string,
  storeId: string
): Promise<boolean> {
  const { error } = await (supabase as any)
    .from("active_shifts")
    .update({
      is_active: true,
      expires_at: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
    })
    .eq("associate_id", associateId)
    .eq("store_id", storeId)
    .eq("is_split_shift", true)

  return !error
}

// â”€â”€ OPS4: Early Departure â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function initiateEarlyDeparture(
  associateId: string,
  storeId: string,
  reason: string
): Promise<boolean> {
  // Orphan all assigned incomplete tasks
  await (supabase as any)
    .from("tasks")
    .update({ is_orphaned: true, assigned_to_associate_id: null })
    .eq("assigned_to_associate_id", associateId)
    .eq("store_id", storeId)
    .eq("is_completed", false)

  // Notify supervisor
  const { data: supervisors } = await (supabase as any)
    .from("active_shifts")
    .select("associate_id, associates!associate_id(role_rank)")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .neq("associate_id", associateId)

  for (const s of supervisors ?? []) {
    if ((s as any).associates?.role_rank >= 2) {
      await (supabase as any).from("pings").insert({
        store_id: storeId,
        from_associate_id: associateId,
        to_associate_id: s.associate_id,
        message: `Early departure: ${reason}. Their tasks have been orphaned.`,
        ping_type: "direct",
      })
    }
  }

  // Close the shift
  await closeShiftEarly(associateId, storeId)
  return true
}

// â”€â”€ Break System â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const BREAK_DURATION_MINUTES = 30

/**
 * Check if an associate can take their break right now.
 * T2+ requires another T2+ to be present and not on break.
 */
export async function canTakeBreak(
  associateId: string,
  storeId: string,
  roleRank: number
): Promise<{
  allowed: boolean
  coveringName?: string
  reason?: string
}> {
  // Check current shift status
  const { data: shift } = await supabase
    .from("active_shifts")
    .select("break_taken, on_break")
    .eq("associate_id", associateId)
    .eq("store_id", storeId)
    .eq("is_active", true)
    .maybeSingle()

  if (!shift) {
    return { allowed: false, reason: "No active shift found." }
  }

  if (shift.break_taken) {
    return { allowed: false, reason: "You've already taken your break this shift." }
  }

  if (shift.on_break) {
    return { allowed: false, reason: "You're already on break." }
  }

  // T2+ constraint â€” need another supervisor on floor
  if (roleRank >= 2) {
    const { data: otherActive } = await supabase
      .from("active_shifts")
      .select(`
        associate_id,
        on_break,
        associates!associate_id(name, role_rank)
      `)
      .eq("store_id", storeId)
      .eq("is_active", true)
      .neq("associate_id", associateId)

    const coveringSup = (otherActive ?? []).find((s: any) => {
      const rank = s.associates?.role_rank ?? 0
      return rank >= 2 && !s.on_break
    })

    if (!coveringSup) {
      return {
        allowed: false,
        reason: "No other supervisor on floor. You can't take a break until relief arrives.",
      }
    }

    return {
      allowed: true,
      coveringName: (coveringSup as any).associates?.name ?? "your cover",
    }
  }

  return { allowed: true }
}

/**
 * Start a break for an associate.
 */
export async function startBreak(
  associateId: string,
  storeId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("active_shifts")
    .update({
      on_break: true,
      break_started_at: new Date().toISOString(),
    })
    .eq("associate_id", associateId)
    .eq("store_id", storeId)
    .eq("is_active", true)

  return !error
}

/**
 * End a break for an associate.
 * Marks break_taken so they can't take another.
 */
export async function endBreak(
  associateId: string,
  storeId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("active_shifts")
    .update({
      on_break: false,
      break_ended_at: new Date().toISOString(),
      break_taken: true,
    })
    .eq("associate_id", associateId)
    .eq("store_id", storeId)
    .eq("is_active", true)

  return !error
}

/**
 * Get break status for an associate.
 * Returns seconds remaining on break, or 0 if not on break.
 */
export async function getBreakStatus(
  associateId: string,
  storeId: string
): Promise<{
  onBreak: boolean
  breakTaken: boolean
  secondsRemaining: number
  breakStartedAt: string | null
}> {
  const { data } = await supabase
    .from("active_shifts")
    .select("on_break, break_taken, break_started_at")
    .eq("associate_id", associateId)
    .eq("store_id", storeId)
    .eq("is_active", true)
    .maybeSingle()

  if (!data) return { onBreak: false, breakTaken: false, secondsRemaining: 0, breakStartedAt: null }

  let secondsRemaining = 0
  if (data.on_break && data.break_started_at) {
    const elapsed = Math.floor((Date.now() - new Date(data.break_started_at).getTime()) / 1000)
    secondsRemaining = Math.max(0, BREAK_DURATION_MINUTES * 60 - elapsed)
  }

  return {
    onBreak: data.on_break ?? false,
    breakTaken: data.break_taken ?? false,
    secondsRemaining,
    breakStartedAt: data.break_started_at,
  }
}

/**
 * Send break-end ping to associate.
 * Called when break timer hits 0.
 */
export async function sendBreakEndPing(
  associateId: string,
  storeId: string
): Promise<void> {
  await supabase.from("pings").insert({
    store_id: storeId,
    from_associate_id: associateId,
    to_associate_id: associateId,
    message: "Break time's up. Get back out there. ðŸ’ª",
    ping_type: "direct",
  })

  // Auto-end the break
  await endBreak(associateId, storeId)
}

// â”€â”€ Placement Match â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Check if an associate needs to complete placement.
 */
export async function needsPlacement(profileId: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("placement_complete, placement_skipped")
    .eq("id", profileId)
    .maybeSingle()

  if (!data) return false
  return !data.placement_complete && !data.placement_skipped
}

/**
 * Mark placement as complete.
 */
export async function completePlacement(profileId: string): Promise<void> {
  await supabase
    .from("profiles")
    .update({
      placement_complete: true,
      placement_completed_at: new Date().toISOString(),
    })
    .eq("id", profileId)
}

/**
 * Skip placement (for experienced transfers).
 */
export async function skipPlacement(profileId: string): Promise<void> {
  await supabase
    .from("profiles")
    .update({
      placement_skipped: true,
      placement_complete: true,
    })
    .eq("id", profileId)
}
/**
 * Notify supervisor that an associate is beginning onboarding.
 * Also auto-assigns a placeholder task to the active supervisor.
 */
export async function notifyPlacementStarted(
  associateName: string,
  storeId: string,
  associateId: string
): Promise<void> {
  // Find active supervisor on floor
  const { data: supervisors } = await supabase
    .from("active_shifts")
    .select(`
      associate_id,
      associates!associate_id(name, role_rank)
    `)
    .eq("store_id", storeId)
    .eq("is_active", true)
    .neq("associate_id", associateId)

  const supervisor = (supervisors ?? []).find(
    (s: any) => (s.associates?.role_rank ?? 0) >= 2
  )

  if (!supervisor) return

  // Ping supervisor â€” onboarding started
  await supabase.from("pings").insert({
    store_id: storeId,
    from_associate_id: associateId,
    to_associate_id: supervisor.associate_id,
    message: `User: ${associateName} is beginning onboarding.`,
    ping_type: "direct",
  })

  // Auto-assign placeholder task to supervisor
  await supabase.from("tasks").insert({
    store_id: storeId,
    task_name: `Guide ${associateName} through onboarding`,
    archetype: "MOD",
    priority: "normal",
    is_sticky: false,
    is_completed: false,
    assigned_to: (supervisor as any).associates?.name ?? "Supervisor",
    assigned_to_associate_id: supervisor.associate_id,
    queue_position: 1,
    base_points: 0,
    shift_bucket: "any",
    lifecycle_state: "active",
  })
}

/**
 * Notify supervisor that onboarding is complete.
 */
export async function notifyPlacementComplete(
  associateName: string,
  storeId: string,
  associateId: string
): Promise<void> {
  const { data: supervisors } = await supabase
    .from("active_shifts")
    .select(`associate_id, associates!associate_id(role_rank)`)
    .eq("store_id", storeId)
    .eq("is_active", true)
    .neq("associate_id", associateId)

  const supervisor = (supervisors ?? []).find(
    (s: any) => (s.associates?.role_rank ?? 0) >= 2
  )

  if (!supervisor) return

  await supabase.from("pings").insert({
    store_id: storeId,
    from_associate_id: associateId,
    to_associate_id: supervisor.associate_id,
    message: `User: ${associateName} has finished onboarding.`,
    ping_type: "direct",
  })
}

/**
 * Notify supervisor that the associate is dropping into their first real match.
 */
export async function notifyFirstDrop(
  associateName: string,
  storeId: string,
  associateId: string
): Promise<void> {
  const { data: supervisors } = await supabase
    .from("active_shifts")
    .select(`associate_id, associates!associate_id(role_rank)`)
    .eq("store_id", storeId)
    .eq("is_active", true)
    .neq("associate_id", associateId)

  const supervisor = (supervisors ?? []).find(
    (s: any) => (s.associates?.role_rank ?? 0) >= 2
  )

  if (!supervisor) return

  await supabase.from("pings").insert({
    store_id: storeId,
    from_associate_id: associateId,
    to_associate_id: supervisor.associate_id,
    message: `User: ${associateName} is dropping into their first real match. Wish them good luck! ðŸŽ®`,
    ping_type: "direct",
  })

  // Auto-complete the onboarding task assigned to supervisor
  await supabase
    .from("tasks")
    .update({ is_completed: true, lifecycle_state: "completed" })
    .eq("store_id", storeId)
    .eq("task_name", `Guide ${associateName} through onboarding`)
    .eq("is_completed", false)
}

// â”€â”€ Task Lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Check if a task lockout is currently active for a store and shift bucket.
 */
export async function checkLockoutActive(
  storeId: string,
  shiftBucket: string
): Promise<boolean> {
  const { data } = await supabase
    .from("task_lockout_windows")
    .select("lockout_start, lockout_end, is_active")
    .eq("store_id", storeId)
    .eq("shift_bucket", shiftBucket)
    .eq("is_active", true)
    .maybeSingle()

  if (!data) return false

  const now = new Date()
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`

  return currentTime >= data.lockout_start && currentTime < data.lockout_end
}

/**
 * Override lockout for this session (supervisor only).
 */
export async function overrideLockout(
  storeId: string,
  shiftBucket: string
): Promise<boolean> {
  const { error } = await supabase
    .from("task_lockout_windows")
    .update({ is_active: false })
    .eq("store_id", storeId)
    .eq("shift_bucket", shiftBucket)

  return !error
}

/**
 * Restore lockout after supervisor override.
 */
export async function restoreLockout(
  storeId: string,
  shiftBucket: string
): Promise<boolean> {
  const { error } = await supabase
    .from("task_lockout_windows")
    .update({ is_active: true })
    .eq("store_id", storeId)
    .eq("shift_bucket", shiftBucket)

  return !error
}

/**
 * Mark a task as partially complete with progress notes.
 * Called during extraction when an associate can't finish.
 */
export async function markTaskPartial(
  taskId: string,
  progressPct: number,
  progressNotes: string,
  associateName: string
): Promise<boolean> {
  const { error } = await supabase
    .from("tasks")
    .update({
      lifecycle_state: "partial",
      progress_pct: progressPct,
      progress_notes: progressNotes,
      last_progress_by: associateName,
      last_progress_at: new Date().toISOString(),
      is_completed: false,
      pending_verification: false,
    })
    .eq("id", taskId)

  return !error
}

/**
 * Fetch tasks for an associate filtered by their shift bucket.
 * Shows: tasks for their bucket + 'any' tasks + inherited cross-shift-critical tasks.
 * Excludes completed tasks from other buckets.
 */
export async function fetchTasksForShift(
  storeId: string,
  shiftBucket: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("store_id", storeId)
    .eq("is_completed", false)
    .or(`shift_bucket.eq.${shiftBucket},shift_bucket.eq.any,shift_bucket.is.null`)
    .not("lifecycle_state", "eq", "completed")
    .order("neglect_count", { ascending: false }) // neglected first
    .order("queue_position", { ascending: true })

  if (error || !data) return []
  return data
}

function getNextBucket(
  bucket: "6a-2p" | "2p-10p" | "10p-6a"
): "6a-2p" | "2p-10p" | "10p-6a" {
  const order: Array<"6a-2p" | "2p-10p" | "10p-6a"> = ["6a-2p", "2p-10p", "10p-6a"]
  const idx = order.indexOf(bucket)
  return order[(idx + 1) % 3]
}

/**
 * The Neglect Engine.
 * Run at the end of each shift bucket.
 * Escalates unfinished tasks through the lifecycle states.
 */
export async function runNeglectEngine(
  storeId: string,
  endingBucket: "6a-2p" | "2p-10p" | "10p-6a"
): Promise<void> {
  // Find all unfinished tasks for this shift bucket
  const { data: unfinished } = await supabase
    .from("tasks")
    .select("id, task_name, neglect_count, lifecycle_state, is_cross_shift_critical, progress_pct, progress_notes, last_progress_by, shift_bucket, last_neglected_at")
    .eq("store_id", storeId)
    .eq("is_completed", false)
    .eq("pending_verification", false)
    .or(`shift_bucket.eq.${endingBucket},shift_bucket.is.null`)
    .not("lifecycle_state", "in", '("completed","incident")')

  if (!unfinished) return

  const now = new Date().toISOString()

  for (const task of unfinished) {
    const newNeglectCount = task.neglect_count + 1

    // Determine new lifecycle state
    let newState: string
    if (newNeglectCount >= 4) newState = "incident"
    else if (newNeglectCount === 3) newState = "critical"
    else if (newNeglectCount === 2) newState = "neglected"
    else newState = "orphaned"

    // Update the task
    await supabase
      .from("tasks")
      .update({
        lifecycle_state: newState,
        neglect_count: newNeglectCount,
        last_neglected_at: now,
      })
      .eq("id", task.id)

    // Create incident record at 4+ neglects
    if (newNeglectCount >= 4) {
      const { data: existing } = await supabase
        .from("task_incidents")
        .select("id")
        .eq("task_id", task.id)
        .eq("is_resolved", false)
        .maybeSingle()

      if (!existing) {
        await supabase.from("task_incidents").insert({
          store_id: storeId,
          task_id: task.id,
          task_name: task.task_name,
          shift_bucket: endingBucket,
          neglect_count: newNeglectCount,
          first_neglected_at: task.last_neglected_at ?? now,
        })
      }
    }

    // Handle cross-shift-critical tasks â€” copy to next shift's queue
    if (task.is_cross_shift_critical && newState === "orphaned") {
      const nextBucket = getNextBucket(endingBucket)

      await supabase
        .from("tasks")
        .update({
          shift_bucket: nextBucket,
          inherited_from_bucket: endingBucket,
          inherited_from_associate: task.last_progress_by ?? "Previous shift",
          inherited_at: now,
          lifecycle_state: "active",
          neglect_count: newNeglectCount,
        })
      .eq("id", task.id)
    }
  }

  // Ping supervisor about neglected/critical tasks
  const neglected = unfinished.filter(t => t.neglect_count + 1 >= 2)
  if (neglected.length > 0) {
    const { data: supervisors } = await supabase
      .from("active_shifts")
      .select("associate_id")
      .eq("store_id", storeId)
      .eq("is_active", true)

    for (const sup of supervisors ?? []) {
      await supabase.from("pings").insert({
        store_id: storeId,
        from_associate_id: sup.associate_id,
        to_associate_id: sup.associate_id,
        message: `${neglected.length} task${neglected.length !== 1 ? "s" : ""} neglected from ${endingBucket} shift. Check the task queue.`,
        ping_type: "direct",
      })
    }
  }
}

/**
 * Fetch task incidents for Store Manager work order feed.
 */
export async function fetchTaskIncidents(storeId: string): Promise<Array<{
  id: string
  taskName: string
  shiftBucket: string
  neglectCount: number
  firstNeglectedAt: string
  isResolved: boolean
}>> {
  const { data, error } = await supabase
    .from("task_incidents")
    .select("*")
    .eq("store_id", storeId)
    .order("neglect_count", { ascending: false })

  if (error || !data) return []

  return data.map(i => ({
    id: i.id,
    taskName: i.task_name,
    shiftBucket: i.shift_bucket,
    neglectCount: i.neglect_count,
    firstNeglectedAt: i.first_neglected_at,
    isResolved: i.is_resolved,
  }))
}

export async function resolveTaskIncident(
  incidentId: string,
  resolvedById: string,
  notes: string
): Promise<boolean> {
  const { error } = await supabase
    .from("task_incidents")
    .update({
      is_resolved: true,
      resolved_by: resolvedById,
      resolved_at: new Date().toISOString(),
      resolution_notes: notes,
    })
    .eq("id", incidentId)

  return !error
}

export async function closeShift(
  associateId: string,
  storeId: string
): Promise<boolean> {
  // Get the shift bucket before closing
  const { data: shift } = await supabase
    .from("active_shifts")
    .select("shift_bucket")
    .eq("associate_id", associateId)
    .eq("store_id", storeId)
    .eq("is_active", true)
    .maybeSingle()

  // Close the shift
  const { error } = await supabase
    .from("active_shifts")
    .update({ is_active: false, expires_at: new Date().toISOString() })
    .eq("associate_id", associateId)
    .eq("store_id", storeId)

  if (error) return false

  // Check if this was the LAST active associate for this shift bucket
  if (shift?.shift_bucket) {
    const { count } = await supabase
      .from("active_shifts")
      .select("*", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("is_active", true)
      .eq("shift_bucket", shift.shift_bucket)

    // If no more active associates in this bucket, run neglect engine
    if ((count ?? 0) === 0) {
      await runNeglectEngine(storeId, shift.shift_bucket as "6a-2p" | "2p-10p" | "10p-6a")
    }
  }
  
  return true
}
