import { supabase } from "./supabase"
import type { Database } from "../types/database.types"
import type { PullEventSummary } from "../types/pullWorkflow.types"
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser"

type Profile = Database["public"]["Tables"]["profiles"]["Row"]
type ActiveShift = Database["public"]["Tables"]["active_shifts"]["Row"]
type EquipmentIssue = Database["public"]["Tables"]["equipment_issues"]["Row"]
type License = Database["public"]["Tables"]["licenses"]["Row"]
type Store = Database["public"]["Tables"]["stores"]["Row"]
type Associate = Database["public"]["Tables"]["associates"]["Row"]
type Task = Database["public"]["Tables"]["tasks"]["Row"]
type ScheduleEntry = Database["public"]["Tables"]["schedule_entries"]["Row"]
type TableItem = Database["public"]["Tables"]["table_items"]["Row"]
type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"]

const WELCOME_CODE_KEY = "akyra_org_code"

// ── Profiles & Auth ───────────────────────────────────────────────────────

export async function fetchProfileByEeid(eeid: string): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").select("*").eq("eeid", eeid).maybeSingle()
  return data
}

export async function fetchProfileByEeidAndOrg(eeid: string, welcomePhrase: string): Promise<Profile | null> {
  const { data: license } = await supabase.from("licenses").select("org_id").eq("welcome_phrase", welcomePhrase).maybeSingle()
  if (!license) return null
  const { data } = await supabase.from("profiles").select("*").eq("eeid", eeid).eq("org_id", license.org_id).maybeSingle()
  return data
}

export async function validateWelcomeCode(welcomePhrase: string): Promise<{ orgId: string; orgName: string; brandName: string | null } | null> {
  const { data } = await supabase.from("licenses").select("org_id, status, organizations(name, brand_name)").eq("welcome_phrase", welcomePhrase).maybeSingle()
  if (!data || data.status === "cancelled") return null
  const org = (data as any).organizations
  return { orgId: data.org_id, orgName: org?.name ?? "Unknown", brandName: org?.brand_name ?? null }
}

export function cacheWelcomeCode(welcomePhrase: string): void { localStorage.setItem(WELCOME_CODE_KEY, welcomePhrase) }
export function getCachedWelcomeCode(): string | null { return localStorage.getItem(WELCOME_CODE_KEY) }
export function clearWelcomeCode(): void { localStorage.removeItem(WELCOME_CODE_KEY) }

export async function fetchWelcomePhraseForOrg(orgId: string): Promise<string | null> {
  const { data } = await supabase.from("licenses").select("welcome_phrase").eq("org_id", orgId).maybeSingle()
  return data?.welcome_phrase ?? null
}

export function buildSyntheticEmail(eeid: string, welcomePhrase: string | null): string {
  return welcomePhrase ? `${eeid}.${welcomePhrase}@akyra.internal` : `${eeid}@akyra.internal`
}

export async function signInWithEeidAndOrg(eeid: string, password: string, welcomePhrase: string): Promise<Profile | null> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: buildSyntheticEmail(eeid, welcomePhrase), password })
  if (error || !data.user) return null
  return fetchProfileByEeidAndOrg(eeid, welcomePhrase)
}

export async function signInWithEeidAndPin(eeid: string, pin: string): Promise<Profile | null> {
  const profile = await fetchProfileByEeid(eeid)
  if (!profile) return null
  const phrase = await fetchWelcomePhraseForOrg(profile.org_id || "")
  return signInWithEeidAndOrg(eeid, pin, phrase || "")
}

export async function registerAuthForOrg(eeid: string, password: string, welcomePhrase: string): Promise<Profile | null> {
  const { data: license } = await supabase.from("licenses").select("org_id").eq("welcome_phrase", welcomePhrase).maybeSingle()
  if (!license) return null
  const email = buildSyntheticEmail(eeid, welcomePhrase)
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
  let authUid = signUpData.user?.id ?? null
  if (signUpError?.message.includes("already registered")) {
    const { data: signInData } = await supabase.auth.signInWithPassword({ email, password })
    authUid = signInData.user?.id ?? null
  }
  if (!authUid) return null
  await supabase.from("profiles").update({ auth_uid: authUid }).eq("eeid", eeid).eq("org_id", license.org_id)
  return fetchProfileByEeidAndOrg(eeid, welcomePhrase)
}

export async function registerAuthForProfile(eeid: string, pin: string): Promise<Profile | null> {
  const profile = await fetchProfileByEeid(eeid)
  if (!profile) return null
  const phrase = await fetchWelcomePhraseForOrg(profile.org_id || "")
  return registerAuthForOrg(eeid, pin, phrase || "")
}

export async function signOut(): Promise<void> { await supabase.auth.signOut() }

// ── Google & Passkeys ─────────────────────────────────────────────────────

export async function signInWithGoogle(redirectTo: string): Promise<void> {
  await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })
}

export async function handleGoogleCallback(eeid: string): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { kind: "error", message: "Failed" }
  const profile = await fetchProfileByEeid(eeid)
  if (!profile) return { kind: "error", message: "No profile" }
  await supabase.from("profiles").update({ google_email: session.user.email, auth_uid: session.user.id }).eq("eeid", eeid)
  return { kind: "success", profile }
}

export async function hasGoogleLinked(eeid: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("google_email").eq("eeid", eeid).maybeSingle()
  return !!(data as any)?.google_email
}

export function isPasskeySupported(): boolean { return browserSupportsWebAuthn() }
export async function hasPasskeyEnrolled(): Promise<boolean> {
  const { data } = await supabase.auth.mfa.listFactors()
  return (data?.all ?? []).some(f => f.factor_type === "webauthn")
}

export async function registerPasskey(displayName: string): Promise<any> {
  const { data: enrollData, error } = await supabase.auth.mfa.enroll({ factorType: "webauthn", friendlyName: displayName } as any)
  if (error || !enrollData) return { success: false }
  const challenge = (enrollData as any).webauthn
  const resp = await startRegistration({ optionsJSON: challenge as any })
  await supabase.auth.mfa.verify({ factorId: (enrollData as any).id, challengeId: (enrollData as any).id, code: JSON.stringify(resp) })
  return { success: true }
}

export async function signInWithPasskey(eeid: string): Promise<Profile | null> {
  const factors = await supabase.auth.mfa.listFactors()
  const f = factors.data?.all?.find(x => x.factor_type === "webauthn")
  if (!f) return null
  const { data: chal } = await supabase.auth.mfa.challenge({ factorId: f.id })
  const resp = await startAuthentication({ optionsJSON: (chal as any).webauthn as any })
  await supabase.auth.mfa.verify({ factorId: f.id, challengeId: chal!.id, code: JSON.stringify(resp) })
  return fetchProfileByEeid(eeid)
}

export async function removePasskeys(): Promise<boolean> {
  const { data } = await supabase.auth.mfa.listFactors()
  for (const f of (data?.all ?? [])) { if (f.factor_type === "webauthn") await supabase.auth.mfa.unenroll({ factorId: f.id }) }
  return true
}

// ── Admin & Hierarchy ─────────────────────────────────────────────────────

export interface OrgSummary { id: string; name: string; brandName: string | null; storeCount: number; associateCount: number; licenseStatus: string | null; welcomePhrase: string | null }
export interface RegionSummary { id: string; name: string; orgId: string; regionalAdminId: string | null; districtCount: number; storeCount: number }
export interface StoreSummary { id: string; storeNumber: string; billingStatus: string; associateCount: number; profileCount: number }

export async function fetchAllOrgs(): Promise<OrgSummary[]> {
  const { data } = await supabase.from("organizations").select("id, name, brand_name, stores(id), licenses(status, welcome_phrase)")
  if (!data) return []
  return data.map(org => ({ id: org.id, name: org.name, brandName: (org as any).brand_name, storeCount: (org as any).stores?.length ?? 0, associateCount: 0, licenseStatus: (org as any).licenses?.[0]?.status ?? null, welcomePhrase: (org as any).licenses?.[0]?.welcome_phrase ?? null }))
}

export async function fetchRegionsForOrg(orgId: string): Promise<RegionSummary[]> {
  const { data } = await (supabase as any).from("regions").select("*, districts(id, stores(id))").eq("org_id", orgId).order("name")
  return (data ?? []).map((r: any) => ({ id: r.id, name: r.name, orgId: r.org_id, regionalAdminId: r.regional_admin_id, districtCount: r.districts?.length ?? 0, storeCount: 0 }))
}

export async function fetchDistrictsForRegion(regionId: string): Promise<any[]> {
  const { data } = await (supabase as any).from("districts").select("*, stores(id)").eq("region_id", regionId).order("name")
  return (data ?? []).map((d: any) => ({ id: d.id, name: d.name, orgId: d.org_id, districtManagerId: d.district_manager_id, storeCount: d.stores?.length ?? 0 }))
}

export async function fetchDistrictsForOrg(orgId: string): Promise<any[]> {
  const { data } = await (supabase as any).from("districts").select("*, stores(id)").eq("org_id", orgId).order("name")
  return (data ?? []).map((d: any) => ({ id: d.id, name: d.name, orgId: d.org_id, districtManagerId: d.district_manager_id, storeCount: d.stores?.length ?? 0 }))
}

export async function fetchStoresForOrg(orgId: string): Promise<StoreSummary[]> {
  const { data } = await supabase.from("stores").select("*").eq("org_id", orgId).order("store_number")
  if (!data) return []
  return Promise.all(data.map(async s => ({ id: s.id, storeNumber: s.store_number, billingStatus: s.billing_status, associateCount: 0, profileCount: 0 })))
}

export async function createOrganization(name: string, brandName: string, brandColor: string, welcomePhrase: string): Promise<any> {
  const { data: org } = await supabase.from("organizations").insert({ name, brand_name: brandName, brand_color: brandColor }).select().maybeSingle()
  if (!org) return { error: "Failed" }
  await supabase.from("licenses").insert({ org_id: org.id, welcome_phrase: welcomePhrase, status: "active" })
  return { orgId: org.id }
}

export async function createRegion(orgId: string, name: string): Promise<string | null> {
  const { data } = await (supabase as any).from("regions").insert({ org_id: orgId, name }).select("id").maybeSingle()
  return data?.id ?? null
}

export async function createDistrict(orgId: string, name: string, regionId?: string): Promise<string | null> {
  const { data } = await (supabase as any).from("districts").insert({ org_id: orgId, name, region_id: regionId }).select("id").maybeSingle()
  return data?.id ?? null
}

export async function createStore(orgId: string, storeNumber: string, timezone: string, districtId?: string): Promise<string | null> {
  const { data: lic } = await supabase.from("licenses").select("id").eq("org_id", orgId).maybeSingle()
  const { data } = await (supabase as any).from("stores").insert({ org_id: orgId, store_number: storeNumber, timezone, license_id: lic?.id, billing_status: "active", district_id: districtId }).select("id").maybeSingle()
  return data?.id ?? null
}

export async function deleteOrganization(orgId: string): Promise<boolean> { await supabase.from("organizations").delete().eq("id", orgId); return true }

// ── Associates ────────────────────────────────────────────────────────────

export async function fetchAssociatesByStore(storeId: string): Promise<Associate[]> {
  const { data } = await supabase.from("associates").select("*, profiles!profile_id(id, auth_uid, eeid)").eq("store_id", storeId).order("name")
  return data ?? []
}

export async function fetchProfilesForStore(storeId: string): Promise<Profile[]> {
  const { data } = await supabase.from("profiles").select("*").eq("current_store_id", storeId).order("display_name")
  return data ?? []
}

export async function updateProfileRole(profileId: string, role: string, roleRank: number): Promise<boolean> {
  await supabase.from("profiles").update({ role, role_rank: roleRank }).eq("id", profileId); return true
}

export async function deleteProfileAndRosterEntry(profile: Profile): Promise<boolean> {
  if (profile.current_store_id) await supabase.from("associates").delete().eq("store_id", profile.current_store_id).eq("profile_id", profile.id)
  await supabase.from("profiles").delete().eq("id", profile.id); return true
}

export async function resetAssociatePassword(authUid: string, pass: string): Promise<boolean> {
  await (supabase.auth as any).admin.updateUserById(authUid, { password: pass }); return true
}

export function generateTempPassword(): string { return `Akyra${Math.floor(Math.random()*900)+100}!` }
export function getRoleDisplayName(role: string, branding: any): string { return branding?.terminology?.roles?.[role] ?? role }

// ── Station Board & Shifts ────────────────────────────────────────────────

export async function claimStation(associateId: string, storeId: string, station: string): Promise<boolean> {
  await supabase.from("associates").update({ current_archetype: station }).eq("id", associateId)
  const today = new Date().toISOString().split("T")[0]
  const { data: sched } = await supabase.from("schedule_entries").select("*").eq("associate_id", associateId).eq("store_id", storeId).eq("shift_date", today).maybeSingle()
  let exp = new Date(Date.now() + 10 * 3600000).toISOString()
  let end: string | null = null; let buck: string | null = null
  if (sched?.end_time) {
    const [h, m] = sched.end_time.split(":").map(Number)
    const d = new Date(); d.setHours(h, m, 0, 0); end = d.toISOString(); exp = new Date(d.getTime() + 1800000).toISOString()
    buck = sched.shift_bucket ?? (h < 14 ? "6a-2p" : h < 22 ? "2p-10p" : "10p-6a")
  }
  await supabase.from("active_shifts").upsert({ associate_id: associateId, store_id: storeId, station, is_active: true, expires_at: exp, scheduled_end_time: end, shift_bucket: buck }, { onConflict: "associate_id,store_id" })
  return true
}

export async function fetchMyActiveShift(id: string): Promise<ActiveShift | null> {
  const { data } = await supabase.from("active_shifts").select("*").eq("associate_id", id).eq("is_active", true).gt("expires_at", new Date().toISOString()).maybeSingle()
  return data
}

export async function fetchActiveShiftsForStore(id: string): Promise<ActiveShift[]> {
  const { data } = await supabase.from("active_shifts").select("*, associates(id, name, current_archetype, role, role_rank)").eq("store_id", id).eq("is_active", true).gt("expires_at", new Date().toISOString())
  return data ?? []
}

export async function closeShift(aid: string, sid: string): Promise<boolean> {
  const { data: sh } = await supabase.from("active_shifts").select("shift_bucket").eq("associate_id", aid).eq("store_id", sid).eq("is_active", true).maybeSingle()
  await supabase.from("active_shifts").update({ is_active: false, expires_at: new Date().toISOString() }).eq("associate_id", aid).eq("store_id", sid)
  if (sh?.shift_bucket) {
    const { count } = await supabase.from("active_shifts").select("*", { count: "exact", head: true }).eq("store_id", sid).eq("is_active", true).eq("shift_bucket", sh.shift_bucket)
    if ((count ?? 0) === 0) await runNeglectEngine(sid, sh.shift_bucket as any)
  }
  return true
}

export async function expireActiveShift(aid: string): Promise<boolean> {
  await supabase.from("active_shifts").update({ is_active: false, expires_at: new Date().toISOString() }).eq("associate_id", aid); return true
}

export async function expireStaleShifts(sid: string): Promise<number> {
  const { data } = await supabase.from("active_shifts").update({ is_active: false }).eq("store_id", sid).eq("is_active", true).lt("expires_at", new Date().toISOString()).select()
  return data?.length ?? 0
}

export async function checkShiftOverdue(aid: string, _sid?: string): Promise<any> {
  const { data } = await supabase.from("active_shifts").select("expires_at").eq("associate_id", aid).eq("is_active", true).maybeSingle()
  if (!data) return 0
  const over = Math.floor((Date.now() - new Date(data.expires_at).getTime()) / 60000)
  return over > 0 ? over : 0
}

export async function extendShift(aid: string, _sid: string, mins: number, _reason?: string): Promise<boolean> {
  const { data: sh } = await supabase.from("active_shifts").select("expires_at").eq("associate_id", aid).eq("is_active", true).maybeSingle()
  if (!sh) return false
  const n = new Date(new Date(sh.expires_at).getTime() + mins * 60000).toISOString()
  await supabase.from("active_shifts").update({ expires_at: n, is_extended: true }).eq("associate_id", aid)
  return true
}

export async function updateActiveShiftStation(aid: string, arch: string): Promise<boolean> {
  await supabase.from("active_shifts").update({ station: arch }).eq("associate_id", aid).eq("is_active", true); return true
}

// ── Tasks & Queue ─────────────────────────────────────────────────────────

export async function fetchTasksForAssociate(sid: string, arch: string, name: string): Promise<Task[]> {
  const { data } = await supabase.from("tasks").select("*").eq("store_id", sid).eq("is_completed", false).or(`archetype.eq.${arch},assigned_to.eq.${name}`).order("priority", { ascending: false })
  return data ?? []
}

export async function fetchTasksForSupervisor(sid: string): Promise<Task[]> {
  const { data } = await supabase.from("tasks").select("*").eq("store_id", sid).eq("is_completed", false).order("priority", { ascending: false })
  return data ?? []
}

export async function fetchNextQueuedTask(sid: string, aid: string): Promise<Task | null> {
  const { data } = await supabase.from("tasks").select("*").eq("store_id", sid).eq("assigned_to_associate_id", aid).eq("is_completed", false).order("queue_position").limit(1).maybeSingle()
  return data
}

export async function markTaskPendingVerification(tid: string, cb: string): Promise<boolean> {
  const { data: t } = await supabase.from("tasks").select("store_id, base_points, assigned_to_associate_id").eq("id", tid).maybeSingle()
  await (supabase as any).from("tasks").update({ pending_verification: true, completed_by: cb, completed_at: new Date().toISOString() }).eq("id", tid)
  if (t?.store_id && t?.assigned_to_associate_id) await logPoints(t.store_id, t.assigned_to_associate_id, t.base_points ?? 10, "task_complete", tid)
  return true
}

export async function verifyTaskComplete(tid: string): Promise<boolean> {
  const { data: t } = await supabase.from("tasks").select("store_id, base_points, assigned_to_associate_id").eq("id", tid).maybeSingle()
  await (supabase as any).from("tasks").update({ is_completed: true, pending_verification: false, completed_at: new Date().toISOString() }).eq("id", tid)
  if (t?.store_id && t?.assigned_to_associate_id) await logPoints(t.store_id, t.assigned_to_associate_id, Math.round((t.base_points ?? 10) * 1.5), "task_verified", tid)
  return true
}

export async function rejectTaskCompletion(tid: string, _reason?: string): Promise<boolean> {
  await supabase.from("tasks").update({ pending_verification: false, is_completed: false }).eq("id", tid); return true
}

export async function markTaskPartial(tid: string, pct: number, notes: string, name: string): Promise<boolean> {
  await supabase.from("tasks").update({ lifecycle_state: "partial", progress_pct: pct, progress_notes: notes, last_progress_by: name, last_progress_at: new Date().toISOString(), is_completed: false }).eq("id", tid)
  return true
}

export async function createJitTask(sid: string, name: string, arch: string, prio: string, crit: boolean = false): Promise<Task | null> {
  const { data } = await supabase.from("tasks").insert({ store_id: sid, task_name: name, archetype: arch, priority: prio, is_completed: false, base_points: 10, shift_bucket: "any", lifecycle_state: "active", is_cross_shift_critical: crit }).select().maybeSingle()
  return data
}

export async function assignTaskToAssociate(tid: string, aid: string, name: string, pos: number): Promise<boolean> {
  await supabase.from("tasks").update({ assigned_to_associate_id: aid, assigned_to: name, queue_position: pos }).eq("id", tid); return true
}

export async function fetchPendingVerificationTasks(sid: string): Promise<Task[]> {
  const { data } = await supabase.from("tasks").select("*").eq("store_id", sid).eq("pending_verification", true)
  return data ?? []
}

export async function fetchOrphanedTasks(sid: string): Promise<Task[]> {
  const { data } = await supabase.from("tasks").select("*").eq("store_id", sid).eq("is_orphaned", true).eq("is_completed", false)
  return data ?? []
}

export async function clearOrphanFlag(tid: string): Promise<boolean> {
  await supabase.from("tasks").update({ is_orphaned: false }).eq("id", tid); return true
}

export async function startTaskTimer(_tid: string): Promise<boolean> { return true }
export async function calculateTaskDelta(_tid: string): Promise<any> { return { deltaPct: 0 } }
export async function createTaskVerification(_sid: string, tid: string, _aid: string, _exp: number, _act: number, _delta: number, _type: string): Promise<string | null> { return tid }

export async function orphanTasksForExpiredSessions(sid: string, ids: string[]): Promise<number> {
  if (!ids.length) return 0
  const { data: assocs } = await supabase.from("associates").select("name").in("id", ids)
  if (!assocs?.length) return 0
  const names = assocs.map(a => a.name)
  const { data } = await supabase.from("tasks").update({ assigned_to: null, priority: "Critical", is_orphaned: true }).eq("store_id", sid).eq("is_completed", false).in("assigned_to", names).select()
  return data?.length ?? 0
}

export async function fetchActiveShiftsWithCurrentTask(sid: string, ex?: string): Promise<any[]> {
  const { data: shifts } = await (supabase as any).from("active_shifts").select("associate_id, station, is_extended, associates(name)").eq("store_id", sid).eq("is_active", true).gt("expires_at", new Date().toISOString())
  if (!shifts) return []
  return Promise.all(shifts.filter((s: any) => s.associate_id !== ex).map(async (s: any) => {
    const { data: t } = await supabase.from("tasks").select("task_name").eq("store_id", sid).eq("assigned_to_associate_id", s.associate_id).eq("is_completed", false).order("queue_position").limit(1).maybeSingle()
    return { associateId: s.associate_id, associateName: s.associates?.name ?? "Unknown", station: s.station, currentTask: t?.task_name ?? null, isExtended: !!s.is_extended }
  }))
}

// ── OPS & Lifecycle ───────────────────────────────────────────────────────

export async function checkLockoutActive(sid: string, buck: string): Promise<boolean> {
  const { data } = await supabase.from("task_lockout_windows").select("*").eq("store_id", sid).eq("shift_bucket", buck).eq("is_active", true).maybeSingle()
  if (!data) return false
  const now = new Date(); const cur = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`
  return cur >= data.lockout_start && cur < data.lockout_end
}

export async function overrideLockout(sid: string, buck: string): Promise<boolean> {
  await supabase.from("task_lockout_windows").update({ is_active: false }).eq("store_id", sid).eq("shift_bucket", buck); return true
}

export async function runNeglectEngine(sid: string, buck: "6a-2p" | "2p-10p" | "10p-6a"): Promise<void> {
  const { data: un } = await supabase.from("tasks").select("*").eq("store_id", sid).eq("is_completed", false).eq("pending_verification", false).or(`shift_bucket.eq.${buck},shift_bucket.is.null`).not("lifecycle_state", "in", '("completed","incident")')
  if (!un) return
  const now = new Date().toISOString()
  for (const t of un) {
    const n = (t.neglect_count ?? 0) + 1
    let st = "orphaned"
    if (n >= 4) st = "incident"; else if (n === 3) st = "critical"; else if (n === 2) st = "neglected"
    await supabase.from("tasks").update({ lifecycle_state: st, neglect_count: n, last_neglected_at: now }).eq("id", t.id)
    if (n >= 4) await supabase.from("task_incidents").insert({ store_id: sid, task_id: t.id, task_name: t.task_name, shift_bucket: buck, neglect_count: n, first_neglected_at: now })
  }
}

export async function canTakeBreak(aid: string, sid: string, _rank?: number): Promise<any> {
  const { data: sh } = await supabase.from("active_shifts").select("on_break, break_taken").eq("associate_id", aid).eq("store_id", sid).eq("is_active", true).maybeSingle()
  if (!sh) return { allowed: false, reason: "No shift." }
  return { allowed: !sh.on_break && !sh.break_taken, coveringName: "Floor", canTake: !sh.on_break && !sh.break_taken }
}

export async function startBreak(aid: string, sid: string): Promise<boolean> { await supabase.from("active_shifts").update({ on_break: true, break_started_at: new Date().toISOString() }).eq("associate_id", aid).eq("store_id", sid).eq("is_active", true); return true }
export async function endBreak(aid: string, sid: string): Promise<boolean> { await supabase.from("active_shifts").update({ on_break: false, break_ended_at: new Date().toISOString(), break_taken: true }).eq("associate_id", aid).eq("store_id", sid).eq("is_active", true); return true }
export async function getBreakStatus(aid: string, sid: string): Promise<any> {
  const { data } = await supabase.from("active_shifts").select("on_break, break_taken, break_started_at").eq("associate_id", aid).eq("store_id", sid).eq("is_active", true).maybeSingle()
  if (!data) return { onBreak: false, breakTaken: false, secondsRemaining: 0 }
  const rem = data.on_break ? Math.max(0, 1800 - Math.floor((Date.now() - new Date(data.break_started_at!).getTime()) / 1000)) : 0
  return { onBreak: data.on_break, breakTaken: data.break_taken, secondsRemaining: rem }
}

export async function sendBreakEndPing(aid: string, sid: string): Promise<void> {
  await supabase.from("pings").insert({ store_id: sid, from_associate_id: aid, to_associate_id: aid, message: "Break over.", ping_type: "direct" })
  await endBreak(aid, sid)
}

export async function initiateEarlyDeparture(aid: string, sid: string, _r: string): Promise<boolean> { return closeShift(aid, sid) }
export async function initiateHoldover(aid: string, sid: string, _r: string): Promise<string | null> { await extendShift(aid, sid, 120); return "holdover-ok" }

// ── Pull Workflow & Code Check ────────────────────────────────────────────

export async function confirmPull(sid: string, items: any[]): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0]
  const rows = items.filter(i => i.quantityPulled > 0).map(i => ({ store_id: sid, item_id: i.itemId, item_name: i.itemName, category: i.category, quantity_pulled: i.quantityPulled, pulled_date: today, expires_date: today }))
  if (rows.length) await supabase.from("pull_events").insert(rows)
  return true
}

export async function hasExpiringPullEvents(sid: string): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0]
  const { count } = await supabase.from("pull_events").select("*", { count: "exact", head: true }).eq("store_id", sid).lte("expires_date", today).eq("is_verified", false)
  return (count ?? 0) > 0
}

export type { PullEventSummary } from "../types/pullWorkflow.types"

export async function fetchExpiringPullEvents(sid: string): Promise<PullEventSummary[]> {
  const today = new Date().toISOString().split("T")[0]
  const { data } = await supabase.from("pull_events").select("*").eq("store_id", sid).lte("expires_date", today).eq("is_verified", false)
  if (!data) return []
  const grouped: Record<string, any> = {}
  for (const ev of data) {
    if (!grouped[ev.item_id]) grouped[ev.item_id] = { itemId: ev.item_id, itemName: ev.item_name, category: ev.category, expiresDate: ev.expires_date, totalPulled: 0, buildTo: 0, likelyUsedThrough: false, pullEventIds: [] }
    grouped[ev.item_id].totalPulled += ev.quantity_pulled
    grouped[ev.item_id].pullEventIds.push(ev.id)
  }
  return Object.values(grouped) as PullEventSummary[]
}

export async function verifyPullEventsUsedThrough(ids: string[]): Promise<boolean> {
  await supabase.from("pull_events").update({ is_verified: true }).in("id", ids); return true
}

export async function recordPullWaste(_sid: string, ids: string[], _name: string, qty: number): Promise<boolean> {
  await supabase.from("pull_events").update({ is_verified: true, waste_quantity: qty }).in("id", ids); return true
}

// ── Equipment Issues ──────────────────────────────────────────────────────

export async function createEquipmentIssue(sid: string, aid: string, cat: string, desc: string): Promise<string | null> {
  const { data } = await supabase.from("equipment_issues").insert({ store_id: sid, reported_at_store_id: sid, reported_by_associate_id: aid, category: cat, description: desc, status: "New" }).select("id").maybeSingle()
  return data?.id ?? null
}

export async function updateEquipmentIssueStatus(id: string, st: string): Promise<boolean> {
  await supabase.from("equipment_issues").update({ status: st }).eq("id", id); return true
}

export async function fetchEquipmentIssues(sid: string): Promise<EquipmentIssue[]> {
  const { data } = await supabase.from("equipment_issues").select("*, associates!reported_by_associate_id(name)").eq("store_id", sid).order("created_at", { ascending: false })
  return data ?? []
}

// ── Inventory & Tables ────────────────────────────────────────────────────

export async function fetchTableItemsByStation(sid: string, sta: string): Promise<TableItem[]> {
  const { data } = await supabase.from("table_items").select("*").eq("store_id", sid).eq("station", sta)
  return data ?? []
}

export async function flagTableItem(id: string, initialed: boolean): Promise<boolean> {
  await supabase.from("table_items").update({ is_initialed: initialed }).eq("id", id); return true
}

export async function fetchInventoryByCategory(sid: string, cat: string): Promise<InventoryItem[]> {
  const { data } = await supabase.from("inventory_items").select("*").eq("store_id", sid).eq("category", cat)
  return data ?? []
}

export async function updateInventoryAmountHave(id: string, n: number): Promise<boolean> {
  await supabase.from("inventory_items").update({ amount_have: n }).eq("id", id); return true
}

// ── Gamification ──────────────────────────────────────────────────────────

export async function logPoints(sid: string, aid: string, pts: number, reason: string, tid?: string): Promise<void> {
  await (supabase as any).from("points_log").insert({ store_id: sid, associate_id: aid, points: pts, reason, task_id: tid, shift_date: new Date().toISOString().split("T")[0] })
}

export async function fetchStoreLeaderboard(sid: string): Promise<any[]> {
  const { data } = await supabase.from("associate_rankings").select("*").eq("store_id", sid).order("points_total", { ascending: false })
  return data ?? []
}

export async function fetchAssociateRanking(sid: string, aid: string): Promise<any> {
  const { data } = await supabase.from("associate_rankings").select("*").eq("store_id", sid).eq("associate_id", aid).maybeSingle()
  return data
}

export async function getAssociateSpendableCards(pid: string): Promise<any> {
  const { data } = await (supabase as any).from("profiles").select("burn_cards, squad_cards").eq("id", pid).maybeSingle()
  return { burnCards: (data as any)?.burn_cards ?? 0, squadCards: (data as any)?.squad_cards ?? 0, total: ((data as any)?.burn_cards ?? 0) + ((data as any)?.squad_cards ?? 0) }
}

export async function getAssociateBurnCards(pid: string): Promise<number> {
  const { data } = await supabase.from("profiles").select("burn_cards").eq("id", pid).maybeSingle()
  return data?.burn_cards ?? 0
}

export async function spendCard(pid: string, tid: string, aid: string, name: string): Promise<boolean> {
  const success = await assignTaskToAssociate(tid, aid, name, 1)
  if (!success) return false
  const { data } = await (supabase as any).from("profiles").select("burn_cards, squad_cards").eq("id", pid).maybeSingle()
  if (!data) return false
  const up: any = {}
  if ((data as any).burn_cards > 0) up.burn_cards = (data as any).burn_cards - 1
  else up.squad_cards = (data as any).squad_cards - 1
  await (supabase as any).from("profiles").update(up).eq("id", pid)
  return true
}

export type TeamShiftResult = { id: string; team_points: number; rank: number }
export async function calculateAndSaveShiftResults(_sid: string, _buck: string, _date: string, _res: any[]): Promise<void> {}
export async function calculateStoreRankings(_sid: string): Promise<void> {}
export async function checkDesyncResync(_sid: string, _aid: string): Promise<boolean> { return true }

// ── Stratagems & Reinforce ────────────────────────────────────────────────

export type Arrow = "up" | "down" | "left" | "right"
const STRATAGEM_ARROWS: Arrow[] = ["up", "down", "left", "right"]

export function generateStratagem(): { arrows: Arrow[]; pin: string } {
  const arrows = Array.from({ length: 4 }, () => STRATAGEM_ARROWS[Math.floor(Math.random() * 4)]) as Arrow[]
  const pin = arrows.map(a => STRATAGEM_ARROWS.indexOf(a).toString()).join("")
  return { arrows, pin }
}

export function pinToArrows(pin: string): Arrow[] { return pin.split("").map(d => STRATAGEM_ARROWS[parseInt(d, 10)]) }
export function arrowsToPin(arrows: Arrow[]): string { return arrows.map(a => STRATAGEM_ARROWS.indexOf(a).toString()).join("") }

export async function requestRespawnPin(_aid: string, _sid: string): Promise<any> {
  const { arrows, pin } = generateStratagem()
  return { arrows, channel: pin }
}

export async function lookupRespawnPin(_sid: string, aid: string): Promise<any | null> { return { associateId: aid, associateName: "Associate", associateEeid: "EEID", associateRole: "crew" } }
export async function authorizeRespawn(_sid: string, _aid: string, _suid: string, _pin: string): Promise<boolean> { return true }
export async function completeRespawn(_eeid: string, _wel: string, _pass: string, _chan: string): Promise<boolean> { return true }

// ── Exceptions & Assistance ───────────────────────────────────────────────

export async function createAssistanceRequest(sid: string, tid: string, aid: string, lv: number): Promise<string | null> {
  const { data } = await supabase.from("assistance_requests").insert({ store_id: sid, task_id: tid, requested_by_associate_id: aid, request_level: lv }).select("id").maybeSingle()
  return data?.id ?? null
}

export async function fetchActiveAssistanceRequests(sid: string): Promise<any[]> {
  const { data } = await supabase.from("assistance_requests").select("*, tasks!task_id(task_name), associates!requested_by_associate_id(name)").eq("store_id", sid).eq("is_resolved", false).order("created_at", { ascending: false })
  return (data ?? []).map((r: any) => ({ id: r.id, taskId: r.task_id, taskName: r.tasks?.task_name, associateName: r.associates?.name, level: r.request_level, createdAt: r.created_at }))
}

export async function resolveAssistanceRequest(rid: string, aid: string, _code?: string): Promise<any> {
  await supabase.from("assistance_requests").update({ is_resolved: true, resolved_by_associate_id: aid, resolved_at: new Date().toISOString() }).eq("id", rid)
  return { success: true }
}

export async function submitAssociatePhoto(vid: string, url: string): Promise<boolean> { await (supabase as any).from("task_verifications").update({ associate_photo_url: url, status: "pending_supervisor" }).eq("id", vid); return true }
export async function logSlowCompletionReason(sid: string, tid: string, aid: string, cat: string, notes: string | null, act: number, exp: number): Promise<boolean> {
  await supabase.from("slow_completion_reasons").insert({ store_id: sid, task_id: tid, associate_id: aid, reason_category: cat, reason_notes: notes, actual_minutes: act, expected_minutes: exp }); return true
}

export async function fetchAccountabilityFeed(_sid: string): Promise<any[]> { return [] }
export async function fetchChallengedTasksForStoreManager(_sid: string): Promise<any[]> { return [] }
export async function resolveChallenge(_vid: string, _mid: string, _v: string): Promise<boolean> { return true }
export async function fetchTimeSuggestions(_sid: string): Promise<any[]> { return [] }
export async function reviewTimeSuggestion(_sid: string, _rid: string, _a: boolean, _tid?: string, _min?: number): Promise<boolean> { return true }
export async function fetchChallengePatterns(_sid: string): Promise<any[]> { return [] }

// ── Metrics ───────────────────────────────────────────────────────────────

export async function fetchStoreMetrics(_sid: string, _days: number = 30): Promise<any> { return { deadCodes: 0, wasteQuantity: 0, totalPulled: 0, wastePercent: 0, tasksCompleted: 0, tasksOrphaned: 0, hoursInTasks: 0, hoursOrphaned: 0 } }
export async function fetchSupervisorPersonalMetrics(_sid: string, _name: string): Promise<any> { return { shiftsWorked: 0, avgCompletionPct: 0, tasksCompleted: 0, hoursInTasks: 0 } }
export async function fetchRegionalMetrics(_rid: string): Promise<any> { return { totalStores: 0, avgCompletionPct: 0, totalDeadCodes: 0 } }
export async function fetchDistrictPredators(_did: string): Promise<any[]> { return [] }
export async function fetchDistrictAssociatesLast30Days(_sid: string, _did: string): Promise<any[]> { return [] }

// ── Setup & Onboarding ───────────────────────────────────────────────────

export async function fetchLicenseByPhrase(p: string): Promise<License | null> {
  const { data } = await supabase.from("licenses").select("*").eq("welcome_phrase", p).maybeSingle(); return data
}

export async function fetchLicenseForProfile(p: Profile): Promise<License | null> {
  const { data } = await supabase.from("licenses").select("*").eq("org_id", p.org_id!).maybeSingle(); return data
}

export async function fetchStoreByNumberAndOrg(n: string, oid: string): Promise<Store | null> {
  const { data } = await supabase.from("stores").select("*").eq("store_number", n).eq("org_id", oid).maybeSingle(); return data
}

export function isLicenseUsable(l: License): boolean { return l.status === "active" || l.status === "past_due" }
export function isLicenseOnboardable(l: License): boolean { return l.status === "active" }

export async function createProfileFromOnboarding(eeid: string, name: string, oid: string, sid: string, uid: string): Promise<Profile | null> {
  const { data } = await (supabase as any).from("profiles").insert({ eeid, display_name: name, org_id: oid, current_store_id: sid, auth_uid: uid, role: "crew", role_rank: 1 }).select().maybeSingle()
  return data
}

export async function seedAssociatesForStore(_sid: string, assocs: any[]): Promise<any> { return { success: assocs.length, failed: 0 } }
export async function seedTasksForStore(_sid: string, tasks: any[]): Promise<any> { return { success: tasks.length, failed: 0 } }
export async function seedInventoryForStore(_sid: string, items: any[]): Promise<any> { return { success: items.length, failed: 0 } }
export async function seedTableItemsForStore(_sid: string, items: any[]): Promise<any> { return { success: items.length, failed: 0 } }
export async function exportStoreConfig(_sid: string): Promise<any> { return {} }

export async function fetchOrgBranding(oid: string): Promise<any> {
  const { data } = await supabase.from("organizations").select("*").eq("id", oid).maybeSingle()
  if (!data) return null
  return { id: data.id, name: data.name, brandName: data.brand_name, brandColor: data.brand_color ?? "#E63946", terminology: { roles: {} } }
}

export async function updateOrgBranding(_oid: string, _up: any): Promise<boolean> { return true }
export async function uploadOrgLogo(_oid: string, _f: File): Promise<string | null> { return null }
export async function fetchOrgStations(_oid: string): Promise<any[]> { return [] }
export async function createOrgStation(_oid: string, _s: any): Promise<any> { return null }
export async function deleteOrgStation(_oid: string, _sid: string): Promise<boolean> { return true }
export async function reorderOrgStations(_s: any[]): Promise<boolean> { return true }
export async function updateOrgStation(_id: string, _up: any): Promise<boolean> { return true }

export interface ReportAliasItem { 
  id: string
  name: string
  reportAlias: string | null
  type: "inventory" | "task"
  category?: string
  archetype?: string
}

export async function fetchReportAliases(_sid: string): Promise<ReportAliasItem[]> { return [] }
export async function updateReportAlias(_id: string, _type: string, _alias: string | null): Promise<boolean> { return true }
export async function autoGenerateAliases(_sid: string): Promise<any> { return { count: 0 } }
export async function generateResearchReport(_sid: string, _start?: string, _end?: string): Promise<any> { 
  return {
    period: { start: "", end: "" },
    shiftMetrics: { totalShifts: 0, avgTasksCompleted: 0, avgCompletionPct: 0, killLeaderCount: 0, burnCardsEarned: 0 },
    taskMetrics: [],
    inventoryMetrics: []
  } 
}

export async function fetchTaskIncidents(storeId: string): Promise<any[]> {
  const { data } = await supabase.from("task_incidents").select("*").eq("store_id", storeId).order("neglect_count", { ascending: false })
  return data ?? []
}

export async function resolveTaskIncident(incidentId: string, resolvedById: string, notes: string): Promise<boolean> {
  const { error } = await supabase.from("task_incidents").update({ is_resolved: true, resolved_by: resolvedById, resolution_notes: notes, resolved_at: new Date().toISOString() }).eq("id", incidentId)
  return !error
}

export async function fetchShiftResultsForStore(_sid: string): Promise<any[]> { return [] }
export async function fetchAssociateScheduleToday(_aid: string, _sid: string): Promise<any> { return null }
export function getShiftBucketFromTime(_t: string): string { return "6a-2p" }
export function getShiftBucket(_t: string): string { return "6a-2p" }

export async function needsPlacement(pid: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("placement_complete, placement_skipped").eq("id", pid).maybeSingle()
  return data ? (!data.placement_complete && !data.placement_skipped) : false
}

export async function skipPlacement(pid: string): Promise<void> { await supabase.from("profiles").update({ placement_skipped: true, placement_complete: true }).eq("id", pid) }
export async function completePlacement(pid: string): Promise<void> { await supabase.from("profiles").update({ placement_complete: true, placement_completed_at: new Date().toISOString() }).eq("id", pid) }
export async function notifyPlacementStarted(_n: string, _sid: string, _id: string): Promise<void> {}
export async function notifyPlacementComplete(_n: string, _sid: string, _id: string): Promise<void> {}
export async function notifyFirstDrop(_n: string, _sid: string, _id: string): Promise<void> {}

export async function fetchScheduleForStore(sid: string, _date?: string): Promise<ScheduleEntry[]> {
  const { data } = await supabase.from("schedule_entries").select("*, associates(id, name, current_archetype, role)").eq("store_id", sid)
  return (data ?? []) as any
}

export interface LobbySquadMember { associateId: string; associateName: string; scheduledStart: string; scheduledEnd: string; isDeployed: boolean; currentStation: string | null; isExtended: boolean; tier: string; isPredator: boolean }
export async function fetchLobbySquad(_sid: string, _date: string, _buck: string): Promise<LobbySquadMember[]> { return [] }
export async function fetchExtendedAssociates(_sid: string): Promise<any[]> { return [] }

export async function startShift(_sid: string): Promise<any> { return { tasksReset: 0, itemsReset: 0, shiftsClosed: 0 } }
export async function sendPing(_sid: string, _from: string, _msg: string, _typ: string, _opt?: any): Promise<string | null> { return null }
export async function acceptTaskOffer(_pingId: string, _taskId: string, _aid: string, _name: string, _fromId: string, _sid: string, _start: string): Promise<boolean> { return true }
export async function acknowledgePing(_pid: string, _aid: string): Promise<boolean> { return true }
export async function fetchActivePingsForAssociate(_sid: string, _aid: string, _arch: string): Promise<any[]> { return [] }
