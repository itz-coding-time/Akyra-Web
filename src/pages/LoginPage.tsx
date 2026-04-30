import { useState, type FormEvent, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { AkyraLogo } from "../components/AkyraLogo"
import { LoadingSpinner } from "../components/LoadingSpinner"
import { GoogleSignInButton } from "../components/GoogleSignInButton"
import { useAuth } from "../context"
import {
  validateWelcomeCode,
  cacheWelcomeCode,
  getCachedWelcomeCode,
  clearWelcomeCode,
  hasPasskeyEnrolled,
  hasGoogleLinked,
  isPasskeySupported,
  signInWithPasskey,
} from "../lib"
import { ClaimAccountScreen } from "./ClaimAccountScreen"
import { RespawnRequestScreen } from "./RespawnRequestScreen"

type LoginStep =
  | "welcome-code"
  | "eeid"
  | "password"
  | "passkey"
  | "google"

interface OrgInfo {
  orgId: string
  orgName: string
  brandName: string | null
  welcomePhrase: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const { signIn } = useAuth()

  const [step, setStep] = useState<LoginStep>("welcome-code")
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null)
  const [welcomeCode, setWelcomeCode] = useState("")
  const [eeid, setEeid] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [claimingEeid, setClaimingEeid] = useState<string | null>(null)
  const [respawning, setRespawning] = useState(false)

  // Check for cached welcome code on mount
  useEffect(() => {
    const cached = getCachedWelcomeCode()
    if (cached) {
      validateWelcomeCode(cached).then(org => {
        if (org) {
          setOrgInfo({ ...org, welcomePhrase: cached })
          setStep("eeid")
        } else {
          clearWelcomeCode()
          setStep("welcome-code")
        }
      })
    }
  }, [])

  // Step 0 — Welcome Code
  async function handleWelcomeCodeSubmit(e: FormEvent) {
    e.preventDefault()
    const code = welcomeCode.trim()
    if (!code) return
    setError(null)
    setIsLoading(true)

    const org = await validateWelcomeCode(code)
    setIsLoading(false)

    if (!org) {
      setError("Welcome Code not recognized. Check with your manager.")
      return
    }

    cacheWelcomeCode(code)
    setOrgInfo({ ...org, welcomePhrase: code })
    setStep("eeid")
  }

  // Step 1 — EEID
  async function handleEeidSubmit(e: FormEvent) {
    e.preventDefault()
    if (!eeid.trim() || !orgInfo) return
    setError(null)
    setIsLoading(true)

    const result = await signIn(eeid.trim(), "", orgInfo.welcomePhrase)

    switch (result.kind) {
      case "new-user":
        setIsLoading(false)
        setError("EEID not found in this organization. Contact your manager to be added to the roster.")
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
        // Profile exists — determine auth method
        const [passkeyEnrolled, googleLinked] = await Promise.all([
          isPasskeySupported() ? hasPasskeyEnrolled() : Promise.resolve(false),
          hasGoogleLinked(eeid.trim()),
        ])
        setIsLoading(false)

        if (passkeyEnrolled) {
          setStep("passkey")
        } else if (googleLinked) {
          setStep("google")
        } else {
          setStep("password")
        }
        break
      }
    }
  }

  // Step 2a — Password
  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    if (!password || !orgInfo) return
    setError(null)
    setIsLoading(true)

    const result = await signIn(eeid.trim(), password, orgInfo.welcomePhrase)
    setIsLoading(false)

    if (result.kind === "success") {
      navigate("/app/dashboard")
    } else {
      setError("Incorrect password. Try again.")
    }
  }

  if (respawning) {
    return (
      <RespawnRequestScreen
        eeid={eeid}
        onBack={() => setRespawning(false)}
      />
    )
  }

  // ClaimAccountScreen — first login
  if (claimingEeid && orgInfo) {
    return (
      <ClaimAccountScreen
        eeid={claimingEeid}
        welcomePhrase={orgInfo.welcomePhrase}
        onBack={() => {
          setClaimingEeid(null)
          setEeid("")
          setError(null)
          setStep("eeid")
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-akyra-black flex flex-col items-center justify-center px-6">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-white/[0.02] blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[30%] h-[30%] bg-akyra-red/[0.03] blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-8">
        <div className="text-center">
          <AkyraLogo className="w-10 h-10 mx-auto mb-4" />
          {orgInfo && (
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-white/30">
              {orgInfo.brandName ?? orgInfo.orgName}
            </p>
          )}
        </div>

        {/* Step 0 — Welcome Code */}
        {step === "welcome-code" && (
          <form onSubmit={handleWelcomeCodeSubmit} className="space-y-5">
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-black text-white">Welcome to Akyra</h1>
              <p className="text-sm text-akyra-secondary">
                Enter your organization's Welcome Code to get started.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
                Welcome Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="6-digit code"
                maxLength={8}
                autoFocus
                value={welcomeCode}
                onChange={e => setWelcomeCode(e.target.value)}
                className="w-full text-center bg-akyra-surface border border-akyra-border rounded-xl py-4 text-white font-mono text-2xl tracking-[0.4em] focus:outline-none focus:border-white"
              />
            </div>

            {error && <p className="text-akyra-red text-sm text-center font-mono">{error}</p>}

            <button
              type="submit"
              disabled={isLoading || !welcomeCode.trim()}
              className="w-full py-3 rounded-xl bg-white text-black font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <><LoadingSpinner size="sm" /> Checking...</> : "Continue →"}
            </button>
          </form>
        )}

        {/* Step 1 — EEID */}
        {step === "eeid" && (
          <form onSubmit={handleEeidSubmit} className="space-y-5">
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-black text-white">Sign In</h1>
              <p className="text-sm text-akyra-secondary">Enter your Employee ID.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
                Employee ID
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Your EEID"
                value={eeid}
                onChange={e => setEeid(e.target.value.replace(/\D/g, ""))}
                autoFocus
                className="w-full text-center bg-akyra-surface border border-akyra-border rounded-xl py-4 text-white font-mono text-2xl tracking-[0.2em] focus:outline-none focus:border-white"
              />
            </div>

            {error && <p className="text-akyra-red text-sm text-center font-mono">{error}</p>}

            <button
              type="submit"
              disabled={!eeid.trim() || isLoading}
              className="w-full py-3 rounded-xl bg-white text-black font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <><LoadingSpinner size="sm" /> Looking up...</> : "Continue →"}
            </button>

            <button
              type="button"
              onClick={() => {
                clearWelcomeCode()
                setOrgInfo(null)
                setEeid("")
                setError(null)
                setStep("welcome-code")
              }}
              className="w-full text-xs font-mono text-akyra-secondary hover:text-white transition-colors"
            >
              ← Different organization
            </button>
          </form>
        )}

        {/* Step 2a — Password */}
        {step === "password" && (
          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-black text-white">Welcome back</h1>
              <p className="text-sm text-akyra-secondary font-mono">EEID {eeid}</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                className="w-full bg-akyra-surface border border-akyra-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white"
              />
            </div>

            {error && <p className="text-akyra-red text-sm text-center font-mono">{error}</p>}

            <button
              type="submit"
              disabled={!password || isLoading}
              className="w-full py-3 rounded-xl bg-white text-black font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <><LoadingSpinner size="sm" /> Signing in...</> : "Sign In"}
            </button>

            <button
              type="button"
              onClick={() => { setStep("eeid"); setPassword(""); setError(null) }}
              className="w-full text-xs font-mono text-akyra-secondary hover:text-white transition-colors"
            >
              ← Back
            </button>

            <button
              type="button"
              onClick={() => setRespawning(true)}
              className="w-full text-[10px] font-mono text-white/15 hover:text-white/30 transition-colors mt-4"
            >
              I can't get in
            </button>
          </form>
        )}

        {/* Step 2b — Passkey */}
        {step === "passkey" && (
          <div className="space-y-6 text-center">
            <div>
              <h1 className="text-2xl font-black text-white">Welcome back</h1>
              <p className="text-sm text-akyra-secondary font-mono mt-1">EEID {eeid}</p>
            </div>

            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto">
              <span className="text-3xl">🔒</span>
            </div>

            <p className="text-sm text-akyra-secondary">Use your device biometric to sign in.</p>

            {error && <p className="text-akyra-red text-sm font-mono">{error}</p>}

            <button
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
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-white text-black font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <><LoadingSpinner size="sm" /> Verifying...</> : "Use Face ID / Fingerprint"}
            </button>

            <button
              onClick={() => { setStep("password"); setError(null) }}
              className="text-xs font-mono text-akyra-secondary hover:text-white transition-colors"
            >
              Use password instead
            </button>

            <button
              onClick={() => setRespawning(true)}
              className="text-[10px] font-mono text-white/15 hover:text-white/30 transition-colors mt-4"
            >
              I can't get in
            </button>
          </div>
        )}

        {/* Step 2c — Google */}
        {step === "google" && orgInfo && (
          <div className="space-y-6 text-center">
            <div>
              <h1 className="text-2xl font-black text-white">Welcome back</h1>
              <p className="text-sm text-akyra-secondary font-mono mt-1">EEID {eeid}</p>
            </div>

            <GoogleSignInButton eeid={eeid.trim()} />

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-akyra-border" />
              <span className="text-[10px] font-mono text-akyra-secondary">or</span>
              <div className="flex-1 h-px bg-akyra-border" />
            </div>

            <button
              onClick={() => { setStep("password"); setError(null) }}
              className="text-xs font-mono text-akyra-secondary hover:text-white transition-colors"
            >
              Use password instead
            </button>

            <button
              onClick={() => { setStep("eeid"); setError(null) }}
              className="text-xs font-mono text-akyra-secondary hover:text-white transition-colors"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
