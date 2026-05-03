# Akyra Web — RA4: Points Engine + Desync System

Do only what is described. Nothing else.

**Context:** This stage builds the points calculation engine and the desync corrective system. Points are calculated on a rolling 30-day basis from the `points_log` table and written to `associate_rankings`. Desync is detected from verification failures and cleared through assists. Associates who are desynced see a subtle indicator and are incentivized through the ping/assist system to resync.

**Points system:**
- task_complete: base_points (default 10)
- task_verified: base_points × 1.5
- assist_given: base_points × 2
- kill_leader: +50
- mvp: +50
- challenge_vindicated: +25
- desync_cleared: +100 (bonus for fully resyncing)

**Desync rules:**
- Triggers: 3+ verification failures in 30 days
- Corrective path: complete 3 assists (not just any tasks — ASSISTS specifically)
- Cleared: desync_assists_completed >= desync_assists_needed
- Cleared bonus: +100 points

**Prerequisites:** RA1-3 complete. RBAC4-5 complete (assists table exists).

---

## Before touching anything:

1. Read `src/lib/repository.ts` — find `logPoints`, `checkAndApplyDesync`, assist methods
2. Read `src/pages/associate/AssociateTaskView.tsx` in full
3. Read `src/components/gamification/EndOfShiftResults.tsx` in full

---

## Change 1 of 5 — Add points calculation engine to repository.ts

```typescript
// ── Points Calculation Engine ─────────────────────────────────────────────

const POINTS_MULTIPLIERS = {
  task_complete: 1,
  task_verified: 1.5,
  assist_given: 2,
  kill_leader: 50,    // flat bonus
  mvp: 50,            // flat bonus
  challenge_vindicated: 25, // flat bonus
  desync_cleared: 100, // flat bonus
} as const

/**
 * Calculate and update associate_rankings for a store.
 * Called at end of shift or on demand.
 * Uses rolling 30-day points from points_log.
 */
export async function calculateStoreRankings(storeId: string): Promise<void> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffStr = cutoff.toISOString().split("T")[0]

  // Get store metadata
  const { data: store } = await supabase
    .from("stores")
    .select("org_id, district_id")
    .eq("id", storeId)
    .maybeSingle()

  if (!store) return

  // Get district's region_id
  let regionId: string | null = null
  if (store.district_id) {
    const { data: district } = await supabase
      .from("districts")
      .select("region_id")
      .eq("id", store.district_id)
      .maybeSingle()
    regionId = district?.region_id ?? null
  }

  // Aggregate points by associate from points_log
  const { data: pointsData } = await supabase
    .from("points_log")
    .select("associate_id, points, reason")
    .eq("store_id", storeId)
    .gte("shift_date", cutoffStr)

  if (!pointsData) return

  // Group by associate
  const byAssociate: Record<string, {
    points_tasks: number
    points_verified: number
    points_assists: number
    points_kill_leader: number
    points_mvp: number
    points_vindicated: number
    total: number
  }> = {}

  for (const row of pointsData) {
    if (!byAssociate[row.associate_id]) {
      byAssociate[row.associate_id] = {
        points_tasks: 0,
        points_verified: 0,
        points_assists: 0,
        points_kill_leader: 0,
        points_mvp: 0,
        points_vindicated: 0,
        total: 0,
      }
    }
    const g = byAssociate[row.associate_id]
    g.total += row.points

    switch (row.reason) {
      case "task_complete": g.points_tasks += row.points; break
      case "task_verified": g.points_verified += row.points; break
      case "assist_given": g.points_assists += row.points; break
      case "kill_leader": g.points_kill_leader += row.points; break
      case "mvp": g.points_mvp += row.points; break
      case "challenge_vindicated": g.points_vindicated += row.points; break
    }
  }

  // Sort by total points to determine tiers and Predator status
  const sorted = Object.entries(byAssociate)
    .sort(([, a], [, b]) => b.total - a.total)

  // Determine tiers
  // Top 3 = Predator, then Master/Diamond/Platinum by quartile
  const total = sorted.length
  const predatorIds = new Set(sorted.slice(0, 3).map(([id]) => id))

  function getTier(rank: number, totalPoints: number): "Platinum" | "Diamond" | "Master" | "Predator" {
    if (predatorIds.has(sorted[rank]?.[0] ?? "")) return "Predator"
    if (totalPoints >= 500) return "Master"
    if (totalPoints >= 200) return "Diamond"
    return "Platinum"
  }

  // Fetch existing rankings to detect tier changes
  const { data: existingRankings } = await supabase
    .from("associate_rankings")
    .select("associate_id, tier, is_desynced, desync_assists_needed, desync_assists_completed")
    .eq("store_id", storeId)

  const existingMap: Record<string, any> = {}
  for (const r of existingRankings ?? []) {
    existingMap[r.associate_id] = r
  }

  // Fetch associate names
  const associateIds = sorted.map(([id]) => id)
  const { data: associates } = await supabase
    .from("associates")
    .select("id, name")
    .in("id", associateIds)

  const nameMap: Record<string, string> = {}
  for (const a of associates ?? []) nameMap[a.id] = a.name

  // Upsert rankings
  const upsertRows = sorted.map(([associateId, points], rank) => {
    const existing = existingMap[associateId]
    const newTier = getTier(rank, points.total)
    const isPredator = newTier === "Predator"
    const isSuccessionCandidate = isPredator

    const tierChanged = existing?.tier !== newTier

    return {
      store_id: storeId,
      org_id: store.org_id,
      district_id: store.district_id ?? null,
      region_id: regionId,
      associate_id: associateId,
      associate_name: nameMap[associateId] ?? "Unknown",
      points_tasks: points.points_tasks,
      points_verified: points.points_verified,
      points_assists: points.points_assists,
      points_kill_leader: points.points_kill_leader,
      points_mvp: points.points_mvp,
      points_vindicated: points.points_vindicated,
      points_total: points.total,
      tier: newTier,
      previous_tier: tierChanged ? (existing?.tier ?? null) : undefined,
      tier_changed_at: tierChanged ? new Date().toISOString() : undefined,
      is_predator: isPredator,
      is_succession_candidate: isSuccessionCandidate,
      last_calculated: new Date().toISOString(),
    }
  })

  if (upsertRows.length > 0) {
    await supabase
      .from("associate_rankings")
      .upsert(upsertRows, { onConflict: "store_id,associate_id" })
  }
}

/**
 * Check if a desynced associate has completed enough assists to resync.
 * Called whenever an assist is logged.
 */
export async function checkDesyncResync(
  storeId: string,
  associateId: string
): Promise<boolean> {
  const { data: ranking } = await supabase
    .from("associate_rankings")
    .select("is_desynced, desync_assists_needed, desync_assists_completed, desync_since")
    .eq("store_id", storeId)
    .eq("associate_id", associateId)
    .maybeSingle()

  if (!ranking?.is_desynced) return false

  const newCount = (ranking.desync_assists_completed ?? 0) + 1

  if (newCount >= (ranking.desync_assists_needed ?? 3)) {
    // Resync!
    await supabase
      .from("associate_rankings")
      .update({
        is_desynced: false,
        desync_cleared_at: new Date().toISOString(),
        desync_assists_completed: newCount,
      })
      .eq("store_id", storeId)
      .eq("associate_id", associateId)

    // Award resync bonus
    await logPoints(storeId, associateId, 100, "desync_cleared")

    return true // resynced
  } else {
    // Increment assists completed
    await supabase
      .from("associate_rankings")
      .update({ desync_assists_completed: newCount })
      .eq("store_id", storeId)
      .eq("associate_id", associateId)

    return false // not yet
  }
}

/**
 * Fetch ranking for a single associate.
 */
export async function fetchAssociateRanking(
  storeId: string,
  associateId: string
): Promise<{
  tier: string
  isPredator: boolean
  isDesynced: boolean
  desyncAssistsNeeded: number
  desyncAssistsCompleted: number
  pointsTotal: number
} | null> {
  const { data } = await supabase
    .from("associate_rankings")
    .select("*")
    .eq("store_id", storeId)
    .eq("associate_id", associateId)
    .maybeSingle()

  if (!data) return null

  return {
    tier: data.tier,
    isPredator: data.is_predator,
    isDesynced: data.is_desynced,
    desyncAssistsNeeded: data.desync_assists_needed,
    desyncAssistsCompleted: data.desync_assists_completed,
    pointsTotal: data.points_total,
  }
}

/**
 * Fetch store rankings leaderboard.
 */
export async function fetchStoreLeaderboard(storeId: string): Promise<Array<{
  associateId: string
  associateName: string
  tier: string
  isPredator: boolean
  isDesynced: boolean
  pointsTotal: number
  pointsAssists: number
}>> {
  const { data, error } = await supabase
    .from("associate_rankings")
    .select("*")
    .eq("store_id", storeId)
    .order("points_total", { ascending: false })

  if (error || !data) return []

  return data.map(r => ({
    associateId: r.associate_id,
    associateName: r.associate_name,
    tier: r.tier,
    isPredator: r.is_predator,
    isDesynced: r.is_desynced,
    pointsTotal: r.points_total,
    pointsAssists: r.points_assists,
  }))
}
```

---

## Change 2 of 5 — Wire desync check into assist acceptance

In `src/lib/repository.ts`, update `acceptTaskOffer` to check desync after assist is logged:

```typescript
export async function acceptTaskOffer(
  pingId: string,
  taskId: string,
  acceptingAssociateId: string,
  acceptingAssociateName: string,
  originalAssociateId: string,
  storeId: string,
  startTime: string
): Promise<boolean> {
  await acknowledgePing(pingId, acceptingAssociateId)

  await supabase
    .from("tasks")
    .update({
      assigned_to: acceptingAssociateName,
      assigned_to_associate_id: acceptingAssociateId,
      queue_position: 1,
    })
    .eq("id", taskId)

  const bucket = getShiftBucket(startTime)

  await supabase.from("assists").insert({
    store_id: storeId,
    original_associate_id: originalAssociateId,
    assist_associate_id: acceptingAssociateId,
    task_id: taskId,
    ping_id: pingId,
    shift_date: new Date().toISOString().split("T")[0],
    shift_bucket: bucket,
  })

  // Get task base_points for assist log
  const { data: task } = await supabase
    .from("tasks")
    .select("base_points")
    .eq("id", taskId)
    .maybeSingle()

  // Log 2x points for assist
  await logPoints(
    storeId,
    acceptingAssociateId,
    Math.round((task?.base_points ?? 10) * 2),
    "assist_given",
    taskId
  )

  // Check if this assist helps resync
  const resynced = await checkDesyncResync(storeId, acceptingAssociateId)
  if (resynced) {
    // Notify associate they've resynced
    await supabase.from("pings").insert({
      store_id: storeId,
      from_associate_id: originalAssociateId,
      to_associate_id: acceptingAssociateId,
      message: "You're back in sync with the squad. Keep it up. 🔥",
      ping_type: "direct",
    })
  }

  return true
}
```

---

## Change 3 of 5 — Wire calculateStoreRankings into end of shift

In `src/lib/repository.ts`, update `calculateAndSaveShiftResults` to trigger ranking recalculation:

```typescript
// At the end of calculateAndSaveShiftResults, after awarding squad cards:
await calculateStoreRankings(storeId)
```

---

## Change 4 of 5 — Show desync indicator on AssociateTaskView

In `src/pages/associate/AssociateTaskView.tsx`, load and display desync status:

```tsx
import { fetchAssociateRanking } from "../../lib"

// Add state:
const [ranking, setRanking] = useState<any>(null)

// Load on mount:
useEffect(() => {
  if (associate.id && associate.store_id) {
    fetchAssociateRanking(associate.store_id, associate.id).then(setRanking)
  }
}, [associate.id, associate.store_id])

// Add desync banner — show above task list when desynced:
{ranking?.isDesynced && (
  <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 space-y-2">
    <div className="flex items-center gap-2">
      <span className="text-orange-400 text-sm">⚡</span>
      <p className="text-sm font-semibold text-orange-400">Desync Detected</p>
    </div>
    <p className="text-xs text-white/60">
      You've had some rough shifts lately. No worries — help your squad and you'll be back in sync.
    </p>
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
          Assists to resync
        </p>
        <p className="text-[10px] font-mono text-white/60">
          {ranking.desyncAssistsCompleted}/{ranking.desyncAssistsNeeded}
        </p>
      </div>
      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-orange-500 rounded-full transition-all"
          style={{ width: `${(ranking.desyncAssistsCompleted / ranking.desyncAssistsNeeded) * 100}%` }}
        />
      </div>
    </div>
    <p className="text-[10px] text-white/30 font-mono">
      Look for tasks being offered by your squad. Accept them. 2× points.
    </p>
  </div>
)}
```

---

## Change 5 of 5 — Show tier on associate profile card

In the associate's profile or header area, show their current tier:

```tsx
{ranking && (
  <div className="flex items-center gap-2">
    <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border ${
      ranking.tier === "Predator" ? "border-yellow-500/40 text-yellow-400" :
      ranking.tier === "Master" ? "border-purple-500/40 text-purple-400" :
      ranking.tier === "Diamond" ? "border-blue-400/40 text-blue-400" :
      "border-white/10 text-white/30"
    }`}>
      {ranking.isPredator ? "🔱 Predator" :
       ranking.tier === "Master" ? "⚔️ Master" :
       ranking.tier === "Diamond" ? "💠 Diamond" :
       "🏅 Platinum"}
    </span>
    <span className="text-[10px] font-mono text-white/30">
      {ranking.pointsTotal} pts
    </span>
  </div>
)}
```

---

## Verify

Run:

```bash
npm run build
```

**Test points engine:**
1. Complete a few tasks as an associate
2. Run in Supabase SQL:
```sql
SELECT * FROM points_log WHERE store_id = 'YOUR_STORE_ID' ORDER BY created_at DESC;
```
Should show rows for each completed task.

3. Manually trigger ranking calculation:
```sql
-- (Or wait for end of shift to trigger it automatically)
SELECT * FROM associate_rankings WHERE store_id = 'YOUR_STORE_ID';
```

**Test desync:**
1. Manually insert 3 verification failures in Supabase for one associate
2. Trigger `checkAndApplyDesync` — ranking should show `is_desynced = true`
3. Associate's task view shows orange desync banner with assist progress bar

**Test resync:**
1. Desynced associate accepts 3 task offers (assists)
2. After 3rd assist: `is_desynced = false`, `desync_cleared_at` set, +100 points logged
3. Associate receives "You're back in sync" ping

**Test tier display:**
1. Associate with 0 points → Platinum
2. Associate with 200+ points → Diamond
3. Associate with 500+ points → Master
4. Top 3 associates by points → Predator

Build must pass with zero TypeScript errors before you stop.
