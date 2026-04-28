import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { AkyraLogo } from "../components/AkyraLogo"
import { LoadingSpinner } from "../components/LoadingSpinner"
import { GoogleSignInButton } from "../components/GoogleSignInButton"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { useAuth } from "../context"
import { ClaimAccountScreen } from "./ClaimAccountScreen"
import { isPasskeySupported, signInWithPasskey, hasPasskeyEnrolled, hasGoogleLinked } from "../lib"

type LoginStep = "eeid" | "pin" | "google" | "passkey"

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

    switch (result.kind) {
      case "new-user":
        setIsLoading(false)
        navigate(`/app/onboarding?eeid=${encodeURIComponent(eeid.trim())}`)
        break
      case "first-login":
        setIsLoading(false)
        setClaimingEeid(eeid.trim())
        break
      case "success":
        setIsLoading(false)
        navigate("/app/dashboard")
        break
      default: {
        // DB Admin always routes to Google
        if (eeid.trim() === "000001") {
          setIsLoading(false)
          setStep("google")
          break
        }
        // Profile exists with auth — check Google
        const linked = await hasGoogleLinked(eeid.trim())
        if (linked) {
          setIsLoading(false)
          setStep("google")
          break
        }
        // No Google — check passkey
        if (isPasskeySupported()) {
          const enrolled = await hasPasskeyEnrolled()
          if (enrolled) {
            setIsLoading(false)
            setStep("passkey")
            break
          }
        }
        setIsLoading(false)
        setStep("pin")
      }
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
      navigate("/app/dashboard")
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

        {/* Passkey Step */}
        {step === "passkey" && (
          <div className="space-y-6 text-center">
            <div>
              <p className="text-white font-semibold">Welcome back</p>
              <p className="text-akyra-secondary text-sm font-mono mt-1">EEID {eeid}</p>
            </div>

            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto">
              <span className="text-3xl">🔒</span>
            </div>

            <p className="text-akyra-secondary text-sm">
              Use your device biometric to sign in
            </p>

            {error && (
              <p className="text-akyra-red text-sm font-mono">{error}</p>
            )}

            <Button
              onClick={async () => {
                setError(null)
                setIsLoading(true)
                const profile = await signInWithPasskey(eeid.trim())
                setIsLoading(false)
                if (profile) {
                  navigate("/app/dashboard")
                } else {
                  setError("Biometric sign-in failed.")
                }
              }}
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? <LoadingSpinner size="sm" /> : "Use Face ID / Fingerprint"}
            </Button>

            <button
              onClick={() => { setStep("pin"); setError(null) }}
              className="text-xs font-mono text-akyra-secondary hover:text-white transition-colors"
            >
              Use password instead
            </button>
          </div>
        )}

        {/* Google Step */}
        {step === "google" && (
          eeid === "000001" ? (
            <div className="space-y-6 text-center">
              <div>
                <p className="text-white font-semibold">Admin Access</p>
                <p className="text-akyra-secondary text-sm mt-1">
                  Authorized accounts only.
                </p>
              </div>

              <GoogleSignInButton
                eeid="000001"
                label="Continue with Google"
              />

              <button
                onClick={() => { setStep("eeid"); setEeid("") }}
                className="text-xs font-mono text-akyra-secondary hover:text-white transition-colors"
              >
                ← Back
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-white font-semibold">Welcome back</p>
                <p className="text-akyra-secondary text-sm font-mono mt-1">
                  EEID {eeid}
                </p>
              </div>

              <GoogleSignInButton eeid={eeid.trim()} />

              <div className="relative flex items-center gap-3">
                <div className="flex-1 h-px bg-akyra-border" />
                <span className="text-[10px] font-mono text-akyra-secondary">or</span>
                <div className="flex-1 h-px bg-akyra-border" />
              </div>

              <button
                onClick={() => setStep("pin")}
                className="w-full text-xs font-mono text-akyra-secondary hover:text-white transition-colors"
              >
                Use password instead
              </button>

              <button
                onClick={() => { setStep("eeid"); setEeid("") }}
                className="w-full text-xs font-mono text-akyra-secondary hover:text-white transition-colors"
              >
                ← Back
              </button>
            </div>
          )
        )}

        {/* Password Step — returning user */}
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
                Password
              </label>
              <Input
                type="password"
                placeholder="Enter your password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
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
