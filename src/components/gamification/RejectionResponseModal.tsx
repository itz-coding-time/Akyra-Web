import { useState } from "react"
import { X } from "lucide-react"
import { LoadingSpinner } from "../LoadingSpinner"

interface RejectionResponseModalProps {
  taskName: string
  rejectionReason: string
  associatePhotoUrl: string | null
  supervisorPhotoUrl: string | null
  verificationId: string
  onVerifyRetry: () => Promise<void>
  onChallenge: () => Promise<void>
  onDismiss: () => void
}

export function RejectionResponseModal({
  taskName,
  rejectionReason,
  associatePhotoUrl,
  supervisorPhotoUrl,
  // verificationId consumed by parent callbacks — not used directly
  onVerifyRetry,
  onChallenge,
  onDismiss,
}: RejectionResponseModalProps) {
  const [showChallenge, setShowChallenge] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  async function handleVerifyRetry() {
    setIsLoading(true)
    await onVerifyRetry()
    setIsLoading(false)
    onDismiss()
  }

  async function handleChallenge() {
    setIsLoading(true)
    await onChallenge()
    setIsLoading(false)
    onDismiss()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onDismiss} />
      <div className="relative w-full max-w-lg bg-akyra-surface border-t border-[#E63946]/40 rounded-t-2xl p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="font-bold text-white">Task Pending</p>
          <button onClick={onDismiss} className="text-akyra-secondary hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-[#E63946]/10 border border-[#E63946]/30 rounded-xl p-4 space-y-1">
          <p className="text-xs font-mono uppercase tracking-widest text-[#E63946]">
            SOP was not met
          </p>
          <p className="text-sm text-white font-semibold">{taskName}</p>
        </div>

        {!showChallenge ? (
          <div className="flex gap-3">
            <button
              onClick={handleVerifyRetry}
              disabled={isLoading}
              className="flex-1 py-3 rounded-xl border border-akyra-border text-white font-semibold hover:border-white/40 transition-colors disabled:opacity-50"
            >
              {isLoading ? <LoadingSpinner size="sm" /> : "Verify & Retry"}
            </button>
            <button
              onClick={() => setShowChallenge(true)}
              className="flex-1 py-3 rounded-xl border border-[#E63946]/40 text-[#E63946] font-semibold hover:bg-[#E63946]/10 transition-colors"
            >
              Challenge
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-white/60">
              This will send a ticket to your Store Manager for review.
            </p>

            {/* Side by side photos */}
            <div className="grid grid-cols-2 gap-2">
              {associatePhotoUrl && (
                <div>
                  <p className="text-[10px] font-mono text-akyra-secondary mb-1">Your photo</p>
                  <img src={associatePhotoUrl} alt="Associate" className="w-full rounded-lg border border-akyra-border" />
                </div>
              )}
              {supervisorPhotoUrl && (
                <div>
                  <p className="text-[10px] font-mono text-akyra-secondary mb-1">Supervisor photo</p>
                  <img src={supervisorPhotoUrl} alt="Supervisor" className="w-full rounded-lg border border-akyra-border" />
                </div>
              )}
            </div>

            <p className="text-xs text-akyra-secondary">
              Supervisor note: <span className="text-white">{rejectionReason}</span>
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowChallenge(false)}
                className="flex-1 py-2.5 rounded-xl border border-akyra-border text-akyra-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleChallenge}
                disabled={isLoading}
                className="flex-1 py-2.5 rounded-xl bg-white text-black font-bold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <><LoadingSpinner size="sm" /> Sending...</> : "Yes, Challenge"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
