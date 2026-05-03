import { supabase } from '../supabase'
import type { Database } from "../../types/database.types"
import type { PullEventSummary } from "../../types/pullWorkflow.types"
import type { StoreConfigAssociate, StoreConfigTask, StoreConfigInventoryItem, StoreConfigTableItem, StoreConfig } from "../../types/storeConfig.types"
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser"
import { calculateStoreRankings } from "./pingSystem"
import { assignTaskToAssociate } from "./taskQueue"

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





