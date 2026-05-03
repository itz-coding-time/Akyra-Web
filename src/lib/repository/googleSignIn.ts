import { supabase } from '../supabase'
import type { Database } from "../../types/database.types"
import type { PullEventSummary } from "../../types/pullWorkflow.types"
import type { StoreConfigAssociate, StoreConfigTask, StoreConfigInventoryItem, StoreConfigTableItem, StoreConfig } from "../../types/storeConfig.types"
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser"
import { fetchProfileByEeid } from "./profiles"

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





