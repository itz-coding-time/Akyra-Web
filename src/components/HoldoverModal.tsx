import { useState } from "react"
import { initiateHoldover } from "../lib"
import { LoadingSpinner } from "./LoadingSpinner"

interface HoldoverModalProps {
  associateId: string
  storeId: string
  shiftBucket: "6a-2p" | "2p-10p" | "10p-6a"
  onHoldoverStarted: (holdoverId: string) => void
  onDecline: () => void
}

export function HoldoverModal({
  associateId,
  storeId,
  shiftBucket,
  onHoldoverStarted,
  onDecline,
}: HoldoverModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleAccept() {
    setIsLoading(true)
    const holdoverId = await initiateHoldover(associateId, storeId, shiftBucket)
    setIsLoading(false)
    if (holdoverId) onHoldoverStarted(holdoverId.toString())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/80" />
      <div className="relative w-full max-w-lg bg-akyra-surface border-t border-[#E63946]/30 rounded-t-2xl p-6 space-y-5">

        <div className="text-center space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[#E63946]/60">
            Holdover Protocol
          </p>
          <p className="font-black text-white text-lg">Nobody showed for next shift.</p>
          <p className="text-sm text-akyra-secondary">
            Can you hold until relief arrives? Your supervisor has been notified.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleAccept}
            disabled={isLoading}
            className="w-full py-4 rounded-xl bg-white text-black font-bold flex items-center justify-center gap-2"
          >
            {isLoading ? <><LoadingSpinner size="sm" /> Starting holdover...</> : "I'll hold. Let's go."}
          </button>
          <button
            onClick={onDecline}
            disabled={isLoading}
            className="w-full py-3 text-akyra-secondary text-sm font-mono"
          >
            I can't stay — someone else needs to handle this
          </button>
        </div>

        <p className="text-[9px] font-mono text-white/20 text-center">
          Your shift will be extended by 2 hours automatically.
          Escalates to district management if unresolved in 30 minutes.
        </p>
      </div>
    </div>
  )
}
