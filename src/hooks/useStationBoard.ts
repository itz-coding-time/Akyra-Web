import { useEffect, useState, useCallback } from "react"
import { supabase } from "../lib/supabase"
import {
  fetchAssociatesByStore,
  fetchActiveShiftsForStore,
  expireStaleShifts,
  claimStation,
  orphanTasksForExpiredSessions,
} from "../lib"
import type { Associate } from "../types"

export interface StationGroup {
  archetype: string
  associates: Associate[]
}

const STATION_ORDER = ["MOD", "Kitchen", "POS", "Float"]

export function useStationBoard(storeId: string | null | undefined) {
  const [associates, setAssociates] = useState<Associate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isReassigning, setIsReassigning] = useState<string | null>(null) // associateId being reassigned

  const loadAssociates = useCallback(async () => {
    if (!storeId) return

    // Step 1: Expire stale sessions and get expired associate IDs
    const expiredCount = await expireStaleShifts(storeId)

    // Step 2: If any expired, get their IDs for orphan recovery
    if (expiredCount > 0) {
      // Fetch recently-expired shifts (is_active = false, expired in last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { data: expiredShifts } = await supabase
        .from("active_shifts")
        .select("associate_id")
        .eq("store_id", storeId)
        .eq("is_active", false)
        .gte("expires_at", oneHourAgo)

      if (expiredShifts && expiredShifts.length > 0) {
        const expiredIds = expiredShifts.map(s => s.associate_id)
        await orphanTasksForExpiredSessions(storeId, expiredIds)
      }
    }

    // Step 3: Load fresh associate and shift data
    const data = await fetchAssociatesByStore(storeId)
    const activeShifts = await fetchActiveShiftsForStore(storeId)
    const activeAssociateIds = new Set(activeShifts.map(s => s.associate_id))

    setAssociates(data.map(a => ({
      ...a,
      hasActiveShift: activeAssociateIds.has(a.id),
    })))

    setIsLoading(false)
  }, [storeId])

  useEffect(() => {
    loadAssociates()
  }, [loadAssociates])

  // Supabase Realtime subscription — updates station board live
  useEffect(() => {
    if (!storeId) return

    const channel = supabase
      .channel(`station-board-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "associates",
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          setAssociates((prev) =>
            prev.map((a) =>
              a.id === payload.new.id
                ? { ...a, current_archetype: payload.new.current_archetype as string }
                : a
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [storeId])

  async function reassign(associateId: string, newArchetype: string): Promise<void> {
    setIsReassigning(associateId)

    // Optimistic update
    setAssociates((prev) =>
      prev.map((a) =>
        a.id === associateId ? { ...a, current_archetype: newArchetype } : a
      )
    )

    const success = await claimStation(associateId, newArchetype)
    if (!success) {
      // Revert on failure
      await loadAssociates()
    }

    setIsReassigning(null)
  }

  // Group associates by archetype in display order
  const grouped: StationGroup[] = STATION_ORDER.map((archetype) => ({
    archetype,
    associates: associates.filter((a) => a.current_archetype === archetype),
  })).filter((g) => g.associates.length > 0)

  // Also include any archetypes not in STATION_ORDER
  const otherArchetypes = [
    ...new Set(
      associates
        .map((a) => a.current_archetype)
        .filter((arch) => !STATION_ORDER.includes(arch))
    ),
  ]
  otherArchetypes.forEach((archetype) => {
    grouped.push({
      archetype,
      associates: associates.filter((a) => a.current_archetype === archetype),
    })
  })

  const unclaimed = associates.filter(
    (a) => !a.current_archetype || a.current_archetype === ""
  )

  return {
    grouped,
    unclaimed,
    associates,
    isLoading,
    isReassigning,
    reassign,
  }
}
