import { useEffect, useState, useCallback } from "react"
import {
  fetchTasksForAssociate,
  markTaskPendingVerification,
  fetchTableItemsByStation,
  flagTableItem,
  fetchInventoryByCategory,
  updateInventoryAmountHave,
  hasExpiringPullEvents,
} from "../lib"
import type { Database } from "../types/database.types"

type Task = Database["public"]["Tables"]["tasks"]["Row"]
type TableItem = Database["public"]["Tables"]["table_items"]["Row"]
type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"]

const PRIORITY_ORDER: Record<string, number> = {
  Critical: 4,
  High: 3,
  Normal: 2,
  Low: 1,
}

export function useAssociateTasks(
  storeId: string,
  archetype: string,
  associateName: string
) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [tableItems, setTableItems] = useState<TableItem[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  const fetchAll = useCallback(async () => {
    setIsLoading(true)

    const taskData = await fetchTasksForAssociate(storeId, archetype, associateName)
    const tableData = await fetchTableItemsByStation(storeId, archetype)

    // Kitchen sees both Prep AND Bread pull lists
    let inventoryData: InventoryItem[] = []
    if (archetype === "Kitchen" || archetype === "Float") {
      const [prepData, breadData] = await Promise.all([
        fetchInventoryByCategory(storeId, "Prep"),
        fetchInventoryByCategory(storeId, "Bread"),
      ])
      inventoryData = [...prepData, ...breadData]
    }

    const sorted = [...taskData].sort((a, b) => {
      const aAssigned = a.assigned_to === associateName ? 1 : 0
      const bAssigned = b.assigned_to === associateName ? 1 : 0
      if (aAssigned !== bAssigned) return bAssigned - aAssigned
      return (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0)
    })

    // Add synthetic Code Check task to the top of the list if needed
    const hasCodeCheck = await hasExpiringPullEvents(storeId)
    if (hasCodeCheck) {
      const codeCheckTask = {
        id: "code-check-synthetic",
        store_id: storeId,
        task_name: "Code Check",
        archetype: archetype,
        priority: "Critical",
        is_sticky: true,
        is_completed: false,
        is_orphaned: false,
        pending_verification: false,
        completed_by: null,
        assigned_to: null,
        task_description: "Expiring items need verification. Tap to review.",
        expected_minutes: 15,
        base_points: 10,
        is_pull_task: false,
        is_truck_task: false,
        depends_on_task_id: null,
        created_at: new Date().toISOString(),
      } as any

      sorted.unshift(codeCheckTask)
    }

    setTasks(sorted)
    setTableItems(tableData)
    setInventoryItems(inventoryData)
    setIsLoading(false)
  }, [storeId, archetype, associateName])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  async function completeTask(taskId: string) {
    // Optimistic: hide immediately
    setPendingIds((prev) => new Set(prev).add(taskId))
    const success = await markTaskPendingVerification(taskId, associateName)
    if (!success) {
      // Revert on failure
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }
  }

  async function toggleTableItem(itemId: string, current: boolean) {
    setTableItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, is_initialed: !current } : i))
    )
    await flagTableItem(itemId, !current)
  }

  async function updateAmountHave(itemId: string, amount: number) {
    setInventoryItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, amount_have: amount } : i))
    )
    await updateInventoryAmountHave(itemId, amount)
  }

  // Tasks filtered to not show pending ones (they're "done" from associate POV)
  const visibleTasks = tasks.filter((t) => !pendingIds.has(t.id))
  const myTasks = visibleTasks.filter((t) => t.assigned_to === associateName)
  const archetypeTasks = visibleTasks.filter((t) => t.assigned_to !== associateName)

  return {
    myTasks,
    archetypeTasks,
    tableItems,
    inventoryItems,
    isLoading,
    completeTask,
    toggleTableItem,
    updateAmountHave,
    refetch: fetchAll,
  }
}
