import { useState } from "react"
import { registerPasskey, isPasskeySupported } from "../lib"
import { LoadingSpinner } from "./LoadingSpinner"
import { Fingerprint, X } from "lucide-react"

interface PasskeyPromptProps {
  displayName: string
  onDismiss: () => void
}

export function PasskeyPrompt({ displayName, onDismiss }: PasskeyPromptProps) {
  const [isRegistering, setIsRegistering] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  if (!isPasskeySupported()) return null

  async function handleEnable() {
    setIsRegistering(true)
    const res = await registerPasskey(displayName)
    setIsRegistering(false)

    if (res.success) {
      setResult("success")
      setTimeout(onDismiss, 1500)
    } else {
      setResult(res.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onDismiss} />
      <div className="relative w-full max-w-lg bg-akyra-surface border-t border-akyra-border rounded-t-2xl p-6 space-y-5">

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Fingerprint className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-white">Faster Sign-In</p>
              <p className="text-xs text-akyra-secondary">
                Use Face ID or fingerprint next time
              </p>
            </div>
          </div>
          <button onClick={onDismiss} className="text-akyra-secondary hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-akyra-secondary leading-relaxed">
          Skip the PIN on your next login. Your biometric stays on your device — Akyra never sees it.
        </p>

        {result === "success" ? (
          <div className="text-center py-2">
            <p className="text-white font-semibold">✓ Passkey enabled</p>
          </div>
        ) : (
          <>
            {result && (
              <p className="text-akyra-red text-sm font-mono">{result}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={onDismiss}
                className="flex-1 py-3 rounded-xl border border-akyra-border text-akyra-secondary font-semibold hover:border-white/40 transition-colors"
              >
                Not Now
              </button>
              <button
                onClick={handleEnable}
                disabled={isRegistering}
                className="flex-1 py-3 rounded-xl bg-white text-black font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isRegistering ? (
                  <><LoadingSpinner size="sm" /> Setting up...</>
                ) : (
                  "Enable"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
