import { useState } from "react"
import { Flame, X } from "lucide-react"
import { LoadingSpinner } from "../LoadingSpinner"

interface BurnCardModalProps {
  taskName: string
  burnCards: number
  squadCards: number
  totalCards: number
  onConfirm: () => Promise<void>
  onDismiss: () => void
}

export function BurnCardModal({
  taskName,
  burnCards,
  squadCards,
  totalCards,
  onConfirm,
  onDismiss,
}: BurnCardModalProps) {
  const [isBurning, setIsBurning] = useState(false)
  const [burned, setBurned] = useState(false)

  async function handleBurn() {
    setIsBurning(true)
    await onConfirm()
    setIsBurning(false)
    setBurned(true)
    setTimeout(onDismiss, 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onDismiss} />
      <div className="relative w-full max-w-lg bg-akyra-surface border-t border-[#E63946]/40 rounded-t-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#E63946]" />
            <p className="font-bold text-white">Use a Burn Card?</p>
          </div>
          <button onClick={onDismiss} className="text-akyra-secondary hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-[#E63946]/10 border border-[#E63946]/20 rounded-xl p-4 space-y-1">
          <p className="text-sm text-white">{taskName}</p>
          <p className="text-xs text-akyra-secondary">
            This task will be assigned to your supervisor.
          </p>
        </div>

        {!burned ? (
          <>
            <div className="space-y-1 text-center">
              <p className="text-xs text-akyra-secondary text-center">
                You have {totalCards} card{totalCards !== 1 ? "s" : ""} to spend.
              </p>
              {(burnCards > 0 || squadCards > 0) && (
                <p className="text-[10px] font-mono text-akyra-secondary">
                  🔥 {burnCards} Burn · 🤝 {squadCards} Squad
                </p>
              )}
              <p className="text-[10px] font-mono text-white/30">
                Afterwards you will have {totalCards - 1}.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onDismiss}
                className="flex-1 py-3 rounded-xl border border-akyra-border text-akyra-secondary font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleBurn}
                disabled={isBurning}
                className="flex-1 py-3 rounded-xl bg-[#E63946] text-white font-bold flex items-center justify-center gap-2"
              >
                {isBurning ? (
                  <><LoadingSpinner size="sm" /> Burning...</>
                ) : (
                  <><Flame className="w-4 h-4" /> Burn It</>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-2">
            <p className="text-white font-semibold">🔥 Burned. Task assigned to your MOD.</p>
          </div>
        )}
      </div>
    </div>
  )
}
