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

// â”€â”€ Report Aliases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ReportAliasItem {
  id: string
  name: string
  reportAlias: string | null
  category?: string
  archetype?: string
  type: "inventory" | "task"
}

/**
 * Fetch all inventory items and tasks for a store
 * with their current report aliases.
 */
export async function fetchReportAliases(
  storeId: string
): Promise<ReportAliasItem[]> {
  const [inventoryRes, tasksRes] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("id, item_name, category, report_alias")
      .eq("store_id", storeId)
      .order("category")
      .order("item_name"),
    supabase
      .from("tasks")
      .select("id, task_name, archetype, report_alias")
      .eq("store_id", storeId)
      .order("archetype")
      .order("task_name"),
  ])

  const inventoryItems: ReportAliasItem[] = (inventoryRes.data ?? []).map(i => ({
    id: i.id,
    name: i.item_name,
    reportAlias: i.report_alias,
    category: i.category,
    type: "inventory",
  }))

  const taskItems: ReportAliasItem[] = (tasksRes.data ?? []).map(t => ({
    id: t.id,
    name: t.task_name,
    reportAlias: t.report_alias,
    archetype: t.archetype,
    type: "task",
  }))

  return [...inventoryItems, ...taskItems]
}

/**
 * Update report alias for a single inventory item or task.
 */
export async function updateReportAlias(
  id: string,
  type: "inventory" | "task",
  alias: string | null
): Promise<boolean> {
  if (type === "inventory") {
    const { error } = await supabase
      .from("inventory_items")
      .update({ report_alias: alias || null })
      .eq("id", id)
    if (error) {
      console.error("updateReportAlias failed:", error.message)
      return false
    }
  } else {
    const { error } = await supabase
      .from("tasks")
      .update({ report_alias: alias || null })
      .eq("id", id)
    if (error) {
      console.error("updateReportAlias failed:", error.message)
      return false
    }
  }
  return true
}

/**
 * Bulk update report aliases for a store.
 * Used when auto-generating aliases.
 */
export async function bulkUpdateReportAliases(
  updates: Array<{ id: string; type: "inventory" | "task"; alias: string }>
): Promise<boolean> {
  for (const update of updates) {
    const success = await updateReportAlias(update.id, update.type, update.alias)
    if (!success) return false
  }
  return true
}

/**
 * Auto-generate report aliases for all items in a store.
 * Groups by category/archetype and assigns sequential aliases.
 *
 * Inventory: "Bread Item A", "Bread Item B", "Prep Item A"...
 * Tasks: "Kitchen Task A", "MOD Task A"...
 *
 * Only generates aliases for items that don't already have one.
 */
export async function autoGenerateAliases(
  storeId: string
): Promise<number> {
  const items = await fetchReportAliases(storeId)
  const unaliased = items.filter(i => !i.reportAlias)

  if (unaliased.length === 0) return 0

  // Group by category/archetype
  const groups: Record<string, ReportAliasItem[]> = {}
  for (const item of unaliased) {
    const group = item.type === "inventory"
      ? `${item.category} (Inventory)`
      : `${item.archetype} (Task)`
    if (!groups[group]) groups[group] = []
    groups[group].push(item)
  }

  const updates: Array<{ id: string; type: "inventory" | "task"; alias: string }> = []
  const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

  // Get existing aliases to avoid collisions
  const existing = items.filter(i => i.reportAlias).map(i => i.reportAlias)

  for (const [group, groupItems] of Object.entries(groups)) {
    const isInventory = group.includes("(Inventory)")
    const categoryName = group.replace(" (Inventory)", "").replace(" (Task)", "")
    const prefix = isInventory ? `${categoryName} Item` : `${categoryName} Task`

    let letterIndex = 0
    for (const item of groupItems) {
      // Find next available letter
      let alias = `${prefix} ${ALPHA[letterIndex]}`
      while (existing.includes(alias) || updates.some(u => u.alias === alias)) {
        letterIndex++
        alias = `${prefix} ${ALPHA[letterIndex] ?? letterIndex}`
      }
      updates.push({ id: item.id, type: item.type, alias })
      letterIndex++
    }
  }

  await bulkUpdateReportAliases(updates)
  return updates.length
}

/**
 * Generate a research-ready report for a store.
 * Uses report_alias everywhere â€” no org-specific names.
 */
export async function generateResearchReport(
  storeId: string,
  startDate: string,
  endDate: string
): Promise<{
  period: { start: string; end: string }
  taskMetrics: Array<{
    alias: string
    archetype: string
    completions: number
    avgActualMinutes: number
    expectedMinutes: number
    deltaAvgPct: number
    fastCompletions: number
    slowCompletions: number
  }>
  inventoryMetrics: Array<{
    alias: string
    category: string
    totalPulled: number
    wasteEvents: number
    wasteQuantity: number
    avgCodeLife: number
  }>
  shiftMetrics: {
    totalShifts: number
    avgTasksCompleted: number
    avgCompletionPct: number
    killLeaderCount: number
    burnCardsEarned: number
  }
}> {
  // Task metrics â€” uses report_alias
  const { data: verifications } = await supabase
    .from("task_verifications")
    .select(`
      actual_minutes,
      expected_minutes,
      delta_pct,
      trigger_type,
      tasks!task_id(report_alias, archetype, expected_minutes)
    `)
    .eq("store_id", storeId)
    .gte("created_at", startDate)
    .lte("created_at", endDate)

  // Group task metrics by alias
  const taskMap: Record<string, any> = {}
  for (const v of (verifications ?? [])) {
    const alias = (v as any).tasks?.report_alias ?? "Unaliased Task"
    const archetype = (v as any).tasks?.archetype ?? "Unknown"
    if (!taskMap[alias]) {
      taskMap[alias] = {
        alias,
        archetype,
        completions: 0,
        totalActualMinutes: 0,
        expectedMinutes: (v as any).tasks?.expected_minutes ?? 0,
        totalDeltaPct: 0,
        fastCompletions: 0,
        slowCompletions: 0,
      }
    }
    taskMap[alias].completions++
    taskMap[alias].totalActualMinutes += v.actual_minutes
    taskMap[alias].totalDeltaPct += v.delta_pct
    if (v.trigger_type === "fast") taskMap[alias].fastCompletions++
    if (v.trigger_type === "slow") taskMap[alias].slowCompletions++
  }

  const taskMetrics = Object.values(taskMap).map((t: any) => ({
    alias: t.alias,
    archetype: t.archetype,
    completions: t.completions,
    avgActualMinutes: t.completions > 0 ? Math.round(t.totalActualMinutes / t.completions) : 0,
    expectedMinutes: t.expectedMinutes,
    deltaAvgPct: t.completions > 0 ? Math.round(t.totalDeltaPct / t.completions) : 0,
    fastCompletions: t.fastCompletions,
    slowCompletions: t.slowCompletions,
  }))

  // Inventory metrics â€” uses report_alias
  const { data: pullEvents } = await supabase
    .from("pull_events")
    .select(`
      quantity_pulled,
      waste_quantity,
      expires_date,
      pulled_date,
      inventory_items!item_id(report_alias, category, code_life_days)
    `)
    .eq("store_id", storeId)
    .gte("pulled_date", startDate)
    .lte("pulled_date", endDate)

  const inventoryMap: Record<string, any> = {}
  for (const p of (pullEvents ?? [])) {
    const alias = (p as any).inventory_items?.report_alias ?? "Unaliased Item"
    const category = (p as any).inventory_items?.category ?? "Unknown"
    const codeLife = (p as any).inventory_items?.code_life_days ?? 0
    if (!inventoryMap[alias]) {
      inventoryMap[alias] = {
        alias,
        category,
        totalPulled: 0,
        wasteEvents: 0,
        wasteQuantity: 0,
        codeLifeTotal: 0,
        codeLifeCount: 0,
      }
    }
    inventoryMap[alias].totalPulled += p.quantity_pulled
    if (p.waste_quantity) {
      inventoryMap[alias].wasteEvents++
      inventoryMap[alias].wasteQuantity += p.waste_quantity
    }
    if (codeLife > 0) {
      inventoryMap[alias].codeLifeTotal += codeLife
      inventoryMap[alias].codeLifeCount++
    }
  }

  const inventoryMetrics = Object.values(inventoryMap).map((i: any) => ({
    alias: i.alias,
    category: i.category,
    totalPulled: i.totalPulled,
    wasteEvents: i.wasteEvents,
    wasteQuantity: i.wasteQuantity,
    avgCodeLife: i.codeLifeCount > 0 ? Math.round(i.codeLifeTotal / i.codeLifeCount) : 0,
  }))

  // Shift metrics
  const { data: shiftResults } = await supabase
    .from("shift_results")
    .select("tasks_completed, tasks_total, completion_pct, is_kill_leader, burn_cards_earned")
    .eq("store_id", storeId)
    .gte("shift_date", startDate)
    .lte("shift_date", endDate)

  const results = shiftResults ?? []
  const shiftMetrics = {
    totalShifts: results.length,
    avgTasksCompleted: results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.tasks_completed, 0) / results.length)
      : 0,
    avgCompletionPct: results.length > 0
      ? Math.round(results.reduce((s, r) => s + (r.completion_pct ?? 0), 0) / results.length)
      : 0,
    killLeaderCount: results.filter(r => r.is_kill_leader).length,
    burnCardsEarned: results.reduce((s, r) => s + (r.burn_cards_earned ?? 0), 0),
  }

  return {
    period: { start: startDate, end: endDate },
    taskMetrics,
    inventoryMetrics,
    shiftMetrics,
  }
}





