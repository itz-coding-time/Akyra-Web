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

