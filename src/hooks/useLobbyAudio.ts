import { useEffect, useRef, useCallback } from "react"
import { audioEngine } from "../lib/audioEngine"

interface UseLobbyAudioOptions {
  squadCount: number
  secondsLeft: number
  onLaunchComplete?: () => void
}

export function useLobbyAudio({
  squadCount,
  secondsLeft,
  onLaunchComplete,
}: UseLobbyAudioOptions) {
  const startedRef = useRef(false)
  const swellTriggeredRef = useRef(false)
  const onLaunchCompleteRef = useRef(onLaunchComplete)

  // Keep callback ref current
  useEffect(() => {
    onLaunchCompleteRef.current = onLaunchComplete
  })

  // Start ambient on mount (after first interaction)
  const startAmbient = useCallback(() => {
    if (startedRef.current) return
    startedRef.current = true
    audioEngine.unlock()
    audioEngine.startAmbient(squadCount)
  }, [squadCount])

  // Update squad count when it changes
  useEffect(() => {
    if (!startedRef.current) return
    audioEngine.updateSquad(squadCount)
  }, [squadCount])

  // Trigger swell at T-60
  useEffect(() => {
    if (!startedRef.current) return
    if (secondsLeft <= 60 && secondsLeft > 0 && !swellTriggeredRef.current) {
      swellTriggeredRef.current = true
      audioEngine.triggerSwell60()
    }
  }, [secondsLeft])

  // Launch function — call on READY UP
  const launch = useCallback(() => {
    audioEngine.launch(() => {
      onLaunchCompleteRef.current?.()
    })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioEngine.fadeOut()
    }
  }, [])

  return { startAmbient, launch }
}
