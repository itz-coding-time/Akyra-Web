import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { AkyraLogo } from "../components/AkyraLogo"
import { LoadingSpinner } from "../components/LoadingSpinner"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { useAuth } from "../context"
import { ClaimAccountScreen } from "./ClaimAccountScreen"

type LoginStep = "eeid" | "pin"

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<LoginStep>("eeid")
  const [eeid, setEeid] = useState("")
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [claimingEeid, setClaimingEeid] = useState<string | null>(null)

  async function handleEeidSubmit(e: FormEvent) {
    e.preventDefault()
    if (!eeid.trim()) return
    setError(null)
    setIsLoading(true)

    const result = await signIn(eeid.trim(), "")
    setIsLoading(false)

    switch (result.kind) {
      case "new-user":
        navigate(`/onboarding?eeid=${encodeURIComponent(eeid.trim())}`)
        break
      case "first-login":
        setClaimingEeid(eeid.trim())
        break
      case "success":
        navigate("/dashboard")
        break
      case "error":
        if (result.message === "Invalid PIN") {
          setStep("pin")
        } else {
          setError(result.message)
        }
        break
    }
  }

  async function handlePinSubmit(e: FormEvent) {
    e.preventDefault()
    if (!pin) return
    setError(null)
    setIsLoading(true)

    const result = await signIn(eeid.trim(), pin)
    setIsLoading(false)

    if (result.kind === "success") {
      navigate("/dashboard")
    } else {
      setError(result.kind === "error" ? result.message : "Something went wrong")
    }
  }

  // First-login path — hand off to ClaimAccountScreen
  if (claimingEeid) {
    return (
      <ClaimAccountScreen
        eeid={claimingEeid}
        onBack={() => {
          setClaimingEeid(null)
          setEeid("")
          setError(null)
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-akyra-black flex flex-col items-center justify-center px-6">

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-white/[0.02] blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[30%] h-[30%] bg-akyra-red/[0.03] blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-12">
          <AkyraLogo className="w-14 h-14 mx-auto mb-6 animate-breathe" />
          <h1 className="text-3xl font-black tracking-[0.2em]">AKYRA</h1>
          <p className="text-akyra-secondary text-xs font-mono uppercase tracking-widest mt-2">
            Operational Intelligence
          </p>
        </div>

        {/* EEID Step */}
        {step === "eeid" && (
          <form onSubmit={handleEeidSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-mono uppercase tracking-widest text-akyra-secondary mb-2 block">
                Employee ID
              </label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 262661"
                value={eeid}
                onChange={(e) => setEeid(e.target.value.replace(/\D/g, ""))}
                className="font-mono text-lg text-center tracking-widest bg-akyra-surface border-akyra-border focus:border-white"
                autoFocus
                disabled={isLoading}
              />
            </div>

            {error && (
              <p className="text-akyra-red text-sm text-center font-mono">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!eeid || isLoading}
            >
              {isLoading ? <LoadingSpinner size="sm" /> : "Continue"}
            </Button>
          </form>
        )}

        {/* PIN Step — returning user */}
        {step === "pin" && (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="text-center mb-6">
              <p className="text-white font-semibold">
                Welcome back
              </p>
              <p className="text-akyra-secondary text-sm font-mono mt-1">
                EEID {eeid}
              </p>
            </div>

            <div>
              <label className="text-xs font-mono uppercase tracking-widest text-akyra-secondary mb-2 block">
                PIN
              </label>
              <Input
                type="password"
                inputMode="numeric"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="font-mono text-lg text-center tracking-widest bg-akyra-surface border-akyra-border focus:border-white"
                autoFocus
                disabled={isLoading}
              />
            </div>

            {error && (
              <p className="text-akyra-red text-sm text-center font-mono">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!pin || isLoading}
            >
              {isLoading ? <LoadingSpinner size="sm" /> : "Sign In"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-akyra-secondary"
              onClick={() => { setStep("eeid"); setPin(""); setError(null) }}
            >
              ← Back
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
