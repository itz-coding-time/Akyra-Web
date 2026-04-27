import { useState, type FormEvent } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { AkyraLogo } from "../components/AkyraLogo"
import { LoadingSpinner } from "../components/LoadingSpinner"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { useAuth } from "../context"
import {
  fetchLicenseByPhrase,
  fetchStoreByNumberAndOrg,
  isLicenseOnboardable,
} from "../lib"
import type { License, Store } from "../types"

type Step = "phrase" | "store" | "name" | "pin"

const STEPS: Step[] = ["phrase", "store", "name", "pin"]

export function OnboardingPage() {
  const [searchParams] = useSearchParams()
  const eeid = searchParams.get("eeid") ?? ""
  const navigate = useNavigate()
  const { completeOnboarding } = useAuth()

  const [step, setStep] = useState<Step>("phrase")
  const [phrase, setPhrase] = useState("")
  const [storeNumber, setStoreNumber] = useState("")
  const [name, setName] = useState("")
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Resolved state from API calls
  const [resolvedLicense, setResolvedLicense] = useState<License | null>(null)
  const [resolvedStore, setResolvedStore] = useState<Store | null>(null)

  const stepMessages: Record<Step, { heading: string; sub: string }> = {
    phrase: {
      heading: "Seems like you're new!",
      sub: "Enter your organization's Welcome Phrase to get started.",
    },
    store: {
      heading: "Sweet!",
      sub: "Enter your store number.",
    },
    name: {
      heading: "Awesome!",
      sub: "What's your name?",
    },
    pin: {
      heading: "One final step.",
      sub: "Set your PIN. You'll use this to sign in from now on.",
    },
  }

  async function handlePhraseSubmit(e: FormEvent) {
    e.preventDefault()
    if (!phrase.trim()) return
    setError(null)
    setIsLoading(true)

    console.log("Looking up phrase:", phrase.trim())
    const license = await fetchLicenseByPhrase(phrase.trim())
    console.log("License result:", license)

    setIsLoading(false)

    if (!license) {
      setError("That Welcome Phrase wasn't recognized. Check with your manager.")
      return
    }
    if (!isLicenseOnboardable(license)) {
      setError("Your organization's subscription isn't active. Contact your admin.")
      return
    }

    setResolvedLicense(license)
    setStep("store")
  }

  async function handleStoreSubmit(e: FormEvent) {
    e.preventDefault()
    if (!storeNumber.trim() || !resolvedLicense) return
    setError(null)
    setIsLoading(true)

    const store = await fetchStoreByNumberAndOrg(storeNumber.trim(), resolvedLicense.org_id)
    setIsLoading(false)

    if (!store) {
      setError(`Store ${storeNumber} wasn't found under this license.`)
      return
    }
    if (store.billing_status !== "active") {
      setError("This store isn't currently active. Contact your admin.")
      return
    }

    setResolvedStore(store)
    setStep("name")
  }

  function handleNameSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setStep("pin")
  }

  async function handlePinSubmit(e: FormEvent) {
    e.preventDefault()
    if (pin.length < 6 || !resolvedLicense || !resolvedStore) return
    setError(null)
    setIsLoading(true)

    const result = await completeOnboarding(
      eeid,
      pin,
      name.trim(),
      resolvedLicense.org_id,
      resolvedStore.id
    )

    setIsLoading(false)

    if (result.kind === "success") {
      navigate("/app/dashboard")
    } else {
      setError(result.kind === "error" ? result.message : "Something went wrong")
    }
  }

  const formHandlers: Record<Step, (e: FormEvent) => void> = {
    phrase: handlePhraseSubmit,
    store: handleStoreSubmit,
    name: handleNameSubmit,
    pin: handlePinSubmit,
  }

  const stepBack: Partial<Record<Step, Step>> = {
    store: "phrase",
    name: "store",
    pin: "name",
  }

  return (
    <div className="min-h-screen bg-akyra-black flex flex-col items-center justify-center px-6">

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] bg-akyra-red/[0.03] blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[30%] h-[30%] bg-white/[0.02] blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-10">
          <AkyraLogo className="w-10 h-10 mx-auto mb-4" />
          <h2 className="text-2xl font-black">{stepMessages[step].heading}</h2>
          <p className="text-akyra-secondary text-sm mt-2 leading-relaxed">
            {stepMessages[step].sub}
          </p>
        </div>

        {/* Step progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {STEPS.map((s) => (
            <div
              key={s}
              className={`h-1 rounded-full transition-all duration-300 ${
                s === step
                  ? "w-6 bg-white"
                  : STEPS.indexOf(s) < STEPS.indexOf(step)
                  ? "w-3 bg-white/40"
                  : "w-3 bg-white/10"
              }`}
            />
          ))}
        </div>

        <form onSubmit={formHandlers[step]} className="space-y-4">

          {step === "phrase" && (
            <Input
              type="text"
              inputMode="numeric"
              placeholder="Welcome Phrase"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              className="font-mono text-lg text-center tracking-widest bg-akyra-surface border-akyra-border focus:border-white"
              autoFocus
              disabled={isLoading}
            />
          )}

          {step === "store" && (
            <Input
              type="text"
              inputMode="numeric"
              placeholder="Store Number (e.g. 0896)"
              value={storeNumber}
              onChange={(e) => setStoreNumber(e.target.value.replace(/\D/g, ""))}
              className="font-mono text-lg text-center tracking-widest bg-akyra-surface border-akyra-border focus:border-white"
              autoFocus
              disabled={isLoading}
            />
          )}

          {step === "name" && (
            <Input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-lg bg-akyra-surface border-akyra-border focus:border-white"
              autoFocus
              disabled={isLoading}
            />
          )}

          {step === "pin" && (
            <Input
              type="password"
              inputMode="numeric"
              placeholder="Choose a 6-digit PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="font-mono text-lg text-center tracking-widest bg-akyra-surface border-akyra-border focus:border-white"
              autoFocus
              disabled={isLoading}
            />
          )}

          {error && (
            <p className="text-akyra-red text-sm text-center font-mono">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || (step === "pin" && pin.length < 6)}
          >
            {isLoading ? <LoadingSpinner size="sm" /> : step === "pin" ? "Create Account" : "Continue →"}
          </Button>

          {stepBack[step] && (
            <Button
              type="button"
              variant="ghost"
              className="w-full text-akyra-secondary"
              onClick={() => {
                setError(null)
                setStep(stepBack[step]!)
              }}
              disabled={isLoading}
            >
              ← Back
            </Button>
          )}

          <div className="text-center pt-2">
            <button
              type="button"
              className="text-xs text-akyra-secondary hover:text-white transition-colors font-mono"
              onClick={() => navigate("/app/login")}
            >
              Already have an account? Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
