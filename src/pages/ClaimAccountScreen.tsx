import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { AkyraLogo } from "../components/AkyraLogo"
import { LoadingSpinner } from "../components/LoadingSpinner"
import { useAuth } from "../context"
import { fetchProfileByEeid } from "../lib"

interface ClaimAccountScreenProps {
  eeid: string
  onBack: () => void
}

type ClaimStep =
  | { stage: "referencing" }
  | { stage: "confirm"; displayName: string }
  | { stage: "set-pin"; displayName: string }
  | { stage: "error"; message: string }

export function ClaimAccountScreen({ eeid, onBack }: ClaimAccountScreenProps) {
  const { completeFirstLogin } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<ClaimStep>({ stage: "referencing" })
  const [pin, setPin] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-fetch profile on mount
  useState(() => {
    fetchProfileByEeid(eeid).then(profile => {
      if (!profile) {
        setStep({ stage: "error", message: "No profile found for this EEID. Contact your MOD." })
        return
      }
      setStep({ stage: "confirm", displayName: profile.display_name })
    })
  })

  async function handlePinSubmit(e: FormEvent) {
    e.preventDefault()
    if (pin.length < 4) return
    setError(null)
    setIsLoading(true)

    const result = await completeFirstLogin(eeid, pin)
    setIsLoading(false)

    if (result.kind === "success") {
      navigate("/dashboard")
    } else {
      setError(result.kind === "error" ? result.message : "Something went wrong. Try again.")
    }
  }

  return (
    <div className="min-h-screen bg-akyra-black flex flex-col items-center justify-center px-6">

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-white/[0.02] blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[30%] h-[30%] bg-akyra-red/[0.03] blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-sm">

        <div className="text-center mb-10">
          <AkyraLogo className="w-10 h-10 mx-auto mb-4" />
        </div>

        {/* Referencing */}
        {step.stage === "referencing" && (
          <div className="flex flex-col items-center gap-4">
            <LoadingSpinner size="md" />
            <p className="text-akyra-secondary text-sm font-mono">Referencing...</p>
          </div>
        )}

        {/* Confirm identity */}
        {step.stage === "confirm" && (
          <div className="space-y-6 text-center">
            <div>
              <p className="text-akyra-secondary text-sm mb-2">Are you</p>
              <p className="text-3xl font-black text-white uppercase tracking-wide">
                {step.displayName}
              </p>
              <p className="text-xs font-mono text-akyra-secondary mt-2">
                EEID {eeid}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onBack}
                className="flex-1 py-3 rounded-xl border border-akyra-border text-akyra-secondary font-semibold hover:border-white/40 hover:text-white transition-colors"
              >
                No
              </button>
              <button
                onClick={() => setStep({ stage: "set-pin", displayName: step.displayName })}
                className="flex-1 py-3 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-colors"
              >
                Yes
              </button>
            </div>

            <button
              onClick={onBack}
              className="text-xs font-mono text-akyra-secondary hover:text-white transition-colors"
            >
              ← Back
            </button>
          </div>
        )}

        {/* Set PIN */}
        {step.stage === "set-pin" && (
          <form onSubmit={handlePinSubmit} className="space-y-6">
            <div className="text-center">
              <p className="text-2xl font-black text-white">
                Hey, {step.displayName.split(" ")[0]}.
              </p>
              <p className="text-akyra-secondary text-sm mt-2">
                Set your PIN to get started.
              </p>
            </div>

            <div>
              <label className="text-xs font-mono uppercase tracking-widest text-akyra-secondary mb-2 block">
                Choose a PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                placeholder="4–6 digits"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full text-center bg-akyra-surface border border-akyra-border rounded-xl py-4 text-white font-mono text-2xl tracking-widest focus:outline-none focus:border-white"
                autoFocus
                disabled={isLoading}
              />
            </div>

            {error && (
              <p className="text-akyra-red text-sm text-center font-mono">{error}</p>
            )}

            <button
              type="submit"
              disabled={pin.length < 4 || isLoading}
              className="w-full py-3 rounded-xl bg-white text-black font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" />
                  Setting up your account...
                </>
              ) : (
                "Create Account"
              )}
            </button>

            <button
              type="button"
              onClick={() => setStep({ stage: "confirm", displayName: step.displayName })}
              className="w-full text-xs font-mono text-akyra-secondary hover:text-white transition-colors"
            >
              ← Back
            </button>
          </form>
        )}

        {/* Error */}
        {step.stage === "error" && (
          <div className="text-center space-y-4">
            <p className="text-akyra-red text-sm font-mono">{step.message}</p>
            <button
              onClick={onBack}
              className="text-xs font-mono text-akyra-secondary hover:text-white transition-colors"
            >
              ← Back to login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
