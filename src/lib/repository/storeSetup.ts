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

// â”€â”€ Store Setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function seedAssociatesForStore(
  storeId: string,
  associates: StoreConfigAssociate[]
): Promise<{ success: number; failed: number; errors?: string[] }> {
  let success = 0
  let failed = 0
  const errors: string[] = []

  const ROLE_RANK: Record<string, number> = {
    crew: 1, supervisor: 2, assistant_manager: 3,
    store_manager: 4, district_admin: 5, org_admin: 6, db_admin: 7,
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("org_id")
    .eq("id", storeId)
    .maybeSingle()

  if (storeError || !store) {
    return {
      success: 0,
      failed: associates.length,
      errors: [storeError?.message ?? "Store not found for associate seed."],
    }
  }

  for (const assoc of associates) {
    const eeid = assoc.eeid?.trim()
    const name = assoc.name?.trim()
    const role = assoc.role || "crew"
    const roleRank = ROLE_RANK[role] ?? 1

    if (!eeid || !name) {
      failed++
      errors.push(`Skipped associate with missing ${!eeid ? "EEID" : "name"}.`)
      continue
    }

    const { data: existingProfile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("eeid", eeid)
      .eq("org_id", store.org_id)
      .maybeSingle()

    if (profileLookupError) {
      failed++
      errors.push(`${name}: ${profileLookupError.message}`)
      continue
    }

    let profileId = existingProfile?.id ?? null

    if (profileId) {
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({
          display_name: name,
          role,
          role_rank: roleRank,
          current_store_id: storeId,
        })
        .eq("id", profileId)

      if (profileUpdateError) {
        failed++
        errors.push(`${name}: ${profileUpdateError.message}`)
        continue
      }
    } else {
      profileId = crypto.randomUUID()
      const { error: profileInsertError } = await supabase
        .from("profiles")
        .insert({
          id: profileId,
          eeid,
          display_name: name,
          role,
          role_rank: roleRank,
          org_id: store.org_id,
          current_store_id: storeId,
        })

      if (profileInsertError) {
        failed++
        errors.push(`${name}: ${profileInsertError.message}`)
        continue
      }
    }

    const { error } = await supabase
      .from("associates")
      .upsert({
        store_id: storeId,
        profile_id: profileId,
        name,
        role,
        role_rank: roleRank,
        current_archetype: "Float",
        scheduled_days: "",
        default_start_time: assoc.default_start_time,
        default_end_time: assoc.default_end_time,
      }, { onConflict: "store_id,name" })

    if (error) {
      failed++
      errors.push(`${name}: ${error.message}`)
    } else {
      success++
    }
  }

  return { success, failed, errors: errors.length ? errors : undefined }
}

export async function deleteProfileAndRosterEntry(profile: Profile): Promise<boolean> {
  if (profile.current_store_id) {
    const { error: associateError } = await supabase
      .from("associates")
      .delete()
      .eq("store_id", profile.current_store_id)
      .eq("profile_id", profile.id)

    if (associateError) {
      console.error("deleteProfileAndRosterEntry associate delete failed:", associateError.message)
      return false
    }
  }

  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", profile.id)

  if (error) {
    console.error("deleteProfileAndRosterEntry profile delete failed:", error.message)
    return false
  }

  return true
}

export async function seedTasksForStore(
  storeId: string,
  tasks: StoreConfigTask[]
): Promise<{ success: number; failed: number; errors?: string[] }> {
  // Clear existing tasks first
  const { error: deleteError } = await supabase.from("tasks").delete().eq("store_id", storeId)
  if (deleteError) return { success: 0, failed: tasks.length, errors: [deleteError.message] }

  const { error } = await supabase.from("tasks").insert(
    tasks.map(t => ({
      store_id: storeId,
      task_name: t.task_name,
      archetype: t.archetype,
      priority: t.priority,
      is_sticky: t.is_sticky,
      expected_minutes: t.expected_minutes,
      sop_content: t.sop_content ?? null,
      base_points: 10,
      is_completed: false,
      is_pull_task: false,
      is_truck_task: false,
    }))
  )

  if (error) return { success: 0, failed: tasks.length, errors: [error.message] }
  return { success: tasks.length, failed: 0 }
}

export async function seedInventoryForStore(
  storeId: string,
  items: StoreConfigInventoryItem[]
): Promise<{ success: number; failed: number; errors?: string[] }> {
  const { error: deleteError } = await supabase.from("inventory_items").delete().eq("store_id", storeId)
  if (deleteError) return { success: 0, failed: items.length, errors: [deleteError.message] }

  const { error } = await supabase.from("inventory_items").insert(
    items.map(i => ({
      store_id: storeId,
      item_name: i.item_name,
      build_to: i.category,
      category: i.category,
      amount_needed: i.amount_needed,
      code_life_days: i.code_life_days ?? null,
      amount_have: null,
      is_pulled: false,
    }))
  )

  if (error) return { success: 0, failed: items.length, errors: [error.message] }
  return { success: items.length, failed: 0 }
}

export async function seedTableItemsForStore(
  storeId: string,
  items: StoreConfigTableItem[]
): Promise<{ success: number; failed: number; errors?: string[] }> {
  const { error: deleteError } = await supabase.from("table_items").delete().eq("store_id", storeId)
  if (deleteError) return { success: 0, failed: items.length, errors: [deleteError.message] }

  const { error } = await supabase.from("table_items").insert(
    items.map(i => ({
      store_id: storeId,
      item_name: i.item_name,
      station: i.station,
      is_initialed: true,
    }))
  )

  if (error) return { success: 0, failed: items.length, errors: [error.message] }
  return { success: items.length, failed: 0 }
}

export async function exportStoreConfig(storeId: string): Promise<StoreConfig> {
  const [associates, tasks, inventory, tableItems] = await Promise.all([
    supabase.from("associates").select("*").eq("store_id", storeId),
    supabase.from("tasks").select("*").eq("store_id", storeId),
    supabase.from("inventory_items").select("*").eq("store_id", storeId),
    supabase.from("table_items").select("*").eq("store_id", storeId),
  ])

  return {
    associates: (associates.data ?? []).map(a => ({
      eeid: "", // EEIDs are on profiles, not associates
      name: a.name,
      role: a.role,
      default_start_time: a.default_start_time,
      default_end_time: a.default_end_time,
    })),
    tasks: (tasks.data ?? []).map(t => ({
      task_name: t.task_name,
      archetype: t.archetype,
      priority: t.priority as StoreConfigTask["priority"],
      is_sticky: t.is_sticky,
      expected_minutes: t.expected_minutes ?? 15,
      sop_content: t.sop_content ?? undefined,
    })),
    inventory: (inventory.data ?? []).map(i => ({
      item_name: i.item_name,
      category: i.category,
      amount_needed: i.amount_needed ?? 0,
      code_life_days: i.code_life_days ?? undefined,
    })),
    table_items: (tableItems.data ?? []).map(i => ({
      item_name: i.item_name,
      station: i.station,
    })),
  }
}

