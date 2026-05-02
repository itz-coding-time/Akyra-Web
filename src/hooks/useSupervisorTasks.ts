import { useEffect, useState, useCallback } from "react"
import {
  fetchTasksForAssociate,
  fetchActiveShiftsForStore,
  markTaskPendingVerification,
  assignTaskToAssociate,
  createJitTask,
} from "../lib"
import type { Database } from "../types/database.types"

type Task = Database["public"]["Tables"]["tasks"]["Row"]
type ActiveShift = Database["public"]["Tables"]["active_shifts"]["Row"]

export function useSupervisorTasks(storeId: string | null | undefined, modName: string) {
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [activeShifts, setActiveShifts] = useState<ActiveShift[]>([])
  const [isCreating, setIsCreating] = useState(false)

  const load = useCallback(async () => {
    if (!storeId) return
    const [tasks, shifts] = await Promise.all([
      fetchTasksForAssociate(storeId, "MOD", modName),
      fetchActiveShiftsForStore(storeId),
    ])
    setAllTasks(tasks)
    setActiveShifts(shifts)
  }, [storeId, modName])

  useEffect(() => {
    load()
  }, [load])

  const modTasks = allTasks.filter(
    t => !t.is_completed && !t.pending_verification
  )

  async function completeModTask(taskId: string) {
    await markTaskPendingVerification(taskId, modName)
    setAllTasks(prev => prev.filter(t => t.id !== taskId))
  }

  async function assignTask(
    taskId: string,
    associateId: string,
    associateName: string
  ): Promise<boolean> {
    const queuePosition = Date.now()
    const success = await assignTaskToAssociate(
      taskId,
      associateId,
      associateName,
      queuePosition
    )
    if (success) {
      setAllTasks(prev =>
        prev.map(t =>
          t.id === taskId
            ? { ...t, assigned_to: associateName, assigned_to_associate_id: associateId, queue_position: queuePosition }
            : t
        )
      )
    }
    return success
  }

  async function createTask(
    taskName: string,
    archetype: string,
    priority: string,
    isCrossShiftCritical: boolean = false
  ): Promise<Task | null> {
    if (!storeId) return null
    setIsCreating(true)
    const newTask = await createJitTask(storeId, taskName, archetype, priority, isCrossShiftCritical)
    if (newTask) {
      setAllTasks(prev => [newTask, ...prev])
    }
    setIsCreating(false)
    return newTask
  }

  return {
    modTasks,
    allTasks,
    activeShifts,
    isCreating,
    completeModTask,
    assignTask,
    createTask,
  }
}
