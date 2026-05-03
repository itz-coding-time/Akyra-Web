# Akyra Web — RA2: Challenge Consequence Engine

Do only what is described. Nothing else.

**Context:** Right now challenges are submitted and verdicts are given but nothing happens downstream. This stage wires the full consequence engine. Verdicts fire notifications, tasks update state, challenge patterns are tracked, points are logged, and the Before/After photo framing replaces Supervisor/Associate labels. Associate context (slow reason) is shown alongside photos so the Store Manager has full picture.

**The consequence rules:**
- Store Manager verdicts "Complete" → task marked done, associate gets +25 vindication points, supervisor rejection tracked as pattern, supervisor gets a ping
- Store Manager verdicts "Not Complete" → task pushed back to associate glowing, associate failure tracked as pattern, desync check fires, associate gets a ping
- Desync triggers after 3 verification failures in 30 days

**Prerequisites:** RA1 SQL complete. GX6 complete. RBAC2 complete.

---

## Before touching anything:

1. Read `src/lib/repository.ts` — find `resolveChallenge`, `fetchChallengedTasksForStoreManager`, `verifyTaskComplete`, `markTaskPendingVerification`
2. Read `src/pages/dashboard/StoreManagerPage.tsx` — find challenge kanban in accountability panel
3. Read `src/components/gamification/RejectionResponseModal.tsx` in full

---

## Change 1 of 5 — Add consequence and pattern methods to repository.ts

```typescript
// ── Points Engine ─────────────────────────────────────────────────────────

export async function logPoints(
  storeId: string,
  associateId: string,
  points: number,
  reason: "task_complete" | "task_verified" | "assist_given" | "kill_leader" | "mvp" | "challenge_vindicated" | "desync_cleared",
  taskId?: string
): Promise<void> {
  await supabase.from("points_log").insert({
    store_id: storeId,
    associate_id: associateId,
    points,
    reason,
    task_id: taskId ?? null,
    shift_date: new Date().toISOString().split("T")[0],
  })
}

// ── Challenge Pattern Tracking ────────────────────────────────────────────

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
  // Get org and district from store
  const { data: store } = await supabase
    .from("stores")
    .select("org_id, district_id")
    .eq("id", params.storeId)
    .maybeSingle()

  // Check for existing pattern in rolling 90-day window
  let query = supabase
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

    await supabase
      .from("challenge_patterns")
      .update({ challenge_count: newCount, flag_level: flagLevel, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
  } else {
    await supabase.from("challenge_patterns").insert({
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

// ── Desync Check ──────────────────────────────────────────────────────────

export async function checkAndApplyDesync(
  storeId: string,
  associateId: string,
  associateName: string
): Promise<void> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)

  const { count } = await supabase
    .from("task_verifications")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("associate_id", associateId)
    .in("status", ["resolved_retry", "resolved_challenged"])
    .gte("created_at", cutoff.toISOString())

  if ((count ?? 0) >= 3) {
    const { data: store } = await supabase
      .from("stores")
      .select("org_id, district_id")
      .eq("id", storeId)
      .maybeSingle()

    await supabase
      .from("associate_rankings")
      .upsert({
        store_id: storeId,
        associate_id: associateId,
        associate_name: associateName,
        org_id: store?.org_id ?? "",
        district_id: store?.district_id ?? null,
        is_desynced: true,
        desync_reason: "3+ verification failures in 30 days",
        desync_since: new Date().toISOString(),
        desync_assists_needed: 3,
        desync_assists_completed: 0,
      }, { onConflict: "store_id,associate_id" })
  }
}

// ── Challenge Resolution with Consequences ────────────────────────────────

export async function resolveChallenge(
  verificationId: string,
  storeManagerProfileId: string,
  verdict: "complete" | "incomplete"
): Promise<boolean> {
  // Fetch full verification details
  const { data: v } = await supabase
    .from("task_verifications")
    .select(`
      *,
      tasks!task_id(task_name, store_id, base_points, archetype),
      associates!associate_id(id, name, store_id),
      associates!supervisor_id(id, name)
    `)
    .eq("id", verificationId)
    .maybeSingle()

  if (!v) return false

  const task = (v as any).tasks
  const associate = (v as any).associates
  const supervisor = (v as any).supervisor
  const storeId = task?.store_id ?? associate?.store_id

  // Update verdict status
  const newStatus = verdict === "complete" ? "resolved_accepted" : "resolved_retry"
  const { error } = await supabase
    .from("task_verifications")
    .update({
      store_manager_id: storeManagerProfileId,
      store_manager_verdict: verdict,
      challenge_resolved: true,
      resolved_at: new Date().toISOString(),
      status: newStatus,
    })
    .eq("id", verificationId)

  if (error) return false

  if (verdict === "complete") {
    // Associate was right — task IS done
    await supabase
      .from("tasks")
      .update({ is_completed: true, pending_verification: false })
      .eq("id", v.task_id)

    // Award vindication points
    if (storeId && v.associate_id) {
      await logPoints(storeId, v.associate_id, 25, "challenge_vindicated", v.task_id)
    }

    // Track supervisor pattern — they rejected incorrectly
    if (storeId && supervisor?.id) {
      await trackChallengePattern({
        storeId,
        taskId: v.task_id,
        taskName: task?.task_name ?? "Unknown",
        associateId: v.associate_id,
        associateName: associate?.name ?? "Unknown",
        supervisorId: supervisor.id,
        supervisorName: supervisor.name,
        patternType: "supervisor_task",
      })

      await trackChallengePattern({
        storeId,
        taskId: v.task_id,
        taskName: task?.task_name ?? "Unknown",
        associateId: v.associate_id,
        associateName: associate?.name ?? "Unknown",
        supervisorId: supervisor.id,
        supervisorName: supervisor.name,
        patternType: "associate_supervisor",
      })

      // Ping supervisor — your rejection was overturned
      await supabase.from("pings").insert({
        store_id: storeId,
        from_associate_id: v.associate_id,
        to_associate_id: supervisor.id,
        message: `Store Manager ruled "${task?.task_name}" was completed. Your rejection was overturned.`,
        ping_type: "direct",
      })
    }

  } else {
    // Supervisor was right — task is NOT done
    // Push task back — associate must redo it
    await supabase
      .from("tasks")
      .update({
        pending_verification: false,
        is_completed: false,
        started_at: null,
        completed_at: null,
      })
      .eq("id", v.task_id)

    // Track associate pattern — they challenged and lost
    if (storeId) {
      await trackChallengePattern({
        storeId,
        taskId: v.task_id,
        taskName: task?.task_name ?? "Unknown",
        associateId: v.associate_id,
        associateName: associate?.name ?? "Unknown",
        supervisorId: supervisor?.id ?? null,
        supervisorName: supervisor?.name ?? null,
        patternType: "associate_task",
      })

      // Check for desync
      await checkAndApplyDesync(storeId, v.associate_id, associate?.name ?? "Unknown")

      // Ping associate — redo the task
      await supabase.from("pings").insert({
        store_id: storeId,
        from_associate_id: storeManagerProfileId,
        to_associate_id: v.associate_id,
        message: `Store Manager reviewed "${task?.task_name}" — please complete it properly and try again.`,
        ping_type: "direct",
      })
    }
  }

  return true
}

// ── Challenge Patterns for HR view ───────────────────────────────────────

export async function fetchChallengePatterns(storeId: string): Promise<Array<{
  id: string
  patternType: string
  taskName: string
  associateName: string
  supervisorName: string | null
  challengeCount: number
  flagLevel: string
  windowEnd: string
}>> {
  const { data, error } = await supabase
    .from("challenge_patterns")
    .select("*")
    .eq("store_id", storeId)
    .eq("is_resolved", false)
    .gt("window_end", new Date().toISOString().split("T")[0])
    .order("challenge_count", { ascending: false })

  if (error || !data) return []

  return data.map(p => ({
    id: p.id,
    patternType: p.pattern_type,
    taskName: p.task_name,
    associateName: p.associate_name,
    supervisorName: p.supervisor_name,
    challengeCount: p.challenge_count,
    flagLevel: p.flag_level,
    windowEnd: p.window_end,
  }))
}

export async function resolveChallengePattern(
  patternId: string,
  resolvedById: string,
  notes: string
): Promise<boolean> {
  const { error } = await supabase
    .from("challenge_patterns")
    .update({
      is_resolved: true,
      resolved_by: resolvedById,
      resolved_at: new Date().toISOString(),
      resolution_notes: notes,
    })
    .eq("id", patternId)

  return !error
}
```

---

## Change 2 of 5 — Wire logPoints into task completion

In `src/lib/repository.ts`, update `markTaskPendingVerification` to log base points:

```typescript
export async function markTaskPendingVerification(
  taskId: string,
  completedBy: string
): Promise<boolean> {
  const { data: task } = await supabase
    .from("tasks")
    .select("store_id, base_points, assigned_to_associate_id")
    .eq("id", taskId)
    .maybeSingle()

  const { error } = await supabase
    .from("tasks")
    .update({
      pending_verification: true,
      completed_by: completedBy,
      completed_at: new Date().toISOString(),
    })
    .eq("id", taskId)

  if (error) return false

  if (task?.store_id && task?.assigned_to_associate_id) {
    await logPoints(
      task.store_id,
      task.assigned_to_associate_id,
      task.base_points ?? 10,
      "task_complete",
      taskId
    )
  }

  return true
}
```

Update `verifyTaskComplete` to log verified points (1.5×):

```typescript
export async function verifyTaskComplete(taskId: string): Promise<boolean> {
  const { data: task } = await supabase
    .from("tasks")
    .select("store_id, base_points, assigned_to_associate_id")
    .eq("id", taskId)
    .maybeSingle()

  const { error } = await supabase
    .from("tasks")
    .update({
      is_completed: true,
      pending_verification: false,
      completed_at: new Date().toISOString(),
    })
    .eq("id", taskId)

  if (error) return false

  if (task?.store_id && task?.assigned_to_associate_id) {
    const points = Math.round((task.base_points ?? 10) * 1.5)
    await logPoints(
      task.store_id,
      task.assigned_to_associate_id,
      points,
      "task_verified",
      taskId
    )
  }

  return true
}
```

---

## Change 3 of 5 — Before/After photo framing in StoreManagerPage

In `src/pages/dashboard/StoreManagerPage.tsx`, update the challenge card in the accountability panel. Replace "Supervisor Photo" / "Associate Photo" with "Before" / "After":

```tsx
{/* Photo layout — Before/After not Supervisor/Associate */}
<div className="grid grid-cols-2 gap-2">
  {c.supervisor_photo_url && (
    <div>
      <p className="text-[10px] font-mono text-akyra-secondary mb-1 uppercase tracking-widest">
        Before
      </p>
      <img
        src={c.supervisor_photo_url}
        alt="Before"
        className="w-full rounded-lg border border-akyra-border"
      />
      <p className="text-[9px] text-white/30 mt-0.5">At time of rejection</p>
    </div>
  )}
  {c.associate_photo_url && (
    <div>
      <p className="text-[10px] font-mono text-akyra-secondary mb-1 uppercase tracking-widest">
        After
      </p>
      <img
        src={c.associate_photo_url}
        alt="After"
        className="w-full rounded-lg border border-akyra-border"
      />
      <p className="text-[9px] text-white/30 mt-0.5">When marked complete</p>
    </div>
  )}
</div>

{/* Associate context */}
{(c.slow_reason_category || c.slow_reason_notes) && (
  <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
    <p className="text-[10px] font-mono text-akyra-secondary uppercase tracking-widest mb-1">
      Associate Context
    </p>
    <p className="text-sm text-white/70">
      {c.slow_reason_category === "long_line" ? "Long line at the time" :
       c.slow_reason_category === "high_volume" ? "High volume period" :
       c.slow_reason_category === "broken_equipment" ? "Equipment issue" :
       c.slow_reason_notes ?? "No context provided"}
    </p>
  </div>
)}

{/* Supervisor rejection note */}
{c.rejection_reason && (
  <div className="bg-[#E63946]/[0.05] border border-[#E63946]/20 rounded-lg p-3">
    <p className="text-[10px] font-mono text-[#E63946]/60 uppercase tracking-widest mb-1">
      Supervisor Note
    </p>
    <p className="text-sm text-white/60">{c.rejection_reason}</p>
  </div>
)}
```

---

## Change 4 of 5 — Before/After in RejectionResponseModal

In `src/components/gamification/RejectionResponseModal.tsx`, update photo labels:

```tsx
{/* Replace "Your photo" / "Supervisor's photo" with "After" / "Before" */}
<div className="grid grid-cols-2 gap-2">
  {associatePhotoUrl && (
    <div>
      <p className="text-[10px] font-mono text-akyra-secondary uppercase tracking-widest mb-1">
        After
      </p>
      <p className="text-[9px] text-white/30 mb-1">Your photo</p>
      <img src={associatePhotoUrl} alt="After" className="w-full rounded-lg border border-akyra-border" />
    </div>
  )}
  {supervisorPhotoUrl && (
    <div>
      <p className="text-[10px] font-mono text-akyra-secondary uppercase tracking-widest mb-1">
        Before
      </p>
      <p className="text-[9px] text-white/30 mb-1">Supervisor's photo</p>
      <img src={supervisorPhotoUrl} alt="Before" className="w-full rounded-lg border border-akyra-border" />
    </div>
  )}
</div>
```

---

## Change 5 of 5 — Add HR panel to StoreManagerPage

In `src/pages/dashboard/StoreManagerPage.tsx`, add HR panel tab and content:

```tsx
// Add to Panel type:
type Panel = "performers" | "accountability" | "workorders" | "tasks" | "metrics" | "district" | "hr"

// Add state:
const [challengePatterns, setChallengePatterns] = useState<any[]>([])
const [selectedPattern, setSelectedPattern] = useState<any>(null)

// Add to data loading Promise.all:
fetchChallengePatterns(storeId),

// Wire result:
.then(([p, a, c, w, m, t, d, cp]) => {
  // ...existing...
  setChallengePatterns(cp)
})

// Add to PANELS array:
{
  id: "hr" as Panel,
  label: "HR",
  icon: <Shield className="w-4 h-4" />,
  badge: challengePatterns.filter(p => p.flagLevel !== "watch").length
}

// HR panel content:
{activePanel === "hr" && (
  <div className="space-y-3">
    <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
      Challenge Patterns · Rolling 90 Days
    </p>

    {challengePatterns.length === 0 ? (
      <p className="text-sm text-akyra-secondary">No patterns detected. Clean slate.</p>
    ) : challengePatterns.map(pattern => (
      <button
        key={pattern.id}
        onClick={() => setSelectedPattern(pattern)}
        className={`w-full text-left bg-akyra-surface border rounded-xl p-4 space-y-1 transition-colors hover:border-white/30 ${
          pattern.flagLevel === "bias_review" ? "border-[#E63946]/40" :
          pattern.flagLevel === "sop_review" ? "border-yellow-500/30" :
          pattern.flagLevel === "retrain" ? "border-orange-500/30" :
          "border-akyra-border"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-white text-sm">{pattern.taskName}</p>
          <span className={`text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border shrink-0 ${
            pattern.flagLevel === "bias_review" ? "border-[#E63946]/40 text-[#E63946]" :
            pattern.flagLevel === "sop_review" ? "border-yellow-500/30 text-yellow-400" :
            pattern.flagLevel === "retrain" ? "border-orange-500/30 text-orange-400" :
            "border-white/10 text-white/30"
          }`}>
            {pattern.flagLevel === "bias_review" ? "Bias Review" :
             pattern.flagLevel === "sop_review" ? "SOP Review" :
             pattern.flagLevel === "retrain" ? "Retrain" : "Watch"}
          </span>
        </div>
        <p className="text-xs text-akyra-secondary font-mono">
          {pattern.patternType === "associate_task"
            ? `${pattern.associateName} · ${pattern.challengeCount}× failure`
            : pattern.patternType === "supervisor_task"
            ? `${pattern.supervisorName} · ${pattern.challengeCount}× rejection`
            : `${pattern.supervisorName} → ${pattern.associateName} · ${pattern.challengeCount}×`
          }
        </p>
      </button>
    ))}

    {/* Pattern detail bottom sheet */}
    {selectedPattern && (
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <div className="absolute inset-0 bg-black/80" onClick={() => setSelectedPattern(null)} />
        <div className="relative w-full max-w-lg bg-akyra-surface border-t border-akyra-border rounded-t-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-bold text-white">Pattern Detail</p>
            <button onClick={() => setSelectedPattern(null)} className="text-akyra-secondary hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">{selectedPattern.taskName}</p>
            <p className="text-xs text-akyra-secondary font-mono">
              {selectedPattern.patternType === "associate_task"
                ? `${selectedPattern.associateName} has failed this task ${selectedPattern.challengeCount} time${selectedPattern.challengeCount !== 1 ? "s" : ""} in 90 days`
                : selectedPattern.patternType === "supervisor_task"
                ? `${selectedPattern.supervisorName} has rejected this task ${selectedPattern.challengeCount} time${selectedPattern.challengeCount !== 1 ? "s" : ""}`
                : `${selectedPattern.supervisorName} has rejected ${selectedPattern.associateName} ${selectedPattern.challengeCount} time${selectedPattern.challengeCount !== 1 ? "s" : ""}`
              }
            </p>
          </div>

          <div className="bg-white/[0.03] rounded-lg p-3">
            <p className="text-[10px] font-mono text-akyra-secondary uppercase tracking-widest mb-1">
              Suggested Action
            </p>
            <p className="text-xs text-white/60">
              {selectedPattern.flagLevel === "retrain"
                ? "Schedule assisted practice. Use the Ping system to pair this associate with a senior crew member on this specific task. Assists earn 2× points — it incentivises the senior associate to help."
                : selectedPattern.flagLevel === "sop_review"
                ? "Review the SOP for this task. Multiple rejections from the same supervisor suggest the expected standard may be unclear or unrealistic."
                : selectedPattern.flagLevel === "bias_review"
                ? "Review this supervisor/associate dynamic. Consider temporarily routing this associate's verifications through a different supervisor."
                : "Continue monitoring. No action required yet."}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setSelectedPattern(null)}
              className="flex-1 py-2.5 rounded-xl border border-akyra-border text-akyra-secondary text-sm"
            >
              Dismiss
            </button>
            <button
              onClick={async () => {
                await resolveChallengePattern(
                  selectedPattern.id,
                  state.profile?.id ?? "",
                  `${selectedPattern.flagLevel} pattern resolved`
                )
                setChallengePatterns(prev => prev.filter(p => p.id !== selectedPattern.id))
                setSelectedPattern(null)
              }}
              className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-bold"
            >
              Mark Resolved
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
)}
```

Add import at top:
```tsx
import { Shield, X } from "lucide-react"
import { fetchChallengePatterns, resolveChallengePattern } from "../../lib"
```

---

## Verify

Run:

```bash
npm run build
```

**Test complete verdict:**
1. Have a task in `pending_store_manager` state in Supabase
2. Store Manager → Accountability → tap "Complete"
3. Check: task `is_completed = true`, `points_log` has +25 row, `challenge_patterns` has a supervisor_task row, supervisor gets a ping

**Test not complete verdict:**
1. Store Manager taps "Not Complete"
2. Check: task `is_completed = false`, `pending_verification = false`, associate_task pattern created, associate gets a ping

**Test Before/After:**
- Challenge card shows "Before" (supervisor photo) and "After" (associate photo)
- Associate context shown if slow_reason_category exists

**Test HR panel:**
- Store Manager → HR tab
- Pattern cards appear after challenge resolutions
- Tap a card → bottom sheet with suggested action
- "Mark Resolved" removes it from list

Build must pass with zero TypeScript errors before you stop.
