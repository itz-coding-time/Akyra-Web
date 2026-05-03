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

