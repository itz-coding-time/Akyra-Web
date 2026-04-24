import { useEffect, useState, useCallback } from "react"
import { supabase } from "../lib/supabase"
import {
  fetchScheduleForStore,
  fetchTasksForSupervisor,
  fetchPendingVerificationTasks,
  verifyTaskComplete,
  rejectTaskCompletion,
  fetchOrphanedTasks,
  clearOrphanFlag,
} from "../lib"
import { calculateShiftProgress, isAssociateOnClock } from "../lib/timeEngine"
import { calculatePacingTier } from "../lib/pacing"
import type { PacingResult } from "../lib/pacing"
import type { Database } from "../types/database.types"

type Task = Database["public"]["Tables"]["tasks"]["Row"]
type ScheduleEntry = Database["public"]["Tables"]["schedule_entries"]["Row"]

export interface AssociatePacing {
  associateId: string
  associateName: string
  archetype: string
  startTime: string
  endTime: string
  onClock: boolean
  completedTasks: number
  totalTasks: number
  pacing: PacingResult
}

export function usePacingBoard(storeId: string | null | undefined) {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [pendingTasks, setPendingTasks] = useState<Task[]>([])
  const [orphanedTasks, setOrphanedTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isVerifying, setIsVerifying] = useState<string | null>(null)

  const today = new Date().toISOString().split("T")[0]

  const loadAll = useCallback(async () => {
    if (!storeId) return
    setIsLoading(true)

    const [scheduleData, taskData, pendingData, orphaned] = await Promise.all([
      fetchScheduleForStore(storeId, today),
      fetchTasksForSupervisor(storeId),
      fetchPendingVerificationTasks(storeId),
      fetchOrphanedTasks(storeId),
    ])

    setSchedule(scheduleData)
    setTasks(taskData)
    setPendingTasks(pendingData)
    setOrphanedTasks(orphaned)
    setIsLoading(false)
  }, [storeId, today])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Realtime: watch for task changes
  useEffect(() => {
    if (!storeId) return

    const channel = supabase
      .channel(`pacing-tasks-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
          filter: `store_id=eq.${storeId}`,
        },
        () => {
          // Re-fetch on any task update
          loadAll()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [storeId, loadAll])

  // Refresh pacing every minute (time progresses)
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render for time calculations
      setPendingTasks((prev) => [...prev])
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  // Build pacing data per associate
  const pacingData: AssociatePacing[] = schedule
    .filter((entry) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const assoc = (entry as any).associates
      return assoc && assoc.role !== "supervisor" &&
        assoc.role !== "store_manager" &&
        assoc.role !== "district_manager" &&
        assoc.role !== "org_admin"
    })
    .map((entry) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const assoc = (entry as any).associates
      const archetype = assoc?.current_archetype ?? "Float"
      const name = assoc?.name ?? "Unknown"

      const onClock = isAssociateOnClock(entry.start_time, entry.end_time)
      const timeElapsed = calculateShiftProgress(entry.start_time, entry.end_time)

      // Count tasks for this associate's archetype
      const assocTasks = tasks.filter(
        (t) => t.archetype === archetype || t.assigned_to === name
      )
      const completedCount = assocTasks.filter(
        (t) => t.pending_verification || t.is_completed
      ).length

      const pacing = calculatePacingTier(completedCount, assocTasks.length, timeElapsed)

      return {
        associateId: assoc?.id ?? entry.associate_id,
        associateName: name,
        archetype,
        startTime: entry.start_time,
        endTime: entry.end_time,
        onClock,
        completedTasks: completedCount,
        totalTasks: assocTasks.length,
        pacing,
      }
    })

  async function verify(taskId: string) {
    setIsVerifying(taskId)
    await verifyTaskComplete(taskId)
    setPendingTasks((prev) => prev.filter((t) => t.id !== taskId))
    setIsVerifying(null)
  }

  async function reject(taskId: string) {
    setIsVerifying(taskId)
    await rejectTaskCompletion(taskId)
    setPendingTasks((prev) => prev.filter((t) => t.id !== taskId))
    setIsVerifying(null)
  }

  async function clearOrphan(taskId: string) {
    await clearOrphanFlag(taskId)
    setOrphanedTasks(prev => prev.filter(t => t.id !== taskId))
  }

  return {
    pacingData,
    pendingTasks,
    orphanedTasks,
    isLoading,
    isVerifying,
    verify,
    reject,
    clearOrphan,
  }
}
