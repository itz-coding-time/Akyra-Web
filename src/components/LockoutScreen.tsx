import { useState } from "react"
import { overrideLockout } from "../lib"
import { Shield } from "lucide-react"

interface LockoutScreenProps {
  storeId: string
  shiftBucket: string
  lockoutEndsAt: string // "14:00"
  isSupervisor: boolean
  supervisorAssociateId?: string
  onOverride: () => void
}

export function LockoutScreen({
  storeId,
  shiftBucket,
  lockoutEndsAt,
  isSupervisor,
  supervisorAssociateId,
  onOverride,
}: LockoutScreenProps) {
  const [isOverriding, setIsOverriding] = useState(false)

  async function handleOverride() {
    if (!supervisorAssociateId) return
    setIsOverriding(true)
    await overrideLockout(storeId, shiftBucket)
    setIsOverriding(false)
    onOverride()
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center space-y-6">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[#E63946]/[0.02]" />
      </div>

      <div className="relative z-10 space-y-6">
        <div className="w-16 h-16 rounded-full bg-[#E63946]/10 border border-[#E63946]/20 flex items-center justify-center mx-auto">
          <Shield className="w-7 h-7 text-[#E63946]/60" />
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-[#E63946]/40">
            Task Lockout
          </p>
          <p className="text-2xl font-black text-white">
            Hands on deck.
          </p>
          <p className="text-sm text-white/40 max-w-xs mx-auto">
            Task queue is locked during peak hours. Focus on the floor.
          </p>
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4">
          <p className="text-[10px] font-mono text-white/20 uppercase tracking-widest mb-1">
            Lockout ends
          </p>
          <p className="text-3xl font-black font-mono text-white">
            {lockoutEndsAt}
          </p>
        </div>

        {isSupervisor && (
          <button
            onClick={handleOverride}
            disabled={isOverriding}
            className="text-xs font-mono text-white/20 hover:text-white/40 transition-colors"
          >
            {isOverriding ? "Overriding..." : "Override lockout (supervisor)"}
          </button>
        )}
      </div>
    </div>
  )
}
