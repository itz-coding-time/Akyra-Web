import { useEffect, useState, useCallback } from "react"
import { supabase } from "../lib/supabase"
import { claimStation, fetchAssociatesByStore } from "../lib"
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
    const data = await fetchAssociatesByStore(storeId)
    setAssociates(data)
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
