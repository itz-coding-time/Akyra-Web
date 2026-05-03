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

