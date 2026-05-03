# Akyra Web — OPS1-4: Operational Flows

Do only what is described. Nothing else.

**Context:** Four operational edge cases that every 24/7 retail operation deals with but no shift tool handles gracefully. These are the messy realities of round-the-clock operations. Each one gets a clean, respectful UX that helps the associate and the supervisor without creating friction.

**OPS1 — Shift Extension:** Associate's scheduled end time passed but they're still active. System prompts: extending, leaving soon, or already left.

**OPS2 — Holdover Protocol:** Nobody showed for the next shift. The current associate is asked to hold until relief arrives. Supervisor is alerted. District Manager is escalated if no resolution in 30 minutes.

**OPS3 — Split Shift:** Associate works part of a shift, leaves, returns later. System handles the gap gracefully.

**OPS4 — Early Departure:** Associate needs to leave before their scheduled end. Tasks are handed off. Supervisor is notified.

**Prerequisites:** RA1-6 complete. All RBAC prompts complete. `active_shifts.scheduled_end_time` column exists (from RA1 SQL).

---

## SQL — Run before starting

```sql
-- Holdover tracking
CREATE TABLE IF NOT EXISTS holdover_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  associate_id UUID NOT NULL REFERENCES associates(id) ON DELETE CASCADE,
  shift_bucket TEXT NOT NULL CHECK (shift_bucket IN ('6a-2p', '2p-10p', '10p-6a')),
  shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  relief_associate_id UUID REFERENCES associates(id) ON DELETE SET NULL,
  is_escalated BOOLEAN NOT NULL DEFAULT false,
  escalated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE holdover_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow anon select" ON holdover_events FOR SELECT TO anon USING (true);
CREATE POLICY "allow anon insert" ON holdover_events FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "allow anon update" ON holdover_events FOR UPDATE TO anon USING (true);

-- Split shift tracking
ALTER TABLE active_shifts
  ADD COLUMN IF NOT EXISTS is_split_shift BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS split_return_time TIMESTAMPTZ;
```

---

## Before touching anything:

1. Read `src/pages/associate/AssociateTaskView.tsx` in full
2. Read `src/pages/dashboard/OverviewPage.tsx` in full
3. Read `src/lib/repository.ts` — find active_shifts methods
4. Read `src/components/gamification/ExtractionSequence.tsx` in full

---

## Change 1 of 6 — Add OPS repository methods

Add to `src/lib/repository.ts`:

```typescript
// ── OPS1: Shift Extension ─────────────────────────────────────────────────

export async function extendShift(
  associateId: string,
  storeId: string,
  extensionMinutes: number,
  reason: "extending" | "leaving_soon"
): Promise<boolean> {
  const newExpiry = new Date(Date.now() + extensionMinutes * 60 * 1000).toISOString()

  const { error } = await supabase
    .from("active_shifts")
    .update({
      expires_at: newExpiry,
      is_extended: true,
      extension_reason: reason === "extending" ? `Extended ${extensionMinutes} minutes` : "Wrapping up",
    })
    .eq("associate_id", associateId)
    .eq("store_id", storeId)
    .eq("is_active", true)

  return !error
}

export async function closeShiftEarly(
  associateId: string,
  storeId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("active_shifts")
    .update({
      is_active: false,
      expires_at: new Date().toISOString(),
    })
    .eq("associate_id", associateId)
    .eq("store_id", storeId)
    .eq("is_active", true)

  return !error
}

/**
 * Check if an associate's shift has ended but they're still active.
 * Returns minutes past scheduled end, or 0 if not overdue.
 */
export async function checkShiftOverdue(
  associateId: string,
  storeId: string
): Promise<number> {
  const { data } = await supabase
    .from("active_shifts")
    .select("scheduled_end_time, is_extended")
    .eq("associate_id", associateId)
    .eq("store_id", storeId)
    .eq("is_active", true)
    .maybeSingle()

  if (!data?.scheduled_end_time || data.is_extended) return 0

  const endTime = new Date(data.scheduled_end_time).getTime()
  const now = Date.now()
  const overdueMs = now - endTime

  return overdueMs > 0 ? Math.floor(overdueMs / 60000) : 0
}

// ── OPS2: Holdover Protocol ───────────────────────────────────────────────

export async function initiateHoldover(
  associateId: string,
  storeId: string,
  shiftBucket: "6a-2p" | "2p-10p" | "10p-6a"
): Promise<string | null> {
  // Extend the associate's shift by 2 hours
  await extendShift(associateId, storeId, 120, "extending")

  const { data, error } = await supabase
    .from("holdover_events")
    .insert({
      store_id: storeId,
      associate_id: associateId,
      shift_bucket: shiftBucket,
      shift_date: new Date().toISOString().split("T")[0],
    })
    .select("id")
    .maybeSingle()

  if (error || !data) return null

  // Notify all supervisors on shift
  const { data: supervisors } = await supabase
    .from("active_shifts")
    .select("associate_id, associates!associate_id(role_rank)")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .neq("associate_id", associateId)

  for (const s of supervisors ?? []) {
    if ((s as any).associates?.role_rank >= 2) {
      await supabase.from("pings").insert({
        store_id: storeId,
        from_associate_id: associateId,
        to_associate_id: s.associate_id,
        message: "No relief for next shift. Holdover protocol active. Who can I call?",
        ping_type: "direct",
      })
    }
  }

  return data.id
}

export async function resolveHoldover(
  holdoverId: string,
  reliefAssociateId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("holdover_events")
    .update({
      resolved_at: new Date().toISOString(),
      relief_associate_id: reliefAssociateId,
    })
    .eq("id", holdoverId)

  return !error
}

// ── OPS3: Split Shift ─────────────────────────────────────────────────────

export async function markSplitShiftDeparture(
  associateId: string,
  storeId: string,
  returnTime: string
): Promise<boolean> {
  const { error } = await supabase
    .from("active_shifts")
    .update({
      is_active: false,
      is_split_shift: true,
      split_return_time: returnTime,
    })
    .eq("associate_id", associateId)
    .eq("store_id", storeId)
    .eq("is_active", true)

  return !error
}

export async function markSplitShiftReturn(
  associateId: string,
  storeId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("active_shifts")
    .update({
      is_active: true,
      expires_at: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
    })
    .eq("associate_id", associateId)
    .eq("store_id", storeId)
    .eq("is_split_shift", true)

  return !error
}

// ── OPS4: Early Departure ─────────────────────────────────────────────────

export async function initiateEarlyDeparture(
  associateId: string,
  storeId: string,
  reason: string
): Promise<boolean> {
  // Orphan all assigned incomplete tasks
  await supabase
    .from("tasks")
    .update({ is_orphaned: true, assigned_to_associate_id: null })
    .eq("assigned_to_associate_id", associateId)
    .eq("store_id", storeId)
    .eq("is_completed", false)

  // Notify supervisor
  const { data: supervisors } = await supabase
    .from("active_shifts")
    .select("associate_id, associates!associate_id(role_rank)")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .neq("associate_id", associateId)

  for (const s of supervisors ?? []) {
    if ((s as any).associates?.role_rank >= 2) {
      await supabase.from("pings").insert({
        store_id: storeId,
        from_associate_id: associateId,
        to_associate_id: s.associate_id,
        message: `Early departure: ${reason}. Their tasks have been orphaned.`,
        ping_type: "direct",
      })
    }
  }

  // Close the shift
  await closeShiftEarly(associateId, storeId)
  return true
}
```

---

## Change 2 of 6 — Create ShiftExtensionModal

Create `src/components/ShiftExtensionModal.tsx`:

```tsx
import { useState } from "react"
import { extendShift, closeShiftEarly } from "../lib"
import { LoadingSpinner } from "./LoadingSpinner"

interface ShiftExtensionModalProps {
  associateId: string
  storeId: string
  minutesOverdue: number
  onExtended: () => void
  onLeaving: () => void  // triggers Extraction
  onLeft: () => void     // closes session silently
}

export function ShiftExtensionModal({
  associateId,
  storeId,
  minutesOverdue,
  onExtended,
  onLeaving,
  onLeft,
}: ShiftExtensionModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showExtensionOptions, setShowExtensionOptions] = useState(false)

  async function handleExtend(minutes: number) {
    setIsLoading(true)
    await extendShift(associateId, storeId, minutes, "extending")
    setIsLoading(false)
    onExtended()
  }

  async function handleLeavingSoon() {
    setIsLoading(true)
    await extendShift(associateId, storeId, 15, "leaving_soon")
    setIsLoading(false)
    onLeaving()
  }

  async function handleAlreadyLeft() {
    setIsLoading(true)
    await closeShiftEarly(associateId, storeId)
    setIsLoading(false)
    onLeft()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/80" />
      <div className="relative w-full max-w-lg bg-akyra-surface border-t border-akyra-border rounded-t-2xl p-6 space-y-5">

        <div className="text-center space-y-1">
          <p className="font-black text-white text-lg">Your shift ended {minutesOverdue} min ago.</p>
          <p className="text-sm text-akyra-secondary">Are you staying?</p>
        </div>

        {!showExtensionOptions ? (
          <div className="space-y-3">
            <button
              onClick={() => setShowExtensionOptions(true)}
              disabled={isLoading}
              className="w-full py-4 rounded-xl bg-white text-black font-bold text-sm"
            >
              Extending — I'll be here a bit longer
            </button>
            <button
              onClick={handleLeavingSoon}
              disabled={isLoading}
              className="w-full py-4 rounded-xl border border-akyra-border text-white font-semibold text-sm"
            >
              Leaving soon — wrapping up
            </button>
            <button
              onClick={handleAlreadyLeft}
              disabled={isLoading}
              className="w-full py-3 text-akyra-secondary text-sm font-mono"
            >
              I already left — close my session
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-mono text-akyra-secondary text-center">How long are you staying?</p>
            {[30, 60, 120].map(minutes => (
              <button
                key={minutes}
                onClick={() => handleExtend(minutes)}
                disabled={isLoading}
                className="w-full py-3 rounded-xl border border-akyra-border text-white font-semibold text-sm flex items-center justify-center gap-2"
              >
                {isLoading ? <LoadingSpinner size="sm" /> : `+${minutes >= 60 ? `${minutes / 60}hr` : `${minutes}min`}`}
              </button>
            ))}
            <button
              onClick={() => setShowExtensionOptions(false)}
              className="w-full text-xs font-mono text-akyra-secondary"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

Export from `src/components/index.ts`:

```typescript
export { ShiftExtensionModal } from "./ShiftExtensionModal"
```

---

## Change 3 of 6 — Create HoldoverModal

Create `src/components/HoldoverModal.tsx`:

```tsx
import { useState } from "react"
import { initiateHoldover } from "../lib"
import { LoadingSpinner } from "./LoadingSpinner"

interface HoldoverModalProps {
  associateId: string
  storeId: string
  shiftBucket: "6a-2p" | "2p-10p" | "10p-6a"
  onHoldoverStarted: (holdoverId: string) => void
  onDecline: () => void
}

export function HoldoverModal({
  associateId,
  storeId,
  shiftBucket,
  onHoldoverStarted,
  onDecline,
}: HoldoverModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleAccept() {
    setIsLoading(true)
    const holdoverId = await initiateHoldover(associateId, storeId, shiftBucket)
    setIsLoading(false)
    if (holdoverId) onHoldoverStarted(holdoverId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/80" />
      <div className="relative w-full max-w-lg bg-akyra-surface border-t border-[#E63946]/30 rounded-t-2xl p-6 space-y-5">

        <div className="text-center space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[#E63946]/60">
            Holdover Protocol
          </p>
          <p className="font-black text-white text-lg">Nobody showed for next shift.</p>
          <p className="text-sm text-akyra-secondary">
            Can you hold until relief arrives? Your supervisor has been notified.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleAccept}
            disabled={isLoading}
            className="w-full py-4 rounded-xl bg-white text-black font-bold flex items-center justify-center gap-2"
          >
            {isLoading ? <><LoadingSpinner size="sm" /> Starting holdover...</> : "I'll hold. Let's go."}
          </button>
          <button
            onClick={onDecline}
            disabled={isLoading}
            className="w-full py-3 text-akyra-secondary text-sm font-mono"
          >
            I can't stay — someone else needs to handle this
          </button>
        </div>

        <p className="text-[9px] font-mono text-white/20 text-center">
          Your shift will be extended by 2 hours automatically.
          Escalates to district management if unresolved in 30 minutes.
        </p>
      </div>
    </div>
  )
}
```

Export from `src/components/index.ts`:

```typescript
export { HoldoverModal } from "./HoldoverModal"
```

---

## Change 4 of 6 — Create EarlyDepartureModal

Create `src/components/EarlyDepartureModal.tsx`:

```tsx
import { useState } from "react"
import { initiateEarlyDeparture } from "../lib"
import { LoadingSpinner } from "./LoadingSpinner"

interface EarlyDepartureModalProps {
  associateId: string
  storeId: string
  onDeparted: () => void
  onDismiss: () => void
}

const REASONS = [
  "Feeling unwell",
  "Family emergency",
  "Transportation issue",
  "Scheduled appointment",
  "Other",
]

export function EarlyDepartureModal({
  associateId,
  storeId,
  onDeparted,
  onDismiss,
}: EarlyDepartureModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleDepart() {
    if (!selectedReason) return
    setIsLoading(true)
    await initiateEarlyDeparture(associateId, storeId, selectedReason)
    setIsLoading(false)
    onDeparted()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onDismiss} />
      <div className="relative w-full max-w-lg bg-akyra-surface border-t border-akyra-border rounded-t-2xl p-6 space-y-5">

        <div className="space-y-1">
          <p className="font-bold text-white">Early Departure</p>
          <p className="text-sm text-akyra-secondary">
            Your tasks will be handed back to the queue. Your supervisor will be notified.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-mono text-akyra-secondary uppercase tracking-widest">Reason</p>
          {REASONS.map(reason => (
            <button
              key={reason}
              onClick={() => setSelectedReason(reason)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                selectedReason === reason
                  ? "border-white bg-white/10 text-white"
                  : "border-akyra-border text-akyra-secondary hover:text-white"
              }`}
            >
              {reason}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            className="flex-1 py-3 rounded-xl border border-akyra-border text-akyra-secondary text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleDepart}
            disabled={!selectedReason || isLoading}
            className="flex-1 py-3 rounded-xl bg-[#E63946] text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <><LoadingSpinner size="sm" /> Departing...</> : "Confirm Departure"}
          </button>
        </div>
      </div>
    </div>
  )
}
```

Export from `src/components/index.ts`:

```typescript
export { EarlyDepartureModal } from "./EarlyDepartureModal"
```

---

## Change 5 of 6 — Wire OPS modals into AssociateTaskView

In `src/pages/associate/AssociateTaskView.tsx`, add shift lifecycle checks:

```tsx
import {
  checkShiftOverdue,
  ShiftExtensionModal,
  HoldoverModal,
  EarlyDepartureModal,
} from "../../lib"
import { ShiftExtensionModal } from "../../components/ShiftExtensionModal"
import { EarlyDepartureModal } from "../../components/EarlyDepartureModal"

// Add state:
const [minutesOverdue, setMinutesOverdue] = useState(0)
const [showExtension, setShowExtension] = useState(false)
const [showEarlyDeparture, setShowEarlyDeparture] = useState(false)

// Check shift overdue every 5 minutes:
useEffect(() => {
  async function checkOverdue() {
    const minutes = await checkShiftOverdue(associate.id, associate.store_id)
    if (minutes > 0 && !showExtension) {
      setMinutesOverdue(minutes)
      setShowExtension(true)
    }
  }

  checkOverdue()
  const interval = setInterval(checkOverdue, 5 * 60 * 1000)
  return () => clearInterval(interval)
}, [associate.id, associate.store_id])

// Add "Leave early" option to the radial menu or extraction flow:
// In the associate's overflow menu or settings area:
<button
  onClick={() => setShowEarlyDeparture(true)}
  className="text-xs font-mono text-akyra-secondary hover:text-akyra-red transition-colors"
>
  Leave early
</button>

// Render modals:
{showExtension && (
  <ShiftExtensionModal
    associateId={associate.id}
    storeId={associate.store_id}
    minutesOverdue={minutesOverdue}
    onExtended={() => setShowExtension(false)}
    onLeaving={() => {
      setShowExtension(false)
      // Trigger extraction sequence
    }}
    onLeft={() => {
      // Navigate to login
      navigate("/app/login")
    }}
  />
)}

{showEarlyDeparture && (
  <EarlyDepartureModal
    associateId={associate.id}
    storeId={associate.store_id}
    onDeparted={() => navigate("/app/login")}
    onDismiss={() => setShowEarlyDeparture(false)}
  />
)}
```

---

## Change 6 of 6 — Show extended associates on station board

In `src/pages/dashboard/OverviewPage.tsx`, show an "[+Xhr]" badge on extended associates in the station board:

```tsx
{/* In the associate card in the station board: */}
{associate.is_extended && (
  <span className="text-[9px] font-mono text-orange-400/60 border border-orange-500/20 rounded px-1.5 py-0.5">
    extending
  </span>
)}
```

Also show extended associates from previous shift in a separate section at the top of the station board:

```tsx
{extended.length > 0 && (
  <div className="mb-4">
    <p className="text-[9px] font-mono uppercase tracking-widest text-orange-400/40 mb-2">
      Holdovers from last shift
    </p>
    {extended.map(e => (
      <div key={e.associateId} className="flex items-center justify-between bg-orange-500/[0.04] border border-orange-500/15 rounded-xl px-3 py-2 mb-1.5">
        <p className="text-sm text-white/60">{e.associateName}</p>
        <span className="text-[9px] font-mono text-orange-400/50">{e.station} · extending</span>
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

**Test OPS1 — Shift Extension:**
1. Set `scheduled_end_time` to 10 minutes ago for an active shift in Supabase
2. Open associate task view
3. ShiftExtensionModal appears: "Your shift ended X min ago"
4. Choose "+1hr" → modal dismisses, `is_extended = true` in DB, `expires_at` updated
5. Station board shows "extending" badge

**Test OPS4 — Early Departure:**
1. In associate task view, tap "Leave early"
2. Select reason → Confirm Departure
3. Check: assigned tasks orphaned, supervisor ping sent, session closed
4. Navigate back to login

**Test holdover (manual trigger via Supabase):**
1. Insert holdover event manually
2. Verify supervisor receives ping

Build must pass with zero TypeScript errors before you stop.
