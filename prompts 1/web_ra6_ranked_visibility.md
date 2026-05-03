# Akyra Web — RA6: Ranked Visibility + The Lobby

Do only what is described. Nothing else.

**Context:** This stage adds two things. First, full ranked visibility — associates see their tier history, their points breakdown, and their position in the store. Second, The Lobby — the pre-shift screen that shows a countdown to drop, the squad assembling, and extended associates from the previous shift. The Lobby is the calm before the drop. When the countdown hits zero or the associate taps "READY UP", the Drop Sequence fires.

**The Lobby:**
- Shows when `now < scheduled_start_time` for the associate's shift today
- Countdown timer to shift start
- Squad list: who's on the same shift (from schedule_entries)
- Who's already deployed (from active_shifts)
- Extended associates from previous shift bucket
- "READY UP" button — skips countdown, fires Drop Sequence immediately
- Apex Legends aesthetic — dark, cinematic, squad assembling

**Prerequisites:** RA4-5 complete. GX1 (Drop Sequence) complete. Schedule import complete.

---

## Before touching anything:

1. Read `src/pages/associate/AssociateDashboard.tsx` in full
2. Read `src/components/gamification/DropSequence.tsx` in full
3. Read `src/lib/repository.ts` — find schedule_entries and active_shifts methods

---

## Change 1 of 4 — Add Lobby repository methods

Add to `src/lib/repository.ts`:

```typescript
// ── The Lobby ─────────────────────────────────────────────────────────────

export interface LobbySquadMember {
  associateId: string
  associateName: string
  scheduledStart: string
  scheduledEnd: string
  isDeployed: boolean
  currentStation: string | null
  isExtended: boolean
  tier: string
  isPredator: boolean
}

/**
 * Fetch squad data for the Lobby screen.
 * Returns associates scheduled for the same shift bucket as the current associate.
 */
export async function fetchLobbySquad(
  storeId: string,
  shiftDate: string,
  shiftBucket: "6a-2p" | "2p-10p" | "10p-6a"
): Promise<LobbySquadMember[]> {
  // Get scheduled associates for this shift bucket
  const { data: scheduled } = await supabase
    .from("schedule_entries")
    .select("associate_id, start_time, end_time, associates!associate_id(name)")
    .eq("store_id", storeId)
    .eq("shift_date", shiftDate)

  if (!scheduled) return []

  // Filter to same shift bucket by time range
  const bucketRanges: Record<string, { start: number; end: number }> = {
    "6a-2p": { start: 6, end: 14 },
    "2p-10p": { start: 14, end: 22 },
    "10p-6a": { start: 22, end: 30 }, // 30 = 6am next day
  }
  const range = bucketRanges[shiftBucket]

  const inBucket = scheduled.filter(s => {
    const startHour = new Date(s.start_time).getHours()
    return startHour >= range.start && startHour < (range.end > 24 ? 24 : range.end)
  })

  const associateIds = inBucket.map(s => s.associate_id)

  // Get active shifts (deployed)
  const { data: activeShifts } = await supabase
    .from("active_shifts")
    .select("associate_id, station, is_extended")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .in("associate_id", associateIds)

  // Get rankings for tier display
  const { data: rankings } = await supabase
    .from("associate_rankings")
    .select("associate_id, tier, is_predator")
    .eq("store_id", storeId)
    .in("associate_id", associateIds)

  const activeMap: Record<string, any> = {}
  for (const a of activeShifts ?? []) activeMap[a.associate_id] = a

  const rankingMap: Record<string, any> = {}
  for (const r of rankings ?? []) rankingMap[r.associate_id] = r

  return inBucket.map(s => ({
    associateId: s.associate_id,
    associateName: (s as any).associates?.name ?? "Unknown",
    scheduledStart: s.start_time,
    scheduledEnd: s.end_time,
    isDeployed: !!activeMap[s.associate_id],
    currentStation: activeMap[s.associate_id]?.station ?? null,
    isExtended: activeMap[s.associate_id]?.is_extended ?? false,
    tier: rankingMap[s.associate_id]?.tier ?? "Platinum",
    isPredator: rankingMap[s.associate_id]?.is_predator ?? false,
  }))
}

/**
 * Fetch extended associates from the PREVIOUS shift bucket.
 * These are people who were scheduled for the last shift but are still active.
 */
export async function fetchExtendedAssociates(storeId: string): Promise<Array<{
  associateId: string
  associateName: string
  station: string
  extendedSince: string
}>> {
  const { data } = await supabase
    .from("active_shifts")
    .select("associate_id, station, updated_at, associates!associate_id(name)")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .eq("is_extended", true)

  if (!data) return []

  return data.map(s => ({
    associateId: s.associate_id,
    associateName: (s as any).associates?.name ?? "Unknown",
    station: s.station,
    extendedSince: s.updated_at,
  }))
}

/**
 * Get the current associate's scheduled start time for today.
 * Returns null if no schedule entry found.
 */
export async function fetchAssociateScheduleToday(
  associateId: string,
  storeId: string
): Promise<{ startTime: string; endTime: string } | null> {
  const today = new Date().toISOString().split("T")[0]

  const { data } = await supabase
    .from("schedule_entries")
    .select("start_time, end_time")
    .eq("associate_id", associateId)
    .eq("store_id", storeId)
    .eq("shift_date", today)
    .maybeSingle()

  if (!data) return null
  return { startTime: data.start_time, endTime: data.end_time }
}

/**
 * Determine shift bucket from a time string.
 */
export function getShiftBucketFromTime(
  timeStr: string
): "6a-2p" | "2p-10p" | "10p-6a" {
  const hour = new Date(timeStr).getHours()
  if (hour >= 6 && hour < 14) return "6a-2p"
  if (hour >= 14 && hour < 22) return "2p-10p"
  return "10p-6a"
}
```

---

## Change 2 of 4 — Create LobbyScreen component

Create `src/pages/associate/LobbyScreen.tsx`:

```tsx
import { useEffect, useState, useRef } from "react"
import { AkyraLogo } from "../../components/AkyraLogo"
import { TierBadge } from "../../components/TierBadge"
import {
  fetchLobbySquad,
  fetchExtendedAssociates,
  getShiftBucketFromTime,
  type LobbySquadMember,
} from "../../lib"

interface LobbyScreenProps {
  associateId: string
  associateName: string
  storeId: string
  storeName: string
  scheduledStart: string  // ISO string
  scheduledEnd: string
  onReadyUp: () => void   // fires Drop Sequence
}

export function LobbyScreen({
  associateId,
  associateName,
  storeId,
  storeName,
  scheduledStart,
  scheduledEnd,
  onReadyUp,
}: LobbyScreenProps) {
  const [timeLeft, setTimeLeft] = useState(0)
  const [squad, setSquad] = useState<LobbySquadMember[]>([])
  const [extended, setExtended] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const shiftBucket = getShiftBucketFromTime(scheduledStart)
  const shiftDate = new Date(scheduledStart).toISOString().split("T")[0]

  // Calculate initial time left
  useEffect(() => {
    function calculateTimeLeft() {
      const now = Date.now()
      const start = new Date(scheduledStart).getTime()
      return Math.max(0, Math.floor((start - now) / 1000))
    }

    setTimeLeft(calculateTimeLeft())

    timerRef.current = setInterval(() => {
      const left = calculateTimeLeft()
      setTimeLeft(left)

      if (left === 0) {
        clearInterval(timerRef.current!)
        onReadyUp() // Auto-fire Drop Sequence when time hits 0
      }
    }, 1000)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [scheduledStart])

  // Load squad data
  useEffect(() => {
    Promise.all([
      fetchLobbySquad(storeId, shiftDate, shiftBucket),
      fetchExtendedAssociates(storeId),
    ]).then(([s, e]) => {
      setSquad(s)
      setExtended(e)
      setIsLoading(false)
    })
  }, [storeId, shiftDate, shiftBucket])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  const isImminent = timeLeft < 60

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-[60%] h-[40%] bg-white/[0.015] blur-[150px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[40%] h-[40%] bg-[#E63946]/[0.03] blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 flex flex-col flex-1 px-6 pt-12 pb-8 max-w-sm mx-auto w-full">

        {/* Header */}
        <div className="text-center space-y-1 mb-10">
          <AkyraLogo className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/20">
            {storeName}
          </p>
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/20">
            {shiftBucket === "6a-2p" ? "6AM — 2PM" :
             shiftBucket === "2p-10p" ? "2PM — 10PM" :
             "10PM — 6AM"}
          </p>
        </div>

        {/* Countdown */}
        <div className="text-center mb-10">
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/20 mb-3">
            DROP IN
          </p>
          <p className={`text-6xl font-black font-mono tracking-tight transition-colors ${
            isImminent ? "text-[#E63946] animate-pulse" : "text-white"
          }`}>
            {formatTime(timeLeft)}
          </p>
          {isImminent && (
            <p className="text-[10px] font-mono text-[#E63946]/60 mt-2 animate-pulse">
              Get ready to drop
            </p>
          )}
        </div>

        {/* Extended associates from previous shift */}
        {extended.length > 0 && (
          <div className="mb-6 space-y-2">
            <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/20">
              Still on floor from last shift
            </p>
            {extended.map(e => (
              <div
                key={e.associateId}
                className="flex items-center justify-between bg-orange-500/[0.05] border border-orange-500/20 rounded-xl px-4 py-2.5"
              >
                <p className="text-sm text-white/60">{e.associateName}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-orange-400/60">{e.station}</span>
                  <span className="text-[9px] font-mono text-orange-400/40">extending</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Squad list */}
        <div className="flex-1 space-y-2">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/20 mb-3">
            Your squad is assembling
          </p>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-white/[0.03] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : squad.length === 0 ? (
            <p className="text-sm text-white/20 text-center py-6 font-mono">
              No squad found for this shift.
            </p>
          ) : (
            squad.map(member => (
              <div
                key={member.associateId}
                className={`flex items-center justify-between rounded-xl px-4 py-3 transition-all ${
                  member.isDeployed
                    ? "bg-white/[0.05] border border-white/10"
                    : "bg-white/[0.02] border border-white/[0.05]"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Status dot */}
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    member.isDeployed ? "bg-white" : "bg-white/20"
                  }`} />

                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm font-semibold ${
                        member.isDeployed ? "text-white" : "text-white/30"
                      }`}>
                        {member.isPredator ? "🔱 " : ""}{member.associateName}
                        {member.associateId === associateId && (
                          <span className="text-[9px] font-mono text-white/20 ml-1">you</span>
                        )}
                      </p>
                    </div>
                    {member.isDeployed && member.currentStation && (
                      <p className="text-[10px] font-mono text-white/30">
                        {member.currentStation}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {member.isDeployed ? (
                    <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">
                      deployed
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest">
                      not yet
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Ready Up button */}
        <div className="mt-8">
          <button
            onClick={onReadyUp}
            className="w-full py-4 rounded-2xl bg-white text-black font-black text-lg tracking-tight hover:bg-white/90 transition-colors active:scale-[0.98]"
          >
            READY UP →
          </button>
          <p className="text-center text-[9px] font-mono text-white/15 mt-3">
            Skip the countdown and drop now
          </p>
        </div>
      </div>
    </div>
  )
}
```

Export from `src/pages/index.ts`:

```typescript
export { LobbyScreen } from "./associate/LobbyScreen"
```

---

## Change 3 of 4 — Wire Lobby into AssociateDashboard

In `src/pages/associate/AssociateDashboard.tsx`, check for scheduled shift and show Lobby before Drop Sequence if applicable:

```tsx
import { LobbyScreen } from "./LobbyScreen"
import { fetchAssociateScheduleToday } from "../../lib"

// Add state:
const [schedule, setSchedule] = useState<{ startTime: string; endTime: string } | null>(null)
const [scheduleChecked, setScheduleChecked] = useState(false)
const [showLobby, setShowLobby] = useState(false)
const [readyUp, setReadyUp] = useState(false)

// Check schedule on mount:
useEffect(() => {
  fetchAssociateScheduleToday(associate.id, associate.store_id).then(s => {
    setSchedule(s)

    if (s) {
      const now = Date.now()
      const start = new Date(s.startTime).getTime()
      // Show Lobby if more than 2 minutes before shift start
      if (start - now > 120000) {
        setShowLobby(true)
      }
    }

    setScheduleChecked(true)
  })
}, [associate.id, associate.store_id])

// Show Lobby if applicable:
if (scheduleChecked && showLobby && !readyUp && schedule) {
  return (
    <LobbyScreen
      associateId={associate.id}
      associateName={associate.name}
      storeId={associate.store_id}
      storeName={storeName ?? "Your Store"}
      scheduledStart={schedule.startTime}
      scheduledEnd={schedule.endTime}
      onReadyUp={() => {
        setShowLobby(false)
        setReadyUp(true)
        // Drop Sequence fires from existing AssociateDashboard flow
      }}
    />
  )
}

// If not checked yet, show loading
if (!scheduleChecked) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <LoadingSpinner />
    </div>
  )
}

// Otherwise proceed with normal Drop Sequence → Task View flow
```

---

## Change 4 of 4 — Associate ranked profile view

In `src/pages/associate/AssociateTaskView.tsx`, add a profile drawer that shows full ranked breakdown when the associate taps their name/tier badge:

```tsx
import { TierBadge } from "../../components/TierBadge"

// Add state:
const [showProfile, setShowProfile] = useState(false)

// Update header to be tappable:
<button
  onClick={() => setShowProfile(true)}
  className="flex items-center gap-2"
>
  <p className="font-bold text-white">{associate.name}</p>
  {ranking && (
    <TierBadge tier={ranking.tier} isPredator={ranking.isPredator} size="sm" />
  )}
</button>

// Add profile drawer:
{showProfile && ranking && (
  <div className="fixed inset-0 z-50 flex items-end justify-center">
    <div className="absolute inset-0 bg-black/70" onClick={() => setShowProfile(false)} />
    <div className="relative w-full max-w-lg bg-akyra-surface border-t border-akyra-border rounded-t-2xl p-6 space-y-5">

      <div className="text-center space-y-2">
        <TierBadge tier={ranking.tier} isPredator={ranking.isPredator} size="lg" showPoints points={ranking.pointsTotal} />
        <p className="text-white font-bold">{associate.name}</p>
        {ranking.isPredator && (
          <p className="text-[10px] font-mono text-yellow-400/60">
            Top 3 performer at this store
          </p>
        )}
      </div>

      {/* Points breakdown */}
      <div className="space-y-2">
        <p className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary">
          Points Breakdown · 30 Days
        </p>
        {[
          { label: "Tasks completed", value: ranking.pointsTotal - ranking.pointsAssists - ranking.pointsKillLeader - ranking.pointsMvp - ranking.pointsVindicated },
          { label: "Assists given (2×)", value: ranking.pointsAssists },
          { label: "Kill Leader bonuses", value: ranking.pointsKillLeader },
          { label: "MVP bonuses", value: ranking.pointsMvp },
          { label: "Challenge vindicated", value: ranking.pointsVindicated },
        ].filter(row => row.value > 0).map(row => (
          <div key={row.label} className="flex items-center justify-between">
            <p className="text-xs text-akyra-secondary">{row.label}</p>
            <p className="text-xs font-mono text-white">+{row.value}</p>
          </div>
        ))}
        <div className="h-px bg-akyra-border" />
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-white">Total</p>
          <p className="text-xs font-mono font-bold text-white">{ranking.pointsTotal}</p>
        </div>
      </div>

      {/* Desync status if applicable */}
      {ranking.isDesynced && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 space-y-1">
          <p className="text-xs font-semibold text-orange-400">Desynced</p>
          <p className="text-[10px] text-white/40">
            Complete {ranking.desyncAssistsNeeded - ranking.desyncAssistsCompleted} more assist{ranking.desyncAssistsNeeded - ranking.desyncAssistsCompleted !== 1 ? "s" : ""} to resync.
          </p>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full"
              style={{ width: `${(ranking.desyncAssistsCompleted / ranking.desyncAssistsNeeded) * 100}%` }}
            />
          </div>
        </div>
      )}

      <button
        onClick={() => setShowProfile(false)}
        className="w-full py-3 rounded-xl border border-akyra-border text-akyra-secondary"
      >
        Close
      </button>
    </div>
  </div>
)}
```

---

## Verify

Run:

```bash
npm run build
```

**Test The Lobby:**
1. Import a schedule entry with a future start time (within 2 hours) for an associate
2. Sign in as that associate
3. Instead of Drop Sequence → Lobby appears with countdown
4. Squad list shows other scheduled associates (deployed vs not yet)
5. Extended associates from previous shift shown if any
6. Tap "READY UP" → Drop Sequence fires immediately

**Test countdown auto-fire:**
- With a schedule entry 1 minute in the future, wait → when countdown hits 0 → Drop Sequence fires automatically

**Test ranked profile:**
- Associate taps their name/tier badge in task view
- Profile drawer shows tier, points breakdown, desync status if applicable

Build must pass with zero TypeScript errors before you stop.
