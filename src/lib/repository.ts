import { supabase } from "./supabase"
import type { Database } from "../types/database.types"

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

// ── Profiles ──────────────────────────────────────────────────────────────

export async function fetchProfileByEeid(eeid: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("eeid", eeid)
    .maybeSingle()

  if (error) {
    console.error("fetchProfileByEeid failed:", error.message)
    return null
  }
  return data
}

// ── Licensing ─────────────────────────────────────────────────────────────

export async function fetchLicenseByPhrase(phrase: string): Promise<License | null> {
  const { data, error } = await supabase
    .from("licenses")
    .select("*")
    .eq("welcome_phrase", phrase)
    .maybeSingle()

  if (error) {
    console.error("fetchLicenseByPhrase failed:", error.message)
    return null
  }
  return data
}

export function isLicenseUsable(license: License): boolean {
  return license.status === "active" || license.status === "past_due"
}

export function isLicenseOnboardable(license: License): boolean {
  return license.status === "active"
}

// ── Organizations ─────────────────────────────────────────────────────────

export async function fetchOrganizationById(id: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("fetchOrganizationById failed:", error.message)
    return null
  }
  return data
}

export async function fetchAllOrganizations(): Promise<Organization[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .order("name")

  if (error) {
    console.error("fetchAllOrganizations failed:", error.message)
    return []
  }
  return data ?? []
}

// ── Stores ────────────────────────────────────────────────────────────────

export async function fetchStoreByNumberAndOrg(
  storeNumber: string,
  orgId: string
): Promise<Store | null> {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("store_number", storeNumber)
    .eq("org_id", orgId)
    .maybeSingle()

  if (error) {
    console.error("fetchStoreByNumberAndOrg failed:", error.message)
    return null
  }
  return data
}

// ── Associates ────────────────────────────────────────────────────────────

export async function fetchAssociatesByStore(storeId: string): Promise<Associate[]> {
  const { data, error } = await supabase
    .from("associates")
    .select("*")
    .eq("store_id", storeId)
    .order("name")

  if (error) {
    console.error("fetchAssociatesByStore failed:", error.message)
    return []
  }
  return data ?? []
}

// ── Auth ──────────────────────────────────────────────────────────────────

export async function signInWithEeidAndPin(
  eeid: string,
  pin: string
): Promise<Profile | null> {
  const syntheticEmail = `${eeid}@akyra.internal`

  const { error } = await supabase.auth.signInWithPassword({
    email: syntheticEmail,
    password: pin,
  })

  if (error) {
    console.error("signInWithEeidAndPin failed:", error.message)
    return null
  }

  return fetchProfileByEeid(eeid)
}

export async function registerAuthForProfile(
  eeid: string,
  pin: string
): Promise<Profile | null> {
  const syntheticEmail = `${eeid}@akyra.internal`

  // Step 1: Create Supabase Auth user
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: syntheticEmail,
    password: pin,
  })

  if (signUpError || !signUpData.user) {
    console.error("registerAuthForProfile signUp failed:", signUpError?.message)
    return null
  }

  // Step 2: Write auth_uid back to the profile
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ auth_uid: signUpData.user.id })
    .eq("eeid", eeid)

  if (updateError) {
    console.error("registerAuthForProfile profile update failed:", updateError.message)
    return null
  }

  return fetchProfileByEeid(eeid)
}

export async function createProfileFromOnboarding(
  eeid: string,
  displayName: string,
  orgId: string,
  storeId: string,
  authUserId: string,
  role: string = "supervisor"
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: authUserId,
      auth_uid: authUserId,
      eeid,
      display_name: displayName,
      org_id: orgId,
      current_store_id: storeId,
      role: role as Profile["role"],
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error("createProfileFromOnboarding failed:", error.message)
    return null
  }
  return data
}

export async function fetchLicenseForProfile(
  profile: Profile
): Promise<License | null> {
  if (!profile.org_id) return null

  const { data, error } = await supabase
    .from("licenses")
    .select("*")
    .eq("org_id", profile.org_id)
    .maybeSingle()

  if (error) {
    console.error("fetchLicenseForProfile failed:", error.message)
    return null
  }
  return data
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

// ── Station ───────────────────────────────────────────────────────────────

export async function claimStation(
  associateId: string,
  archetype: string
): Promise<boolean> {
  const { error } = await supabase
    .from("associates")
    .update({ current_archetype: archetype })
    .eq("id", associateId)

  if (error) {
    console.error("claimStation failed:", error.message)
    return false
  }
  return true
}

// ── Tasks ─────────────────────────────────────────────────────────────────

export async function fetchTasksForAssociate(
  storeId: string,
  archetype: string,
  associateName: string
): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("store_id", storeId)
    .eq("is_completed", false)
    .or(`archetype.eq.${archetype},assigned_to.eq.${associateName}`)
    .order("priority", { ascending: false })

  if (error) {
    console.error("fetchTasksForAssociate failed:", error.message)
    return []
  }
  return data ?? []
}

export async function fetchTasksForSupervisor(storeId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("store_id", storeId)
    .eq("is_completed", false)
    .order("priority", { ascending: false })

  if (error) {
    console.error("fetchTasksForSupervisor failed:", error.message)
    return []
  }
  return data ?? []
}

/**
 * Escalation Engine — runs after expireStaleShifts
 * Finds tasks assigned to associates whose sessions just expired,
 * clears the assignee, bumps priority to Critical, sets is_orphaned = true
 */
export async function orphanTasksForExpiredSessions(
  storeId: string,
  expiredAssociateIds: string[]
): Promise<number> {
  if (expiredAssociateIds.length === 0) return 0

  // Get names of expired associates to match against assigned_to
  const { data: associates } = await supabase
    .from("associates")
    .select("name")
    .in("id", expiredAssociateIds)

  if (!associates || associates.length === 0) return 0

  const names = associates.map(a => a.name)

  // Find tasks assigned to these associates that are not yet complete
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, task_name, assigned_to")
    .eq("store_id", storeId)
    .eq("is_completed", false)
    .in("assigned_to", names)

  if (!tasks || tasks.length === 0) return 0

  const taskIds = tasks.map(t => t.id)

  // Orphan them: clear assignee, bump to Critical, set orphaned flag
  const { error } = await supabase
    .from("tasks")
    .update({
      assigned_to: null,
      priority: "Critical",
      is_orphaned: true,
      pending_verification: false,
    })
    .in("id", taskIds)

  if (error) {
    console.error("orphanTasksForExpiredSessions failed:", error.message)
    return 0
  }

  console.log(`Escalation Engine: ${tasks.length} task(s) orphaned from expired sessions`)
  tasks.forEach(t => console.log(`  ↑ "${t.task_name}" (was assigned to ${t.assigned_to})`))

  return tasks.length
}

export async function fetchOrphanedTasks(storeId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("store_id", storeId)
    .eq("is_orphaned", true)
    .eq("is_completed", false)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("fetchOrphanedTasks failed:", error.message)
    return []
  }
  return data ?? []
}

export async function clearOrphanFlag(taskId: string): Promise<boolean> {
  const { error } = await supabase
    .from("tasks")
    .update({ is_orphaned: false })
    .eq("id", taskId)

  if (error) {
    console.error("clearOrphanFlag failed:", error.message)
    return false
  }
  return true
}

export async function fetchPendingVerificationTasks(storeId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("store_id", storeId)
    .eq("pending_verification", true)
    .eq("is_completed", false)

  if (error) {
    console.error("fetchPendingVerificationTasks failed:", error.message)
    return []
  }
  return data ?? []
}

export async function markTaskPendingVerification(
  taskId: string,
  completedBy: string
): Promise<boolean> {
  const { error } = await supabase
    .from("tasks")
    .update({ pending_verification: true, completed_by: completedBy })
    .eq("id", taskId)

  if (error) {
    console.error("markTaskPendingVerification failed:", error.message)
    return false
  }
  return true
}

export async function verifyTaskComplete(taskId: string): Promise<boolean> {
  const { error } = await supabase
    .from("tasks")
    .update({ is_completed: true, pending_verification: false })
    .eq("id", taskId)

  if (error) {
    console.error("verifyTaskComplete failed:", error.message)
    return false
  }
  return true
}

export async function rejectTaskCompletion(taskId: string): Promise<boolean> {
  const { error } = await supabase
    .from("tasks")
    .update({ pending_verification: false, completed_by: null })
    .eq("id", taskId)

  if (error) {
    console.error("rejectTaskCompletion failed:", error.message)
    return false
  }
  return true
}

// ── Flip Checklists (table_items) ─────────────────────────────────────────

export async function fetchTableItemsByStation(
  storeId: string,
  station: string
): Promise<TableItem[]> {
  const { data, error } = await supabase
    .from("table_items")
    .select("*")
    .eq("store_id", storeId)
    .eq("station", station)

  if (error) {
    console.error("fetchTableItemsByStation failed:", error.message)
    return []
  }
  return data ?? []
}

export async function flagTableItem(
  itemId: string,
  initialed: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from("table_items")
    .update({ is_initialed: initialed })
    .eq("id", itemId)

  if (error) {
    console.error("flagTableItem failed:", error.message)
    return false
  }
  return true
}

// ── Pull Lists (inventory_items) ──────────────────────────────────────────

export async function fetchInventoryByCategory(
  storeId: string,
  category: string
): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("store_id", storeId)
    .eq("category", category)
    .order("item_name")

  if (error) {
    console.error("fetchInventoryByCategory failed:", error.message)
    return []
  }
  return data ?? []
}

export async function updateInventoryAmountHave(
  itemId: string,
  amountHave: number
): Promise<boolean> {
  const { error } = await supabase
    .from("inventory_items")
    .update({ amount_have: amountHave })
    .eq("id", itemId)

  if (error) {
    console.error("updateInventoryAmountHave failed:", error.message)
    return false
  }
  return true
}

// ── Schedule ──────────────────────────────────────────────────────────────

export async function fetchScheduleForStore(
  storeId: string,
  date?: string
): Promise<ScheduleEntry[]> {
  let query = supabase
    .from("schedule_entries")
    .select("*, associates(id, name, current_archetype, role)")
    .eq("store_id", storeId)

  if (date) {
    query = query.eq("shift_date", date)
  }

  const { data, error } = await query

  if (error) {
    console.error("fetchScheduleForStore failed:", error.message)
    return []
  }
  return (data ?? []) as unknown as ScheduleEntry[]
}

// ── Active Shifts (Ghost Protocol) ───────────────────────────────────────

export async function createActiveShift(
  associateId: string,
  storeId: string,
  station: string
): Promise<ActiveShift | null> {
  // Deactivate any existing active shift for this associate first
  await supabase
    .from("active_shifts")
    .update({ is_active: false })
    .eq("associate_id", associateId)
    .eq("is_active", true)

  const expiresAt = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("active_shifts")
    .insert({
      associate_id: associateId,
      store_id: storeId,
      station,
      expires_at: expiresAt,
      is_active: true,
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error("createActiveShift failed:", error.message)
    return null
  }
  return data
}

export async function updateActiveShiftStation(
  associateId: string,
  station: string
): Promise<boolean> {
  const { error } = await supabase
    .from("active_shifts")
    .update({ station })
    .eq("associate_id", associateId)
    .eq("is_active", true)

  if (error) {
    console.error("updateActiveShiftStation failed:", error.message)
    return false
  }
  return true
}

export async function expireActiveShift(associateId: string): Promise<boolean> {
  const { error } = await supabase
    .from("active_shifts")
    .update({ is_active: false })
    .eq("associate_id", associateId)
    .eq("is_active", true)

  if (error) {
    console.error("expireActiveShift failed:", error.message)
    return false
  }
  return true
}

export async function fetchActiveShiftsForStore(storeId: string): Promise<ActiveShift[]> {
  const { data, error } = await supabase
    .from("active_shifts")
    .select("*, associates(id, name, current_archetype, role, role_rank)")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .gt("expires_at", new Date().toISOString())

  if (error) {
    console.error("fetchActiveShiftsForStore failed:", error.message)
    return []
  }
  return data ?? []
}

export async function fetchMyActiveShift(associateId: string): Promise<ActiveShift | null> {
  const { data, error } = await supabase
    .from("active_shifts")
    .select("*")
    .eq("associate_id", associateId)
    .eq("is_active", true)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()

  if (error) {
    console.error("fetchMyActiveShift failed:", error.message)
    return null
  }
  return data
}

// Expire sessions past their TTL — run on dashboard refresh
export async function expireStaleShifts(storeId: string): Promise<number> {
  const { data, error } = await supabase
    .from("active_shifts")
    .update({ is_active: false })
    .eq("store_id", storeId)
    .eq("is_active", true)
    .lt("expires_at", new Date().toISOString())
    .select()

  if (error) {
    console.error("expireStaleShifts failed:", error.message)
    return 0
  }
  return data?.length ?? 0
}

export async function updateScheduleEndTime(
  entryId: string,
  endTime: string
): Promise<boolean> {
  const { error } = await supabase
    .from("schedule_entries")
    .update({ end_time: endTime })
    .eq("id", entryId)

  if (error) {
    console.error("updateScheduleEndTime failed:", error.message)
    return false
  }
  return true
}

// ── Equipment Issues (The Black Box) ─────────────────────────────────────

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
