import { supabase } from '../supabase'
import type { Database } from "../../types/database.types"
import type { PullEventSummary } from "../../types/pullWorkflow.types"
import type { StoreConfigAssociate, StoreConfigTask, StoreConfigInventoryItem, StoreConfigTableItem, StoreConfig } from "../../types/storeConfig.types"
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





