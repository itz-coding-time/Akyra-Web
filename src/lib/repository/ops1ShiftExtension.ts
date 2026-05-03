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

