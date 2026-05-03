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

