import { useState } from "react"
import { X } from "lucide-react"
import { resolveAssistanceRequest } from "../../lib"
import { LoadingSpinner } from "../LoadingSpinner"

interface DangerClearModalProps {
  requestId: string
  associateId: string
  onResolved: () => void
  onDismiss: () => void
}

export function DangerClearModal({
  requestId,
  associateId,
  onResolved,
  onDismiss,
}: DangerClearModalProps) {
  const [code, setCode] = useState("")
  const [isResolving, setIsResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!code.trim()) return
    setIsResolving(true)
    setError(null)

    const result = await resolveAssistanceRequest(requestId, associateId, code.trim().toUpperCase())

    setIsResolving(false)
    if (result.success) {
      onResolved()
    } else {
      setError("Invalid code. Get the code from your supervisor.")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onDismiss} />
      <div className="relative w-full max-w-lg bg-akyra-surface border-t border-[#E63946]/50 rounded-t-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <p className="font-bold text-white">Clear Danger Alert</p>
          <button onClick={onDismiss} className="text-akyra-secondary hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-white/60">
          Your supervisor needs to physically come to you and give you their code.
        </p>

        <input
          type="text"
          placeholder="Enter supervisor code"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          className="w-full bg-akyra-black border border-akyra-border rounded-xl px-4 py-3 text-white font-mono text-xl text-center tracking-[0.4em] focus:outline-none focus:border-white uppercase"
          maxLength={6}
          autoFocus
        />

        {error && <p className="text-[#E63946] text-sm font-mono text-center">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!code.trim() || isResolving}
          className="w-full py-3 rounded-xl bg-white text-black font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isResolving ? <><LoadingSpinner size="sm" /> Verifying...</> : "Clear Alert"}
        </button>
      </div>
    </div>
  )
}
