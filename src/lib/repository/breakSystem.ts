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

