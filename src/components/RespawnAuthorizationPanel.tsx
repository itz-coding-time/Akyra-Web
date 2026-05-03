import { useState } from "react"
import { Shield, X } from "lucide-react"
import { lookupRespawnPin, authorizeRespawn } from "../lib"
import { LoadingSpinner } from "./LoadingSpinner"

interface RespawnAuthorizationPanelProps {
  supervisorAssociateId: string
  onDismiss: () => void
}

type AuthPhase = "enter-pin" | "confirm-identity" | "signing" | "done" | "error"

export function RespawnAuthorizationPanel({
  supervisorAssociateId,
  onDismiss,
}: RespawnAuthorizationPanelProps) {
  const [phase, setPhase] = useState<AuthPhase>("enter-pin")
  const [pin, setPin] = useState("")
  const [associateInfo, setAssociateInfo] = useState<{
    name: string
    eeid: string
    role: string
    channel: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePinLookup() {
    if (pin.length !== 6) return
    setIsLoading(true)
    setError(null)

    const result = await lookupRespawnPin(pin)
    setIsLoading(false)

    if (!result) {
      setError("PIN not found or expired. Ask them to generate a new one.")
      return
    }

    setAssociateInfo({
      name: result.associateName,
      eeid: result.associateEeid,
      role: result.associateRole,
      channel: result.channel,
    })
    setPhase("confirm-identity")
  }

  async function handleAuthorize() {
    if (!associateInfo) return
    setPhase("signing")

    const success = await authorizeRespawn(pin, supervisorAssociateId)

    if (success) {
      setPhase("done")
    } else {
      setError("Authorization failed. The PIN may have expired.")
      setPhase("error")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onDismiss} />
      <div className="relative w-full max-w-lg bg-akyra-surface border-t border-akyra-border rounded-t-2xl p-6 space-y-5">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-white" />
            <p className="font-bold text-white">Authorize Respawn</p>
          </div>
          <button onClick={onDismiss} className="text-akyra-secondary hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Enter PIN */}
        {phase === "enter-pin" && (
          <div className="space-y-4">
            <p className="text-sm text-akyra-secondary">
              Enter the PIN shown on the associate's device.
            </p>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit PIN"
              autoFocus
              className="w-full text-center bg-akyra-black border border-akyra-border rounded-xl py-4 text-white font-mono text-3xl tracking-[0.4em] focus:outline-none focus:border-white"
            />

            {error && <p className="text-akyra-red text-sm font-mono text-center">{error}</p>}

            <button
              onClick={handlePinLookup}
              disabled={pin.length !== 6 || isLoading}
              className="w-full py-3 rounded-xl bg-white text-black font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <><LoadingSpinner size="sm" /> Looking up...</> : "Look Up →"}
            </button>
          </div>
        )}

        {/* Confirm identity */}
        {phase === "confirm-identity" && associateInfo && (
          <div className="space-y-4">
            <p className="text-sm text-akyra-secondary">Who's this?</p>

            <div className="bg-akyra-black border border-white/20 rounded-2xl p-5 text-center space-y-1">
              <p className="text-2xl font-black text-white">{associateInfo.name}</p>
              <p className="text-sm font-mono text-white/40">
                EEID {associateInfo.eeid} · {associateInfo.role}
              </p>
            </div>

            <p className="text-xs text-akyra-secondary text-center">
              Make sure this person is physically standing in front of you.
            </p>

            <p className="text-xs font-bold text-white text-center">
              Who are you?
            </p>

            <button
              onClick={handleAuthorize}
              className="w-full py-3 rounded-xl bg-white text-black font-bold flex items-center justify-center gap-2"
            >
              <Shield className="w-4 h-4" />
              Confirm with Biometric
            </button>

            <button
              onClick={() => setPhase("enter-pin")}
              className="w-full text-xs font-mono text-akyra-secondary hover:text-white transition-colors"
            >
              ← Wrong person
            </button>
          </div>
        )}

        {/* Signing */}
        {phase === "signing" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <LoadingSpinner size="md" />
            <p className="text-white font-semibold">Got it. Respawning.</p>
            <p className="text-xs font-mono text-akyra-secondary">
              Authorization sent to their device.
            </p>
          </div>
        )}

        {/* Done */}
        {phase === "done" && (
          <div className="text-center space-y-4 py-4">
            <p className="text-2xl">✓</p>
            <p className="text-white font-bold">Respawn authorized.</p>
            <p className="text-sm text-akyra-secondary">
              They're setting up their new credentials now.
            </p>
            <button
              onClick={onDismiss}
              className="w-full py-3 rounded-xl border border-akyra-border text-white"
            >
              Done
            </button>
          </div>
        )}

        {/* Error */}
        {phase === "error" && (
          <div className="text-center space-y-4 py-4">
            <p className="text-akyra-red font-bold">Authorization Failed</p>
            <p className="text-sm text-akyra-secondary">{error}</p>
            <button
              onClick={() => { setPhase("enter-pin"); setPin(""); setError(null) }}
              className="w-full py-3 rounded-xl border border-akyra-border text-white"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
