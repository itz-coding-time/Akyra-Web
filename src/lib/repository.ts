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

// ── Auth ──────────────────────────────────────────────────────────────────

/**
 * Get the welcome phrase for an org — used to construct synthetic email.
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

  // New schema failed — try old schema (migration path)
  if (welcomePhrase) {
    console.log(`signInWithEeidAndPin: new schema failed, trying old schema for ${eeid}`)
    const oldEmail = `${eeid}@akyra.internal`
    const { data: oldData, error: oldError } = await supabase.auth.signInWithPassword({
      email: oldEmail,
      password: pin,
    })

    if (!oldError && oldData.user) {
      // Old schema worked — migrate silently
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
      // User exists — try signing in with same PIN to link
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
  const syntheticEmail = buildSyntheticEmail(eeid, welcomePhrase)
  console.log("[Auth] Registering:", syntheticEmail)

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: syntheticEmail,
    password,
  })

  let authUid: string | null = null

  if (signUpError) {
    if (signUpError.message.includes("already registered")) {
      // Try signing in — previous incomplete registration
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

  // Link auth_uid to profile
  await supabase
    .from("profiles")
    .update({ auth_uid: authUid })
    .eq("eeid", eeid)

  return fetchProfileByEeidAndOrg(eeid, welcomePhrase)
}

// ── Google Sign In ────────────────────────────────────────────────────────

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
    // No profile for this EEID — not a registered associate
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

// ── Passkeys (WebAuthn) ───────────────────────────────────────────────────

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

// ── Station ───────────────────────────────────────────────────────────────

export async function claimStation(
  associateId: string,
  archetype: string
): Promise<boolean> {
  const { error } = await supabase
    .from("associates")
    .update({ current_archetype: archetype })
    .eq("id", associateId)

  if (error) {
    console.error("claimStation failed:", error.message)
    return false
  }
  return true
}

// ── Tasks ─────────────────────────────────────────────────────────────────

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
 * Escalation Engine — runs after expireStaleShifts
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
  tasks.forEach(t => console.log(`  ↑ "${t.task_name}" (was assigned to ${t.assigned_to})`))

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
  const { error } = await supabase
    .from("tasks")
    .update({ pending_verification: true, completed_by: completedBy })
    .eq("id", taskId)

  if (error) {
    console.error("markTaskPendingVerification failed:", error.message)
    return false
  }
  return true
}

export async function verifyTaskComplete(taskId: string): Promise<boolean> {
  const { error } = await supabase
    .from("tasks")
    .update({ is_completed: true, pending_verification: false })
    .eq("id", taskId)

  if (error) {
    console.error("verifyTaskComplete failed:", error.message)
    return false
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

// ── Flip Checklists (table_items) ─────────────────────────────────────────

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

// ── Pull Lists (inventory_items) ──────────────────────────────────────────

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

// ── Shift Reset ───────────────────────────────────────────────────────────

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

// ── Pull Workflow & Code Tracking ─────────────────────────────────────────

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
 * Mark expiring pull events as verified (used through — no waste).
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

// ── JIT Task Creation ─────────────────────────────────────────────────────

export async function createJitTask(
  storeId: string,
  taskName: string,
  archetype: string,
  priority: string
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
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error("createJitTask failed:", error.message)
    return null
  }
  return data
}

// ── Task Queue ────────────────────────────────────────────────────────────

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
}>> {
  const { data: shifts, error } = await supabase
    .from("active_shifts")
    .select("associate_id, station, associates(id, name)")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .gt("expires_at", new Date().toISOString())

  if (error || !shifts) return []

  const results = await Promise.all(
    shifts
      .filter(s => s.associate_id !== excludeAssociateId)
      .map(async (shift) => {
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
        }
      })
  )

  return results
}

// ── Schedule ──────────────────────────────────────────────────────────────

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

// ── Active Shifts (Ghost Protocol) ───────────────────────────────────────

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

// Expire sessions past their TTL — run on dashboard refresh
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

// ── DB Admin ──────────────────────────────────────────────────────────────

export interface OrgSummary {
  id: string
  name: string
  brandName: string | null
  storeCount: number
  associateCount: number
  licenseStatus: string | null
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
      licenses(status)
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

// ── Org Management ────────────────────────────────────────────────────────

export async function createOrganization(
  name: string,
  brandName: string,
  brandColor: string,
  welcomePhrase: string
): Promise<{ orgId: string; licenseId: string } | null> {
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
    return null
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
    return null
  }

  console.log("[createOrganization] License created:", license.id)

  // Step 3: Seed default stations
  const { error: stationsError } = await supabase.from("org_stations").insert([
    { org_id: org.id, name: "Kitchen", emoji: "🍳", description: "Kitchen operations",   is_supervisor_only: false, is_float: false, display_order: 1 },
    { org_id: org.id, name: "POS",     emoji: "🖥️", description: "Front counter",       is_supervisor_only: false, is_float: false, display_order: 2 },
    { org_id: org.id, name: "Float",   emoji: "⚡", description: "Fill in where needed", is_supervisor_only: false, is_float: true,  display_order: 3 },
    { org_id: org.id, name: "MOD",     emoji: "👑", description: "Manager on duty",      is_supervisor_only: true,  is_float: false, display_order: 4 },
  ])

  if (stationsError) {
    console.error("[createOrganization] Stations insert failed:", stationsError.message)
    // Non-fatal — org and license were created successfully
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

// ── Org Context ───────────────────────────────────────────────────────────

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

// ── Station Management ────────────────────────────────────────────────────

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

// ── Equipment Issues (The Black Box) ─────────────────────────────────────

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

// ── Assistance Requests ───────────────────────────────────────────────────

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

// ── Leading By Exception ──────────────────────────────────────────────────

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

export async function resolveChallenge(
  verificationId: string,
  storeManagerId: string,
  verdict: "complete" | "incomplete"
): Promise<boolean> {
  const { error } = await supabase
    .from("task_verifications")
    .update({
      store_manager_id: storeManagerId,
      store_manager_verdict: verdict,
      challenge_resolved: true,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", verificationId)

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

// ── Kill Leader & Burn Cards ──────────────────────────────────────────────

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

  // Calculate benchmarks and find kill leader
  const withBenchmarks = associateResults.map(r => {
    const pct = r.tasksTotal > 0 ? r.tasksCompleted / r.tasksTotal : 0
    const benchmark =
      pct >= 0.9 ? "Exceeded" :
      pct >= 0.7 ? "Performed" :
      "Executed"
    return { ...r, pct, benchmark }
  })

  // Kill leader = highest completion pct
  const sorted = [...withBenchmarks].sort((a, b) => b.pct - a.pct)
  const killLeaderId = sorted[0]?.associateId ?? null

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
    is_kill_leader: r.associateId === killLeaderId,
  }))

  await supabase.from("shift_results").upsert(rows, {
    onConflict: "store_id,shift_bucket,shift_date,associate_id",
  })

  // Award burn card to kill leader
  if (killLeaderId) {
    const { error: rpcError } = await supabase.rpc("increment_burn_cards", { associate_id: killLeaderId })
    if (rpcError) {
      // Fallback if RPC doesn't exist yet
      const { data: profile } = await supabase
        .from("profiles")
        .select("burn_cards, lifetime_burn_cards")
        .eq("id", killLeaderId)
        .maybeSingle()

      if (profile) {
        await supabase
          .from("profiles")
          .update({
            burn_cards: (profile.burn_cards ?? 0) + 1,
            lifetime_burn_cards: (profile.lifetime_burn_cards ?? 0) + 1,
          })
          .eq("id", killLeaderId)
      }
    }
  }
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
    1 // queue position 1 — immediate
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

// ── Store Setup ───────────────────────────────────────────────────────────

export async function seedAssociatesForStore(
  storeId: string,
  associates: StoreConfigAssociate[]
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0

  const ROLE_RANK: Record<string, number> = {
    crew: 1, supervisor: 2, assistant_manager: 3,
    store_manager: 4, district_admin: 5, org_admin: 6, db_admin: 7,
  }

  for (const assoc of associates) {
    const { error } = await supabase
      .from("associates")
      .upsert({
        store_id: storeId,
        name: assoc.name,
        role: assoc.role,
        role_rank: ROLE_RANK[assoc.role] ?? 1,
        current_archetype: "Float",
        scheduled_days: "",
        default_start_time: assoc.default_start_time,
        default_end_time: assoc.default_end_time,
      }, { onConflict: "store_id,name" })

    if (error) failed++
    else success++
  }

  return { success, failed }
}

export async function seedTasksForStore(
  storeId: string,
  tasks: StoreConfigTask[]
): Promise<{ success: number; failed: number }> {
  // Clear existing tasks first
  await supabase.from("tasks").delete().eq("store_id", storeId)

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

  if (error) return { success: 0, failed: tasks.length }
  return { success: tasks.length, failed: 0 }
}

export async function seedInventoryForStore(
  storeId: string,
  items: StoreConfigInventoryItem[]
): Promise<{ success: number; failed: number }> {
  await supabase.from("inventory_items").delete().eq("store_id", storeId)

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

  if (error) return { success: 0, failed: items.length }
  return { success: items.length, failed: 0 }
}

export async function seedTableItemsForStore(
  storeId: string,
  items: StoreConfigTableItem[]
): Promise<{ success: number; failed: number }> {
  await supabase.from("table_items").delete().eq("store_id", storeId)

  const { error } = await supabase.from("table_items").insert(
    items.map(i => ({
      store_id: storeId,
      item_name: i.item_name,
      station: i.station,
      is_initialed: true,
    }))
  )

  if (error) return { success: 0, failed: items.length }
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

// ── Shift Results (GX1) ───────────────────────────────────────────────────

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

// ── Report Aliases ────────────────────────────────────────────────────────

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
 * Uses report_alias everywhere — no org-specific names.
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
  // Task metrics — uses report_alias
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

  // Inventory metrics — uses report_alias
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
