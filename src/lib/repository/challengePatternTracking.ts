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

// â”€â”€ Challenge Pattern Tracking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function trackChallengePattern(params: {
  storeId: string
  taskId: string
  taskName: string
  associateId: string
  associateName: string
  supervisorId: string | null
  supervisorName: string | null
  patternType: "associate_task" | "supervisor_task" | "associate_supervisor"
}): Promise<void> {
  const { data: store } = await (supabase as any)
    .from("stores")
    .select("org_id, district_id")
    .eq("id", params.storeId)
    .maybeSingle()

  let query = (supabase as any)
    .from("challenge_patterns")
    .select("id, challenge_count")
    .eq("store_id", params.storeId)
    .eq("pattern_type", params.patternType)
    .eq("is_resolved", false)
    .gt("window_end", new Date().toISOString().split("T")[0])

  if (params.patternType === "associate_task") {
    query = query.eq("associate_id", params.associateId).eq("task_id", params.taskId)
  } else if (params.patternType === "supervisor_task") {
    query = query.eq("supervisor_id", params.supervisorId).eq("task_id", params.taskId)
  } else {
    query = query.eq("associate_id", params.associateId).eq("supervisor_id", params.supervisorId)
  }

  const { data: existing } = await query.maybeSingle()

  if (existing) {
    const newCount = existing.challenge_count + 1
    const flagLevel =
      params.patternType === "associate_task"
        ? newCount >= 3 ? "retrain" : "watch"
        : params.patternType === "supervisor_task"
        ? newCount >= 2 ? "sop_review" : "watch"
        : newCount >= 3 ? "bias_review" : "watch"

    await (supabase as any)
      .from("challenge_patterns")
      .update({ challenge_count: newCount, flag_level: flagLevel, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
  } else {
    await (supabase as any).from("challenge_patterns").insert({
      store_id: params.storeId,
      org_id: store?.org_id ?? "",
      district_id: store?.district_id ?? null,
      task_id: params.taskId,
      task_name: params.taskName,
      associate_id: params.associateId,
      associate_name: params.associateName,
      supervisor_id: params.supervisorId,
      supervisor_name: params.supervisorName,
      pattern_type: params.patternType,
      challenge_count: 1,
      flag_level: "watch",
    })
  }
}





