import { useState, type FormEvent } from "react"
import { createOrganization, createStore } from "../../lib"
import { LoadingSpinner } from "../../components/LoadingSpinner"
import { X, Check } from "lucide-react"

interface NewOrgFlowProps {
  onComplete: () => void
  onCancel: () => void
}

type Step = "org-details" | "store-details" | "done"

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
]

export function NewOrgFlow({ onComplete, onCancel }: NewOrgFlowProps) {
  const [step, setStep] = useState<Step>("org-details")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Org details
  const [orgName, setOrgName] = useState("")
  const [brandName, setBrandName] = useState("")
  const [brandColor, setBrandColor] = useState("#E63946")
  const [welcomePhrase, setWelcomePhrase] = useState("")

  // Store details
  const [storeNumber, setStoreNumber] = useState("")
  const [timezone, setTimezone] = useState("America/New_York")

  // Created IDs
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null)

  async function handleOrgSubmit(e: FormEvent) {
    e.preventDefault()
    if (!orgName.trim() || !welcomePhrase.trim()) return
    setError(null)
    setIsLoading(true)

    console.log("Creating org:", { orgName, brandName, brandColor, welcomePhrase })

    try {
      const result = await createOrganization(
        orgName.trim(),
        brandName.trim() || orgName.trim(),
        brandColor,
        welcomePhrase.trim()
      )

      console.log("createOrganization result:", result)

      if (!result) {
        setError("Failed to create organization. The welcome phrase may already be taken.")
        setIsLoading(false)
        return
      }

      setCreatedOrgId(result.orgId)
      setStep("store-details")
    } catch (err) {
      console.error("createOrganization threw:", err)
      setError("An unexpected error occurred. Check the console.")
    }

    setIsLoading(false)
  }

  async function handleStoreSubmit(e: FormEvent) {
    e.preventDefault()
    if (!storeNumber.trim() || !createdOrgId) return
    setError(null)
    setIsLoading(true)

    const storeId = await createStore(createdOrgId, storeNumber.trim(), timezone)
    setIsLoading(false)

    if (!storeId) {
      setError("Failed to create store.")
      return
    }

    setStep("done")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative w-full max-w-lg bg-akyra-surface border-t border-akyra-border rounded-t-2xl p-6 space-y-5 max-h-[85vh] overflow-y-auto">

        <div className="flex items-center justify-between">
          <p className="font-bold text-white">
            {step === "org-details" ? "New Organization" :
             step === "store-details" ? "Add First Store" :
             "Organization Created"}
          </p>
          <button onClick={onCancel} className="text-akyra-secondary hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Org Details */}
        {step === "org-details" && (
          <form onSubmit={handleOrgSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
                Organization Name
              </label>
              <input
                type="text"
                placeholder="e.g. Wawa Inc"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                className="w-full bg-akyra-black border border-akyra-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
                Brand Name (shown in app)
              </label>
              <input
                type="text"
                placeholder="e.g. Wawa"
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                className="w-full bg-akyra-black border border-akyra-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
                Brand Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={brandColor}
                  onChange={e => setBrandColor(e.target.value)}
                  className="w-12 h-12 rounded-lg border border-akyra-border bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={brandColor}
                  onChange={e => setBrandColor(e.target.value)}
                  className="flex-1 bg-akyra-black border border-akyra-border rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
                Welcome Phrase (6 digits, unique)
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 112233"
                maxLength={8}
                value={welcomePhrase}
                onChange={e => setWelcomePhrase(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-akyra-black border border-akyra-border rounded-xl px-4 py-3 text-white font-mono tracking-widest focus:outline-none focus:border-white"
              />
            </div>

            {error && <p className="text-akyra-red text-sm font-mono">{error}</p>}

            <button
              type="submit"
              disabled={!orgName.trim() || !welcomePhrase.trim() || isLoading}
              className="w-full py-3 rounded-xl bg-white text-black font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <><LoadingSpinner size="sm" /> Creating...</> : "Create Organization →"}
            </button>
          </form>
        )}

        {/* Step 2: Store Details */}
        {step === "store-details" && (
          <form onSubmit={handleStoreSubmit} className="space-y-4">
            <p className="text-sm text-akyra-secondary">
              Organization created. Add the first store.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
                Store Number
              </label>
              <input
                type="text"
                placeholder="e.g. 0042"
                value={storeNumber}
                onChange={e => setStoreNumber(e.target.value)}
                className="w-full bg-akyra-black border border-akyra-border rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-white"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="w-full bg-akyra-black border border-akyra-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white"
              >
                {TIMEZONES.map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            {error && <p className="text-akyra-red text-sm font-mono">{error}</p>}

            <button
              type="submit"
              disabled={!storeNumber.trim() || isLoading}
              className="w-full py-3 rounded-xl bg-white text-black font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <><LoadingSpinner size="sm" /> Creating...</> : "Add Store →"}
            </button>
          </form>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-lg">{brandName || orgName} is ready.</p>
              <p className="text-akyra-secondary text-sm mt-1">
                Welcome phrase: <span className="font-mono text-white">{welcomePhrase}</span>
              </p>
              <p className="text-akyra-secondary text-sm">
                Store: <span className="font-mono text-white">{storeNumber}</span>
              </p>
            </div>
            <p className="text-xs text-akyra-secondary">
              Next: upload their task CSV and roster using the seed script.
            </p>
            <button
              onClick={onComplete}
              className="w-full py-3 rounded-xl bg-white text-black font-semibold"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
