import { useEffect, useState, useCallback } from "react"
import { supabase } from "../lib/supabase"
import {
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
  const [isReassigning, setIsReassigning] = useState<string | null>(null)

  const loadAssociates = useCallback(async () => {
    if (!storeId) return

    // Step 1: Expire stale sessions
    const expiredCount = await expireStaleShifts(storeId)

    // Step 2: Orphan tasks for expired sessions
    if (expiredCount > 0) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { data: expiredShifts } = await supabase
        .from("active_shifts")
        .select("associate_id")
        .eq("store_id", storeId)
        .eq("is_active", false)
        .gte("expires_at", oneHourAgo)

      if (expiredShifts && expiredShifts.length > 0) {
        await orphanTasksForExpiredSessions(
          storeId,
          expiredShifts.map(s => s.associate_id)
        )
      }
    }

    // Step 3: Load ONLY active shifts — these are people on the floor right now
    const activeShifts = await fetchActiveShiftsForStore(storeId)

    // Map active shifts to Associate shape for the board
    const activeAssociates: Associate[] = activeShifts.map(shift => {
      const assoc = (shift as any).associates
      return {
        id: assoc?.id ?? shift.associate_id,
        store_id: storeId,
        name: assoc?.name ?? "Unknown",
        role: assoc?.role ?? "crew",
        current_archetype: shift.station ?? assoc?.current_archetype ?? "Float",
        pin_code: null,
        scheduled_days: "",
        default_start_time: "",
        default_end_time: "",
        created_at: shift.created_at,
        profile_id: null,
        role_rank: assoc?.role_rank ?? 1,
        hasActiveShift: true,
      } as any
    })

    setAssociates(activeAssociates)
    setIsLoading(false)
  }, [storeId])

  useEffect(() => {
    loadAssociates()
  }, [loadAssociates])

  // Realtime subscription
  useEffect(() => {
    if (!storeId) return

    const channel = supabase
      .channel(`station-board-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "active_shifts",
          filter: `store_id=eq.${storeId}`,
        },
        () => loadAssociates()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "associates",
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          setAssociates(prev =>
            prev.map(a =>
              a.id === payload.new.id
                ? { ...a, current_archetype: payload.new.current_archetype }
                : a
            )
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [storeId, loadAssociates])

  async function reassign(associateId: string, newArchetype: string): Promise<void> {
    setIsReassigning(associateId)

    // Optimistic update
    setAssociates(prev =>
      prev.map(a =>
        a.id === associateId ? { ...a, current_archetype: newArchetype } : a
      )
    )

    const success = await claimStation(associateId, storeId!, newArchetype)
    if (!success) {
      await loadAssociates()
    }

    setIsReassigning(null)
  }

  // Group by station in display order
  const grouped: StationGroup[] = STATION_ORDER
    .map(archetype => ({
      archetype,
      associates: associates.filter(a => a.current_archetype === archetype),
    }))
    .filter(g => g.associates.length > 0)

  // Any archetypes not in the standard order
  const otherArchetypes = [
    ...new Set(
      associates
        .map(a => a.current_archetype)
        .filter(arch => !STATION_ORDER.includes(arch))
    ),
  ]
  otherArchetypes.forEach(archetype => {
    grouped.push({
      archetype,
      associates: associates.filter(a => a.current_archetype === archetype),
    })
  })

  // Unclaimed = no archetype set
  const unclaimed = associates.filter(
    a => !a.current_archetype || a.current_archetype === ""
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
