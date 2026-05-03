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

// â”€â”€ Equipment Issues (The Black Box) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchEquipmentIssues(storeId: string): Promise<EquipmentIssue[]> {
  const { data, error } = await supabase
    .from("equipment_issues")
    .select("*, associates!reported_by_associate_id(name)")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("fetchEquipmentIssues failed:", error.message)
    return []
  }
  return data ?? []
}

export async function createEquipmentIssue(
  storeId: string,
  reportedAtStoreId: string,
  associateId: string,
  category: string,
  description: string,
  photoFile?: File
): Promise<EquipmentIssue | null> {
  let photoUrl: string | null = null

  // Upload photo if provided
  if (photoFile) {
    const fileName = `${storeId}/${Date.now()}-${photoFile.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("equipment-photos")
      .upload(fileName, photoFile, { upsert: false })

    if (uploadError) {
      console.error("Photo upload failed:", uploadError.message)
    } else {
      const { data: urlData } = supabase.storage
        .from("equipment-photos")
        .getPublicUrl(uploadData.path)
      photoUrl = urlData.publicUrl
    }
  }

  const { data, error } = await supabase
    .from("equipment_issues")
    .insert({
      store_id: storeId,
      reported_at_store_id: reportedAtStoreId,
      reported_by_associate_id: associateId || null,
      category,
      description,
      photo_url: photoUrl,
      status: "New",
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error("createEquipmentIssue failed:", error.message)
    return null
  }
  return data
}

export async function updateEquipmentIssueStatus(
  issueId: string,
  status: "New" | "Pending" | "Resolved",
  resolvedByAssociateId?: string
): Promise<boolean> {
  type EquipmentIssueUpdate = Database["public"]["Tables"]["equipment_issues"]["Update"]
  const update: EquipmentIssueUpdate = { status }

  if (status === "Resolved" && resolvedByAssociateId) {
    update.resolved_by_associate_id = resolvedByAssociateId
    update.resolved_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from("equipment_issues")
    .update(update)
    .eq("id", issueId)

  if (error) {
    console.error("updateEquipmentIssueStatus failed:", error.message)
    return false
  }
  return true
}

