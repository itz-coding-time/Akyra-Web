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

// â”€â”€ Assistance Requests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function createAssistanceRequest(
  storeId: string,
  taskId: string,
  associateId: string,
  level: 1 | 2
): Promise<string | null> {
  const supervisorCode = level === 2
    ? Math.random().toString(36).substring(2, 8).toUpperCase()
    : null

  const { data, error } = await supabase
    .from("assistance_requests")
    .insert({
      store_id: storeId,
      task_id: taskId,
      requested_by_associate_id: associateId,
      request_level: level,
      supervisor_code: supervisorCode,
    })
    .select("id, supervisor_code")
    .maybeSingle()

  if (error) {
    console.error("createAssistanceRequest failed:", error.message)
    return null
  }

  await supabase
    .from("tasks")
    .update({ priority: level === 2 ? "Critical" : "High" })
    .eq("id", taskId)

  return data?.id ?? null
}

export async function fetchActiveAssistanceRequests(
  storeId: string
): Promise<Array<{
  id: string
  taskId: string
  taskName: string
  associateName: string
  level: number
  supervisorCode: string | null
  createdAt: string
}>> {
  const { data, error } = await supabase
    .from("assistance_requests")
    .select(`
      id,
      request_level,
      supervisor_code,
      created_at,
      tasks!task_id(task_name),
      associates!requested_by_associate_id(name)
    `)
    .eq("store_id", storeId)
    .eq("is_resolved", false)
    .order("created_at", { ascending: false })

  if (error || !data) return []

  return data.map(r => ({
    id: r.id,
    taskId: (r as any).tasks?.id ?? "",
    taskName: (r as any).tasks?.task_name ?? "Unknown task",
    associateName: (r as any).associates?.name ?? "Unknown",
    level: r.request_level,
    supervisorCode: r.supervisor_code,
    createdAt: r.created_at,
  }))
}

export async function resolveAssistanceRequest(
  requestId: string,
  resolvedByAssociateId: string,
  supervisorCode?: string
): Promise<{ success: boolean; message: string }> {
  const { data: request } = await supabase
    .from("assistance_requests")
    .select("supervisor_code, request_level")
    .eq("id", requestId)
    .maybeSingle()

  if (!request) return { success: false, message: "Request not found" }

  if (request.request_level === 2 && request.supervisor_code !== supervisorCode) {
    return { success: false, message: "Invalid code" }
  }

  const { error } = await supabase
    .from("assistance_requests")
    .update({
      is_resolved: true,
      resolved_by_associate_id: resolvedByAssociateId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", requestId)

  if (error) return { success: false, message: error.message }
  return { success: true, message: "Resolved" }
}





