import { useState, useEffect } from "react"
import { canTakeBreak, startBreak } from "../lib"
import { LoadingSpinner } from "./LoadingSpinner"
import { Coffee, X } from "lucide-react"

interface TakeBreakModalProps {
  associateId: string
  storeId: string
  roleRank: number
  onBreakStarted: (breakStartedAt: string) => void
  onDismiss: () => void
}

export function TakeBreakModal({
  associateId,
  storeId,
  roleRank,
  onBreakStarted,
  onDismiss,
}: TakeBreakModalProps) {
  const [isChecking, setIsChecking] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [checkResult, setCheckResult] = useState<{
    allowed: boolean
    coveringName?: string
    reason?: string
  } | null>(null)

  async function handleCheck() {
    setIsChecking(true)
    const result = await canTakeBreak(associateId, storeId, roleRank)
    setCheckResult(result)
    setIsChecking(false)
  }

  async function handleStartBreak() {
    setIsStarting(true)
    const success = await startBreak(associateId, storeId)
    if (success) {
      onBreakStarted(new Date().toISOString())
    }
    setIsStarting(false)
  }

  // Auto-check on mount
  useEffect(() => {
    handleCheck()
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onDismiss} />
      <div className="relative w-full max-w-lg bg-akyra-surface border-t border-akyra-border rounded-t-2xl p-6 space-y-5">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coffee className="w-5 h-5 text-akyra-secondary" />
            <p className="font-bold text-white">Take a Break</p>
          </div>
          <button onClick={onDismiss} className="text-akyra-secondary hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isChecking ? (
          <div className="flex items-center justify-center py-6">
            <LoadingSpinner size="md" />
          </div>
        ) : checkResult ? (
          <>
            {checkResult.allowed ? (
              <div className="space-y-4">
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-1">
                  <p className="text-sm text-white">30-minute break</p>
                  <p className="text-xs text-akyra-secondary">
                    Your tasks will be paused and waiting when you return.
                  </p>
                  {checkResult.coveringName && (
                    <p className="text-xs text-white/40 font-mono mt-2">
                      {checkResult.coveringName} is covering the floor.
                    </p>
                  )}
                </div>

                <button
                  onClick={handleStartBreak}
                  disabled={isStarting}
                  className="w-full py-4 rounded-xl bg-white text-black font-bold flex items-center justify-center gap-2"
                >
                  {isStarting
                    ? <><LoadingSpinner size="sm" /> Starting break...</>
                    : <><Coffee className="w-4 h-4" /> Start Break</>
                  }
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-[#E63946]/[0.05] border border-[#E63946]/20 rounded-xl p-4">
                  <p className="text-sm text-white/80">{checkResult.reason}</p>
                </div>

                <button
                  onClick={onDismiss}
                  className="w-full py-3 rounded-xl border border-akyra-border text-akyra-secondary"
                >
                  Got it
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
