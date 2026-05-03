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

// â”€â”€ Supervisor Personal Metrics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchSupervisorPersonalMetrics(
  storeId: string,
  _supervisorName: string,
  days: number = 7
): Promise<{
  shiftsWorked: number
  avgCompletionPct: number
  tasksCompleted: number
  tasksOrphaned: number
  hoursInTasks: number
  hoursOrphaned: number
  deadCodesTonight: number
  killLeaderCount: number
}> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split("T")[0]
  const today = new Date().toISOString().split("T")[0]

  const [shiftData, codeData] = await Promise.all([
    supabase
      .from("shift_results")
      .select("completion_pct, tasks_completed, tasks_orphaned, is_kill_leader")
      .eq("store_id", storeId)
      .gte("shift_date", cutoffStr),
    supabase
      .from("pull_events")
      .select("id")
      .eq("store_id", storeId)
      .lte("expires_date", today)
      .eq("is_verified", false),
  ])

  const shifts = shiftData.data ?? []
  const deadCodes = codeData.data?.length ?? 0

  const avgCompletion = shifts.length > 0
    ? Math.round(shifts.reduce((s, r) => s + (r.completion_pct ?? 0), 0) / shifts.length)
    : 0

  const tasksCompleted = shifts.reduce((s, r) => s + r.tasks_completed, 0)
  const tasksOrphaned = shifts.reduce((s, r) => s + (r.tasks_orphaned ?? 0), 0)

  return {
    shiftsWorked: shifts.length,
    avgCompletionPct: avgCompletion,
    tasksCompleted,
    tasksOrphaned,
    hoursInTasks: Math.round(tasksCompleted * 0.25),
    hoursOrphaned: Math.round(tasksOrphaned * 0.25),
    deadCodesTonight: deadCodes,
    killLeaderCount: shifts.filter(r => r.is_kill_leader).length,
  }
}





