import { useState, useEffect } from "react"
import {
  claimStation,
  updateActiveShiftStation,
  expireActiveShift,
} from "../lib"
import { supabase } from "../lib/supabase"
import type { Associate } from "../types"

// Station persists for the session only — cleared on sign out
const SESSION_STATION_KEY = "akyra_station"
const SESSION_FLOAT_MODE_KEY = "akyra_float_mode"

export type FloatMode = "kitchen" | "pos" | "both" | null

export function useStation(associate: Associate | null) {
  const [station, setStation] = useState<string | null>(() => {
    return sessionStorage.getItem(SESSION_STATION_KEY)
  })

  const [floatMode, setFloatMode] = useState<FloatMode>(() => {
    return sessionStorage.getItem(SESSION_FLOAT_MODE_KEY) as FloatMode
  })

  const [isClaiming, setIsClaiming] = useState(false)

  // Clear session storage on unmount if needed
  useEffect(() => {
    return () => {
      // Don't clear on unmount — persists for session
    }
  }, [])

  // Realtime: watch for supervisor reassignment
  useEffect(() => {
    if (!associate?.id) return

    const channel = supabase
      .channel(`associate-station-${associate.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "associates",
          filter: `id=eq.${associate.id}`,
        },
        (payload) => {
          const newArchetype = payload.new.current_archetype
          const currentStation = sessionStorage.getItem(SESSION_STATION_KEY)

          // If supervisor changed their station, update local state
          if (newArchetype !== currentStation) {
            console.log(`Station reassigned by supervisor: ${currentStation} → ${newArchetype}`)
            setStation(newArchetype)
            sessionStorage.setItem(SESSION_STATION_KEY, newArchetype)
            // Clear float mode on reassignment
            setFloatMode(null)
            sessionStorage.removeItem(SESSION_FLOAT_MODE_KEY)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [associate?.id])

  async function claim(archetype: string): Promise<boolean> {
    if (!associate) return false
    setIsClaiming(true)

    // Update current_archetype and manage active_shifts (Ghost Protocol)
    const success = await claimStation(associate.id, associate.store_id, archetype)

    if (success) {
      setStation(archetype)
      sessionStorage.setItem(SESSION_STATION_KEY, archetype)
      if (archetype !== "Float") {
        setFloatMode(null)
        sessionStorage.removeItem(SESSION_FLOAT_MODE_KEY)
      }
    }

    setIsClaiming(false)
    return success
  }

  async function setFloat(mode: FloatMode, associateId?: string) {
    setFloatMode(mode)
    if (mode) {
      sessionStorage.setItem(SESSION_FLOAT_MODE_KEY, mode)
      // Update active shift station to reflect float mode
      if (associateId) {
        const floatStation = mode === "pos" ? "POS" : "Kitchen"
        await updateActiveShiftStation(associateId, `Float-${floatStation}`)
      }
    } else {
      sessionStorage.removeItem(SESSION_FLOAT_MODE_KEY)
    }
  }

  function clearStation() {
    setStation(null)
    setFloatMode(null)
    sessionStorage.removeItem(SESSION_STATION_KEY)
    sessionStorage.removeItem(SESSION_FLOAT_MODE_KEY)
  }

  async function clearShift(associateId: string) {
    clearStation()
    await expireActiveShift(associateId)
  }

  return { station, floatMode, isClaiming, claim, setFloat, clearStation, clearShift }
}
