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

// â”€â”€ Store Manager Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchTopPerformers(
  storeId: string,
  days: number = 30
): Promise<Array<{
  associateId: string
  associateName: string
  avgCompletionPct: number
  totalShifts: number
  burnCardsEarned: number
  squadCardsEarned: number
  killLeaderCount: number
  mvpCount: number
}>> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split("T")[0]

  const db = supabase as any
  const { data, error } = await db
    .from("shift_results")
    .select(`
      associate_id,
      completion_pct,
      burn_cards_earned,
      is_kill_leader,
      associates!associate_id(name)
    `)
    .eq("store_id", storeId)
    .gte("shift_date", cutoffStr)

  if (error || !data) return []

  const grouped: Record<string, any> = {}
  for (const r of data as any[]) {
    const id = r.associate_id
    if (!grouped[id]) {
      grouped[id] = {
        associateId: id,
        associateName: r.associates?.name ?? "Unknown",
        totalCompletionPct: 0,
        totalShifts: 0,
        burnCardsEarned: 0,
        squadCardsEarned: 0,
        killLeaderCount: 0,
        mvpCount: 0,
      }
    }
    grouped[id].totalCompletionPct += r.completion_pct ?? 0
    grouped[id].totalShifts++
    grouped[id].burnCardsEarned += r.burn_cards_earned ?? 0
    grouped[id].squadCardsEarned += r.squad_cards_earned ?? 0
    if (r.is_kill_leader) grouped[id].killLeaderCount++
    if (r.is_mvp) grouped[id].mvpCount++
  }

  return Object.values(grouped)
    .map((g: any) => ({
      ...g,
      avgCompletionPct: g.totalShifts > 0
        ? Math.round(g.totalCompletionPct / g.totalShifts)
        : 0,
    }))
    .sort((a, b) => b.avgCompletionPct - a.avgCompletionPct)
}

export async function fetchAccountabilityFeed(
  storeId: string,
  limit: number = 20
): Promise<Array<{
  id: string
  type: "fast" | "slow" | "challenge" | "accepted"
  taskName: string
  associateName: string
  supervisorName: string | null
  deltaPct: number
  status: string
  createdAt: string
}>> {
  const db = supabase as any
  const { data, error } = await db
    .from("task_verifications")
    .select(`
      id,
      trigger_type,
      delta_pct,
      status,
      created_at,
      challenge_submitted,
      tasks!task_id(task_name),
      associates!associate_id(name),
      supervisor:associates!supervisor_id(name)
    `)
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return (data as any[]).map(v => ({
    id: v.id,
    type: v.challenge_submitted ? "challenge" as const :
          v.status === "resolved_accepted" ? "accepted" as const :
          v.trigger_type as "fast" | "slow",
    taskName: v.tasks?.task_name ?? "Unknown",
    associateName: v.associates?.name ?? "Unknown",
    supervisorName: v.supervisor?.name ?? null,
    deltaPct: v.delta_pct,
    status: v.status,
    createdAt: v.created_at,
  }))
}

export async function fetchStoreMetrics(
  storeId: string,
  days: number = 30
): Promise<{
  deadCodes: number
  wasteQuantity: number
  totalPulled: number
  wastePercent: number
  tasksCompleted: number
  tasksOrphaned: number
  hoursInTasks: number
  hoursOrphaned: number
}> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split("T")[0]

  const [pullData, shiftData] = await Promise.all([
    supabase
      .from("pull_events")
      .select("quantity_pulled, waste_quantity, is_verified")
      .eq("store_id", storeId)
      .gte("pulled_date", cutoffStr),
    supabase
      .from("shift_results")
      .select("tasks_completed, tasks_orphaned, tasks_total")
      .eq("store_id", storeId)
      .gte("shift_date", cutoffStr),
  ])

  const pulls = pullData.data ?? []
  const shifts = shiftData.data ?? []

  const deadCodes = pulls.filter(p => p.waste_quantity && p.waste_quantity > 0).length
  const wasteQuantity = pulls.reduce((s, p) => s + (p.waste_quantity ?? 0), 0)
  const totalPulled = pulls.reduce((s, p) => s + p.quantity_pulled, 0)
  const wastePercent = totalPulled > 0 ? Math.round((wasteQuantity / totalPulled) * 100) : 0

  const tasksCompleted = shifts.reduce((s, r) => s + r.tasks_completed, 0)
  const tasksOrphaned = shifts.reduce((s, r) => s + (r.tasks_orphaned ?? 0), 0)

  return {
    deadCodes,
    wasteQuantity,
    totalPulled,
    wastePercent,
    tasksCompleted,
    tasksOrphaned,
    hoursInTasks: Math.round(tasksCompleted * 0.25),
    hoursOrphaned: Math.round(tasksOrphaned * 0.25),
  }
}

