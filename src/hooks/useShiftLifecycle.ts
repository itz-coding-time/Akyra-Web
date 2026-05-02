import { useEffect, useState, useCallback, useRef } from "react"
import { calculateAndSaveShiftResults, getShiftBucket } from "../lib"
import { supabase } from "../lib/supabase"

export type ShiftPhase =
  | "pre-shift"
  | "active"
  | "final-hour"
  | "final-fifteen"
  | "extracting"
  | "complete"

async function saveShiftResults(
  associateId: string,
  storeId: string,
  startTime: string
): Promise<void> {
  const bucket = getShiftBucket(startTime)
  const today = new Date().toISOString().split("T")[0]

  // Fetch this associate's task completion for today
  const { data: tasks } = await supabase
    .from("tasks")
    .select("is_completed, pending_verification, assigned_to_associate_id")
    .eq("store_id", storeId)

  const myTasks = (tasks ?? []).filter(t => t.assigned_to_associate_id === associateId)
  const completed = myTasks.filter(t => t.is_completed || t.pending_verification).length

  await calculateAndSaveShiftResults(storeId, bucket, today, [{
    associateId,
    tasksCompleted: completed,
    tasksOrphaned: 0, // TODO: track orphaned per associate
    tasksTotal: myTasks.length,
  }])
}

export function useShiftLifecycle(
  startTime: string,
  _endTime: string,
  storeId: string,
  associateId: string
) {
  const [phase, setPhase] = useState<ShiftPhase>("pre-shift")
  const [minutesRemaining, setMinutesRemaining] = useState(0)
  const [showWarning, setShowWarning] = useState(false)
  const [warningDismissed, setWarningDismissed] = useState(false)
  const resultsSavedRef = useRef(false)

  const calculatePhase = useCallback(async () => {
    const { data: shift, error } = await supabase
      .from("active_shifts")
      .select("expires_at, scheduled_end_time, is_extended, on_break")
      .eq("associate_id", associateId)
      .eq("store_id", storeId)
      .eq("is_active", true)
      .maybeSingle()

    if (error || !shift) {
      setPhase("pre-shift")
      return
    }

    if ((shift as any).on_break) {
      setPhase("active")
      setMinutesRemaining(30) // dummy
      return
    }

    const now = Date.now()
    const expiresAt = new Date((shift as any).expires_at).getTime()
    const timeLeftMs = expiresAt - now
    const remaining = Math.max(0, Math.floor(timeLeftMs / 60000))
    setMinutesRemaining(remaining)

    if (timeLeftMs <= 0) {
      setPhase("complete")
    } else if (timeLeftMs <= 15 * 60 * 1000) {
      setPhase(prev => {
        if (prev !== "final-fifteen" && !warningDismissed) {
          setShowWarning(true)
        }
        return "final-fifteen"
      })
    } else if (timeLeftMs <= 60 * 60 * 1000) {
      setPhase(prev => {
        if (prev === "active" && !warningDismissed) {
          setShowWarning(true)
        }
        return "final-hour"
      })
    } else {
      setPhase("active")
    }
  }, [associateId, storeId, warningDismissed])

  useEffect(() => {
    calculatePhase()
    const interval = setInterval(calculatePhase, 15_000) // check every 15s for better accuracy
    return () => clearInterval(interval)
  }, [calculatePhase])

  // Save shift results once when phase reaches "complete"
  useEffect(() => {
    if (phase === "complete" && !resultsSavedRef.current) {
      resultsSavedRef.current = true
      saveShiftResults(associateId, storeId, startTime).catch(err =>
        console.error("saveShiftResults failed:", err)
      )
    }
  }, [phase, associateId, storeId, startTime])

  function dismissWarning() {
    setShowWarning(false)
    setWarningDismissed(true)
  }

  // Reset dismissed flag when phase changes so next phase gets its own warning
  useEffect(() => {
    setWarningDismissed(false)
    setShowWarning(false)
  }, [phase])

  return {
    phase,
    minutesRemaining,
    showWarning,
    dismissWarning,
  }
}

