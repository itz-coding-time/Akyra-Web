import { useState, useEffect } from "react"
import {
  claimStation,
  createActiveShift,
  updateActiveShiftStation,
  expireActiveShift,
} from "../lib"
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

  async function claim(archetype: string): Promise<boolean> {
    if (!associate) return false
    setIsClaiming(true)

    // Create active shift row (Ghost Protocol)
    const activeShift = await createActiveShift(associate.id, associate.store_id, archetype)

    // Also update current_archetype on associate row
    const success = await claimStation(associate.id, archetype)

    if (success && activeShift) {
      setStation(archetype)
      sessionStorage.setItem(SESSION_STATION_KEY, archetype)
      if (archetype !== "Float") {
        setFloatMode(null)
        sessionStorage.removeItem(SESSION_FLOAT_MODE_KEY)
      }
    }

    setIsClaiming(false)
    return success && !!activeShift
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
