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

// â”€â”€ Placement Match â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Check if an associate needs to complete placement.
 */
export async function needsPlacement(profileId: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("placement_complete, placement_skipped")
    .eq("id", profileId)
    .maybeSingle()

  if (!data) return false
  return !data.placement_complete && !data.placement_skipped
}

/**
 * Mark placement as complete.
 */
export async function completePlacement(profileId: string): Promise<void> {
  await supabase
    .from("profiles")
    .update({
      placement_complete: true,
      placement_completed_at: new Date().toISOString(),
    })
    .eq("id", profileId)
}

/**
 * Skip placement (for experienced transfers).
 */
export async function skipPlacement(profileId: string): Promise<void> {
  await supabase
    .from("profiles")
    .update({
      placement_skipped: true,
      placement_complete: true,
    })
    .eq("id", profileId)
}
/**
 * Notify supervisor that an associate is beginning onboarding.
 * Also auto-assigns a placeholder task to the active supervisor.
 */
export async function notifyPlacementStarted(
  associateName: string,
  storeId: string,
  associateId: string
): Promise<void> {
  // Find active supervisor on floor
  const { data: supervisors } = await supabase
    .from("active_shifts")
    .select(`
      associate_id,
      associates!associate_id(name, role_rank)
    `)
    .eq("store_id", storeId)
    .eq("is_active", true)
    .neq("associate_id", associateId)

  const supervisor = (supervisors ?? []).find(
    (s: any) => (s.associates?.role_rank ?? 0) >= 2
  )

  if (!supervisor) return

  // Ping supervisor â€” onboarding started
  await supabase.from("pings").insert({
    store_id: storeId,
    from_associate_id: associateId,
    to_associate_id: supervisor.associate_id,
    message: `User: ${associateName} is beginning onboarding.`,
    ping_type: "direct",
  })

  // Auto-assign placeholder task to supervisor
  await supabase.from("tasks").insert({
    store_id: storeId,
    task_name: `Guide ${associateName} through onboarding`,
    archetype: "MOD",
    priority: "normal",
    is_sticky: false,
    is_completed: false,
    assigned_to: (supervisor as any).associates?.name ?? "Supervisor",
    assigned_to_associate_id: supervisor.associate_id,
    queue_position: 1,
    base_points: 0,
    shift_bucket: "any",
    lifecycle_state: "active",
  })
}

/**
 * Notify supervisor that onboarding is complete.
 */
export async function notifyPlacementComplete(
  associateName: string,
  storeId: string,
  associateId: string
): Promise<void> {
  const { data: supervisors } = await supabase
    .from("active_shifts")
    .select(`associate_id, associates!associate_id(role_rank)`)
    .eq("store_id", storeId)
    .eq("is_active", true)
    .neq("associate_id", associateId)

  const supervisor = (supervisors ?? []).find(
    (s: any) => (s.associates?.role_rank ?? 0) >= 2
  )

  if (!supervisor) return

  await supabase.from("pings").insert({
    store_id: storeId,
    from_associate_id: associateId,
    to_associate_id: supervisor.associate_id,
    message: `User: ${associateName} has finished onboarding.`,
    ping_type: "direct",
  })
}

/**
 * Notify supervisor that the associate is dropping into their first real match.
 */
export async function notifyFirstDrop(
  associateName: string,
  storeId: string,
  associateId: string
): Promise<void> {
  const { data: supervisors } = await supabase
    .from("active_shifts")
    .select(`associate_id, associates!associate_id(role_rank)`)
    .eq("store_id", storeId)
    .eq("is_active", true)
    .neq("associate_id", associateId)

  const supervisor = (supervisors ?? []).find(
    (s: any) => (s.associates?.role_rank ?? 0) >= 2
  )

  if (!supervisor) return

  await supabase.from("pings").insert({
    store_id: storeId,
    from_associate_id: associateId,
    to_associate_id: supervisor.associate_id,
    message: `User: ${associateName} is dropping into their first real match. Wish them good luck! ðŸŽ®`,
    ping_type: "direct",
  })

  // Auto-complete the onboarding task assigned to supervisor
  await supabase
    .from("tasks")
    .update({ is_completed: true, lifecycle_state: "completed" })
    .eq("store_id", storeId)
    .eq("task_name", `Guide ${associateName} through onboarding`)
    .eq("is_completed", false)
}

