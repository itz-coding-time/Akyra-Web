import { useEffect, useState, useCallback, useRef } from "react"
import { calculateShiftProgress, isAssociateOnClock } from "../lib/timeEngine"
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
  endTime: string,
  storeId: string,
  associateId: string
) {
  const [phase, setPhase] = useState<ShiftPhase>("pre-shift")
  const [minutesRemaining, setMinutesRemaining] = useState(0)
  const [showWarning, setShowWarning] = useState(false)
  const [warningDismissed, setWarningDismissed] = useState(false)
  const resultsSavedRef = useRef(false)

  const calculatePhase = useCallback(() => {
    const onClock = isAssociateOnClock(startTime, endTime)
    if (!onClock) {
      setPhase("pre-shift")
      return
    }

    const progress = calculateShiftProgress(startTime, endTime)
    const totalMins = getTotalShiftMinutes(startTime, endTime)
    const remaining = Math.round(totalMins * (1 - progress))
    setMinutesRemaining(remaining)

    if (remaining <= 0) {
      setPhase("complete")
    } else if (remaining <= 15) {
      setPhase(prev => {
        if (prev !== "final-fifteen" && !warningDismissed) {
          setShowWarning(true)
        }
        return "final-fifteen"
      })
    } else if (remaining <= 60) {
      setPhase(prev => {
        if (prev === "active" && !warningDismissed) {
          setShowWarning(true)
        }
        return "final-hour"
      })
    } else {
      setPhase("active")
    }
  }, [startTime, endTime, warningDismissed])

  useEffect(() => {
    calculatePhase()
    const interval = setInterval(calculatePhase, 60_000) // check every minute
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

function getTotalShiftMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number)
  const [eh, em] = endTime.split(":").map(Number)
  const startMins = sh * 60 + sm
  let endMins = eh * 60 + em
  if (endMins <= startMins) endMins += 24 * 60
  return endMins - startMins
}
