import { useState } from "react"
import { extendShift, closeShiftEarly } from "../lib"
import { LoadingSpinner } from "./LoadingSpinner"

interface ShiftExtensionModalProps {
  associateId: string
  storeId: string
  minutesOverdue: number
  onExtended: () => void
  onLeaving: () => void  // triggers Extraction
  onLeft: () => void     // closes session silently
}

export function ShiftExtensionModal({
  associateId,
  storeId,
  minutesOverdue,
  onExtended,
  onLeaving,
  onLeft,
}: ShiftExtensionModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showExtensionOptions, setShowExtensionOptions] = useState(false)

  async function handleExtend(minutes: number) {
    setIsLoading(true)
    await extendShift(associateId, storeId, minutes, "extending")
    setIsLoading(false)
    onExtended()
  }

  async function handleLeavingSoon() {
    setIsLoading(true)
    await extendShift(associateId, storeId, 15, "leaving_soon")
    setIsLoading(false)
    onLeaving()
  }

  async function handleAlreadyLeft() {
    setIsLoading(true)
    await closeShiftEarly(associateId, storeId)
    setIsLoading(false)
    onLeft()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/80" />
      <div className="relative w-full max-w-lg bg-akyra-surface border-t border-akyra-border rounded-t-2xl p-6 space-y-5">

        <div className="text-center space-y-1">
          <p className="font-black text-white text-lg">Your shift ended {minutesOverdue} min ago.</p>
          <p className="text-sm text-akyra-secondary">Are you staying?</p>
        </div>

        {!showExtensionOptions ? (
          <div className="space-y-3">
            <button
              onClick={() => setShowExtensionOptions(true)}
              disabled={isLoading}
              className="w-full py-4 rounded-xl bg-white text-black font-bold text-sm"
            >
              Extending — I'll be here a bit longer
            </button>
            <button
              onClick={handleLeavingSoon}
              disabled={isLoading}
              className="w-full py-4 rounded-xl border border-akyra-border text-white font-semibold text-sm"
            >
              Leaving soon — wrapping up
            </button>
            <button
              onClick={handleAlreadyLeft}
              disabled={isLoading}
              className="w-full py-3 text-akyra-secondary text-sm font-mono"
            >
              I already left — close my session
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-mono text-akyra-secondary text-center">How long are you staying?</p>
            {[30, 60, 120].map(minutes => (
              <button
                key={minutes}
                onClick={() => handleExtend(minutes)}
                disabled={isLoading}
                className="w-full py-3 rounded-xl border border-akyra-border text-white font-semibold text-sm flex items-center justify-center gap-2"
              >
                {isLoading ? <LoadingSpinner size="sm" /> : `+${minutes >= 60 ? `${minutes / 60}hr` : `${minutes}min`}`}
              </button>
            ))}
            <button
              onClick={() => setShowExtensionOptions(false)}
              className="w-full text-xs font-mono text-akyra-secondary"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
