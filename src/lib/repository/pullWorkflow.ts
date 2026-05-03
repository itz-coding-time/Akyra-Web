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

// â”€â”€ Pull Workflow & Code Tracking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Called when an associate confirms a bread pull is complete.
 * Creates pull_event rows for each item that was actually pulled (quantity > 0).
 */
export async function confirmPull(
  storeId: string,
  items: Array<{
    itemId: string
    itemName: string
    category: string
    quantityPulled: number
    codeLifeDays: number
  }>
): Promise<boolean> {
  const today = new Date()
  const pulledDate = today.toISOString().split("T")[0]

  const events = items
    .filter(item => item.quantityPulled > 0 && item.codeLifeDays > 0)
    .map(item => {
      const expires = new Date(today)
      expires.setDate(expires.getDate() + item.codeLifeDays)

      return {
        store_id: storeId,
        item_id: item.itemId,
        item_name: item.itemName,
        category: item.category,
        quantity_pulled: item.quantityPulled,
        pulled_date: pulledDate,
        expires_date: expires.toISOString().split("T")[0],
      }
    })

  if (events.length === 0) return true

  const { error } = await supabase
    .from("pull_events")
    .insert(events)

  if (error) {
    console.error("confirmPull failed:", error.message)
    return false
  }

  console.log(`Pull confirmed: ${events.length} pull events created`)
  return true
}

/**
 * Fetch pull events expiring on or before today.
 * Groups by item, calculates rolling math to determine if used through.
 */
export async function fetchExpiringPullEvents(
  storeId: string
): Promise<PullEventSummary[]> {
  const today = new Date().toISOString().split("T")[0]

  // Fetch expiring events
  const { data: expiring, error: expiringError } = await supabase
    .from("pull_events")
    .select("*")
    .eq("store_id", storeId)
    .lte("expires_date", today)
    .eq("is_verified", false)

  if (expiringError || !expiring || expiring.length === 0) return []

  // For each unique item, calculate total pulled in the code window
  const itemIds = [...new Set(expiring.map(e => e.item_id))]

  const summaries: PullEventSummary[] = []

  for (const itemId of itemIds) {
    const itemEvents = expiring.filter(e => e.item_id === itemId)
    const firstEvent = itemEvents[0]

    // Get the build_to (amount_needed) for this item
    const { data: inventoryItem } = await supabase
      .from("inventory_items")
      .select("amount_needed, code_life_days")
      .eq("id", itemId)
      .maybeSingle()

    const buildTo = inventoryItem?.amount_needed ?? 0
    const codeLifeDays = inventoryItem?.code_life_days ?? 3

    // Total pulled in the full code window (not just expiring events)
    const windowStart = new Date(firstEvent.expires_date)
    windowStart.setDate(windowStart.getDate() - codeLifeDays)
    const windowStartStr = windowStart.toISOString().split("T")[0]

    const { data: windowEvents } = await supabase
      .from("pull_events")
      .select("quantity_pulled")
      .eq("store_id", storeId)
      .eq("item_id", itemId)
      .gte("pulled_date", windowStartStr)
      .lte("pulled_date", today)

    const totalPulled = (windowEvents ?? []).reduce(
      (sum, e) => sum + e.quantity_pulled, 0
    )

    // If total pulled >= build_to, likely used through
    const likelyUsedThrough = totalPulled >= buildTo

    summaries.push({
      itemId,
      itemName: firstEvent.item_name,
      category: firstEvent.category,
      expiresDate: firstEvent.expires_date,
      totalPulled,
      buildTo,
      likelyUsedThrough,
      pullEventIds: itemEvents.map(e => e.id),
    })
  }

  return summaries
}

/**
 * Mark expiring pull events as verified (used through â€” no waste).
 */
export async function verifyPullEventsUsedThrough(
  pullEventIds: string[]
): Promise<boolean> {
  const { error } = await supabase
    .from("pull_events")
    .update({ is_verified: true })
    .in("id", pullEventIds)

  if (error) {
    console.error("verifyPullEventsUsedThrough failed:", error.message)
    return false
  }
  return true
}

/**
 * Record waste for pull events that were NOT fully used through.
 * Creates a waste confirmation task.
 */
export async function recordPullWaste(
  storeId: string,
  pullEventIds: string[],
  itemName: string,
  wasteQuantity: number
): Promise<boolean> {
  // Mark pull events with waste quantity
  const { error: updateError } = await supabase
    .from("pull_events")
    .update({
      is_verified: true,
      waste_quantity: wasteQuantity,
    })
    .in("id", pullEventIds)

  if (updateError) {
    console.error("recordPullWaste update failed:", updateError.message)
    return false
  }

  // Create a waste confirmation task
  const { error: taskError } = await supabase
    .from("tasks")
    .insert({
      store_id: storeId,
      task_name: `Waste Sheet: ${wasteQuantity}x ${itemName}`,
      archetype: "MOD",
      priority: "High",
      is_sticky: false,
      expected_minutes: 5,
      base_points: 10,
      is_completed: false,
      is_pull_task: false,
      is_truck_task: false,
      task_description: `Record ${wasteQuantity} unit(s) of ${itemName} on the waste sheet and confirm.`,
    })

  if (taskError) {
    console.error("recordPullWaste task creation failed:", taskError.message)
    return false
  }

  return true
}

/**
 * Check if there are any expiring pull events for today.
 * Used to show/hide the Code Check task.
 */
export async function hasExpiringPullEvents(storeId: string): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0]

  const { count, error } = await supabase
    .from("pull_events")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId)
    .lte("expires_date", today)
    .eq("is_verified", false)

  if (error) return false
  return (count ?? 0) > 0
}

export function getCurrentShiftBucket(): "6a-2p" | "2p-10p" | "10p-6a" {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 14) return "6a-2p"
  if (hour >= 14 && hour < 22) return "2p-10p"
  return "10p-6a"
}





