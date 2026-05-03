# Akyra Web — RA5: Ranked Tier System

Do only what is described. Nothing else.

**Context:** This stage builds the full ranked tier experience. Associates see their tier on their profile. Predators are flagged as succession candidates. The station board shows a subtle Predator indicator. Store Managers see a talent pipeline panel. The End of Shift Results screen shows tier changes.

**Tier rules:**
- Platinum: entry level, no stigma, everyone starts here
- Diamond: 200+ points (rolling 30 days)
- Master: 500+ points (rolling 30 days)
- Predator: top 3 associates by points per store — only 3 can hold this title at any time

**Predators are:**
- Flagged as succession candidates
- Visible to Store Managers as "next supervisors"
- Visible to District Managers across all stores in their district
- NOT punished when they drop out of top 3 — they fall to Master, not below

**Prerequisites:** RA4 complete. RBAC2 complete. `associate_rankings` table populated.

---

## Before touching anything:

1. Read `src/pages/associate/AssociateTaskView.tsx` — find ranking display from RA4
2. Read `src/pages/dashboard/StoreManagerPage.tsx` — find performers panel
3. Read `src/components/gamification/EndOfShiftResults.tsx` in full
4. Read `src/pages/dashboard/OverviewPage.tsx` — find station board

---

## Change 1 of 5 — Create TierBadge component

Create `src/components/TierBadge.tsx`:

```tsx
interface TierBadgeProps {
  tier: string
  isPredator?: boolean
  size?: "sm" | "md" | "lg"
  showPoints?: boolean
  points?: number
}

const TIER_CONFIG = {
  Predator: {
    emoji: "🔱",
    label: "Predator",
    border: "border-yellow-500/50",
    text: "text-yellow-400",
    bg: "bg-yellow-500/10",
  },
  Master: {
    emoji: "⚔️",
    label: "Master",
    border: "border-purple-500/40",
    text: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  Diamond: {
    emoji: "💠",
    label: "Diamond",
    border: "border-blue-400/40",
    text: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  Platinum: {
    emoji: "🏅",
    label: "Platinum",
    border: "border-white/10",
    text: "text-white/40",
    bg: "bg-white/[0.03]",
  },
}

export function TierBadge({
  tier,
  isPredator = false,
  size = "sm",
  showPoints = false,
  points = 0,
}: TierBadgeProps) {
  const config = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.Platinum
  const displayTier = isPredator ? "Predator" : tier
  const displayConfig = isPredator ? TIER_CONFIG.Predator : config

  const sizeClasses = {
    sm: "text-[9px] px-2 py-0.5",
    md: "text-[11px] px-3 py-1",
    lg: "text-sm px-4 py-1.5",
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className={`font-mono uppercase tracking-widest rounded border ${displayConfig.bg} ${displayConfig.border} ${displayConfig.text} ${sizeClasses[size]} flex items-center gap-1`}>
        <span>{displayConfig.emoji}</span>
        <span>{displayConfig.label}</span>
      </span>
      {showPoints && (
        <span className="text-[9px] font-mono text-white/30">
          {points} pts
        </span>
      )}
    </div>
  )
}
```

Export from `src/components/index.ts`:

```typescript
export { TierBadge } from "./TierBadge"
```

---

## Change 2 of 5 — Add tier change notification to EndOfShiftResults

In `src/components/gamification/EndOfShiftResults.tsx`, show tier changes at the bottom of the results screen:

```tsx
import { TierBadge } from "../TierBadge"
import { fetchAssociateRanking } from "../../lib"

// Add state after existing state:
const [ranking, setRanking] = useState<any>(null)
const [previousTier, setPreviousTier] = useState<string | null>(null)

// Load after results load:
useEffect(() => {
  if (associateId && storeId) {
    fetchAssociateRanking(storeId, associateId).then(r => {
      setRanking(r)
    })
  }
}, [associateId, storeId])

// Add tier section at bottom of results, before the "Drop again" button:
{ranking && (
  <div className="text-center space-y-2 pt-2 border-t border-white/10">
    <TierBadge
      tier={ranking.tier}
      isPredator={ranking.isPredator}
      size="md"
      showPoints
      points={ranking.pointsTotal}
    />

    {ranking.isPredator && (
      <p className="text-[10px] font-mono text-yellow-400/60">
        You are one of the top performers at this store.
      </p>
    )}

    {ranking.isDesynced && (
      <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2">
        <p className="text-[10px] text-orange-400/80 font-mono">
          Still desynced · {ranking.desyncAssistsCompleted}/{ranking.desyncAssistsNeeded} assists toward resync
        </p>
      </div>
    )}
  </div>
)}
```

---

## Change 3 of 5 — Add Predator indicator to station board

In `src/pages/dashboard/OverviewPage.tsx`, show a subtle Predator indicator on associate cards in the station board:

```tsx
import { fetchStoreLeaderboard } from "../../lib"

// Add state:
const [leaderboard, setLeaderboard] = useState<any[]>([])

// Load on mount:
useEffect(() => {
  if (storeId) {
    fetchStoreLeaderboard(storeId).then(setLeaderboard)
  }
}, [storeId])

// In the station board associate card, after the name:
const associateRanking = leaderboard.find(r => r.associateId === associate.profile_id)

{associateRanking?.isPredator && (
  <span className="text-yellow-400 text-[10px]" title="Predator — Top 3">🔱</span>
)}
{associateRanking?.isDesynced && (
  <span className="text-orange-400 text-[10px]" title="Desynced">⚡</span>
)}
```

---

## Change 4 of 5 — Add Talent Pipeline panel to StoreManagerPage

In `src/pages/dashboard/StoreManagerPage.tsx`, upgrade the Top Performers panel to show ranked tiers and succession candidates:

```tsx
import { TierBadge } from "../../components/TierBadge"
import { fetchStoreLeaderboard } from "../../lib"

// Add state:
const [leaderboard, setLeaderboard] = useState<any[]>([])

// Add to data loading:
fetchStoreLeaderboard(storeId),

// Wire result into leaderboard state

// Update performers panel:
{activePanel === "performers" && (
  <div className="space-y-4">
    {/* Predator highlight */}
    {leaderboard.filter(r => r.isPredator).length > 0 && (
      <div className="space-y-2">
        <p className="text-[10px] font-mono uppercase tracking-widest text-yellow-400/60">
          🔱 Predators — Succession Candidates
        </p>
        {leaderboard.filter(r => r.isPredator).map((r, i) => (
          <div key={r.associateId} className="bg-yellow-500/[0.05] border border-yellow-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-white">{r.associateName}</p>
                <p className="text-xs text-yellow-400/60 font-mono mt-0.5">
                  Ready for supervisor consideration
                </p>
              </div>
              <div className="text-right">
                <TierBadge tier="Predator" isPredator size="sm" />
                <p className="text-[10px] font-mono text-white/30 mt-1">
                  {r.pointsTotal} pts
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}

    {/* Full leaderboard */}
    <div className="space-y-2">
      <p className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary">
        Store Leaderboard · 30 Days
      </p>
      {leaderboard.map((r, i) => (
        <div
          key={r.associateId}
          className={`flex items-center justify-between bg-akyra-surface border rounded-xl px-4 py-3 ${
            r.isPredator ? "border-yellow-500/20" :
            r.isDesynced ? "border-orange-500/20" :
            "border-akyra-border"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className={`text-sm font-black w-5 text-center ${
              i === 0 ? "text-yellow-400" :
              i === 1 ? "text-white/50" :
              i === 2 ? "text-white/30" :
              "text-white/20"
            }`}>
              {i + 1}
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-white text-sm">{r.associateName}</p>
                {r.isDesynced && (
                  <span className="text-[9px] text-orange-400" title="Desynced">⚡</span>
                )}
              </div>
              <p className="text-[10px] font-mono text-white/30">
                {r.pointsAssists > 0 && `${r.pointsAssists} assist pts · `}
                {r.pointsTotal} total
              </p>
            </div>
          </div>
          <TierBadge tier={r.tier} isPredator={r.isPredator} size="sm" />
        </div>
      ))}

      {leaderboard.length === 0 && (
        <p className="text-sm text-akyra-secondary">No ranking data yet. Complete a shift to see rankings.</p>
      )}
    </div>
  </div>
)}
```

---

## Change 5 of 5 — Add cross-store Predator view to District Manager

In `src/lib/repository.ts`, add district-level Predator fetch:

```typescript
export async function fetchDistrictPredators(districtId: string): Promise<Array<{
  associateId: string
  associateName: string
  storeId: string
  storeNumber: string
  pointsTotal: number
}>> {
  const { data, error } = await supabase
    .from("associate_rankings")
    .select(`
      associate_id, associate_name, store_id, points_total,
      stores!store_id(store_number)
    `)
    .eq("district_id", districtId)
    .eq("is_predator", true)
    .order("points_total", { ascending: false })

  if (error || !data) return []

  return data.map(r => ({
    associateId: r.associate_id,
    associateName: r.associate_name,
    storeId: r.store_id,
    storeNumber: (r as any).stores?.store_number ?? "?",
    pointsTotal: r.points_total,
  }))
}
```

In `src/pages/dashboard/RegionalAdminPage.tsx` (or wherever district view lives), add a Predators section to the district drill-down:

```tsx
// When viewing a district's stores, show a Predators section at the top:
import { fetchDistrictPredators, TierBadge } from "../../lib"

const [districtPredators, setDistrictPredators] = useState<any[]>([])

useEffect(() => {
  if (view.level === "stores" && view.districtId) {
    fetchDistrictPredators(view.districtId).then(setDistrictPredators)
  }
}, [view])

{districtPredators.length > 0 && (
  <div className="space-y-2 mb-4">
    <p className="text-[10px] font-mono uppercase tracking-widest text-yellow-400/60">
      🔱 District Predators
    </p>
    {districtPredators.map(p => (
      <div key={p.associateId} className="flex items-center justify-between bg-yellow-500/[0.05] border border-yellow-500/20 rounded-xl px-4 py-3">
        <div>
          <p className="font-semibold text-white">{p.associateName}</p>
          <p className="text-xs font-mono text-white/30">Store {p.storeNumber}</p>
        </div>
        <div className="text-right">
          <TierBadge tier="Predator" isPredator size="sm" />
          <p className="text-[10px] font-mono text-white/20 mt-0.5">{p.pointsTotal} pts</p>
        </div>
      </div>
    ))}
  </div>
)}
```

---

## Verify

Run:

```bash
npm run build
```

**Test tier display:**
1. Manually set points in `associate_rankings`:
```sql
UPDATE associate_rankings SET points_total = 250, tier = 'Diamond' WHERE associate_id = 'YOUR_ID';
UPDATE associate_rankings SET points_total = 600, tier = 'Master', is_predator = true WHERE associate_id = 'YOUR_ID';
```
2. Associate task view shows tier badge
3. End of shift results shows tier at bottom
4. Station board shows 🔱 on Predator associates

**Test Predator succession:**
- Store Manager performers panel shows gold Predator section at top
- "Ready for supervisor consideration" label appears

**Test district view:**
- District Manager view shows 🔱 District Predators across all stores

Build must pass with zero TypeScript errors before you stop.
