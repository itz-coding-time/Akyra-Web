import { useState } from "react"
import { initiateEarlyDeparture } from "../lib"
import { LoadingSpinner } from "./LoadingSpinner"

interface EarlyDepartureModalProps {
  associateId: string
  storeId: string
  onDeparted: () => void
  onDismiss: () => void
}

const REASONS = [
  "Feeling unwell",
  "Family emergency",
  "Transportation issue",
  "Scheduled appointment",
  "Other",
]

export function EarlyDepartureModal({
  associateId,
  storeId,
  onDeparted,
  onDismiss,
}: EarlyDepartureModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleDepart() {
    if (!selectedReason) return
    setIsLoading(true)
    await initiateEarlyDeparture(associateId, storeId, selectedReason)
    setIsLoading(false)
    onDeparted()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onDismiss} />
      <div className="relative w-full max-w-lg bg-akyra-surface border-t border-akyra-border rounded-t-2xl p-6 space-y-5">

        <div className="space-y-1">
          <p className="font-bold text-white">Early Departure</p>
          <p className="text-sm text-akyra-secondary">
            Your tasks will be handed back to the queue. Your supervisor will be notified.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-mono text-akyra-secondary uppercase tracking-widest">Reason</p>
          {REASONS.map(reason => (
            <button
              key={reason}
              onClick={() => setSelectedReason(reason)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                selectedReason === reason
                  ? "border-white bg-white/10 text-white"
                  : "border-akyra-border text-akyra-secondary hover:text-white"
              }`}
            >
              {reason}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            className="flex-1 py-3 rounded-xl border border-akyra-border text-akyra-secondary text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleDepart}
            disabled={!selectedReason || isLoading}
            className="flex-1 py-3 rounded-xl bg-[#E63946] text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <><LoadingSpinner size="sm" /> Departing...</> : "Confirm Departure"}
          </button>
        </div>
      </div>
    </div>
  )
}
