import { useEffect, useState, useCallback } from "react"
import {
  fetchExpiringPullEvents,
  verifyPullEventsUsedThrough,
  recordPullWaste,
  hasExpiringPullEvents,
} from "../lib"
import type { PullEventSummary } from "../types"

export function useCodeCheck(storeId: string | null | undefined) {
  const [expiringItems, setExpiringItems] = useState<PullEventSummary[]>([])
  const [hasExpiring, setHasExpiring] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isActioning, setIsActioning] = useState<string | null>(null)

  const loadExpiring = useCallback(async () => {
    if (!storeId) return
    setIsLoading(true)

    const [items, has] = await Promise.all([
      fetchExpiringPullEvents(storeId),
      hasExpiringPullEvents(storeId),
    ])

    setExpiringItems(items)
    setHasExpiring(has)
    setIsLoading(false)
  }, [storeId])

  useEffect(() => {
    loadExpiring()
  }, [loadExpiring])

  async function verifyUsedThrough(summary: PullEventSummary) {
    setIsActioning(summary.itemId)
    const success = await verifyPullEventsUsedThrough(summary.pullEventIds)
    if (success) {
      setExpiringItems(prev => prev.filter(i => i.itemId !== summary.itemId))
      setHasExpiring(expiringItems.length > 1)
    }
    setIsActioning(null)
  }

  async function submitWaste(
    summary: PullEventSummary,
    wasteQuantity: number
  ) {
    if (!storeId) return
    setIsActioning(summary.itemId)
    const success = await recordPullWaste(
      storeId,
      summary.pullEventIds,
      summary.itemName,
      wasteQuantity
    )
    if (success) {
      setExpiringItems(prev => prev.filter(i => i.itemId !== summary.itemId))
      setHasExpiring(expiringItems.length > 1)
    }
    setIsActioning(null)
  }

  return {
    expiringItems,
    hasExpiring,
    isLoading,
    isActioning,
    verifyUsedThrough,
    submitWaste,
    refetch: loadExpiring,
  }
}
