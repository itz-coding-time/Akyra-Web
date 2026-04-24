import { useState, useEffect } from "react"
import { claimStation } from "../lib"
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

    const success = await claimStation(associate.id, archetype)
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

  function setFloat(mode: FloatMode) {
    setFloatMode(mode)
    if (mode) {
      sessionStorage.setItem(SESSION_FLOAT_MODE_KEY, mode)
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

  return { station, floatMode, isClaiming, claim, setFloat, clearStation }
}
