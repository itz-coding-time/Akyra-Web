import { useState } from "react"
import { AkyraLogo } from "../../components/AkyraLogo"
import { LoadingSpinner } from "../../components/LoadingSpinner"
import { useAuth } from "../../context"

interface StationClaimScreenProps {
  associateName: string
  onClaim: (station: string) => Promise<boolean>
  isClaiming: boolean
}

export function StationClaimScreen({
  associateName,
  onClaim,
  isClaiming,
}: StationClaimScreenProps) {
  const { orgStations } = useAuth()
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Filter to non-supervisor stations only
  const claimableStations = orgStations.filter(s => !s.isSupervisorOnly)

  async function handleClaim() {
    if (!selected) return
    setError(null)
    const success = await onClaim(selected)
    if (!success) {
      setError("Couldn't claim station. Try again.")
    }
  }

  return (
    <div className="min-h-screen bg-akyra-black flex flex-col items-center justify-center px-6">

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-[50%] h-[40%] bg-white/[0.015] blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-10">
          <AkyraLogo className="w-10 h-10 mx-auto mb-4" />
          <h2 className="text-2xl font-black">
            Hey, {associateName}.
          </h2>
          <p className="text-akyra-secondary text-sm mt-2">
            What's your station tonight?
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {claimableStations.map((station) => (
            <button
              key={station.name}
              onClick={() => setSelected(station.name)}
              disabled={isClaiming}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selected === station.name
                  ? "border-white bg-white/10"
                  : "border-akyra-border bg-akyra-surface hover:border-white/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{station.emoji}</span>
                <div>
                  <p className="font-semibold text-white">{station.name}</p>
                  {station.description && (
                    <p className="text-xs text-akyra-secondary">{station.description}</p>
                  )}
                </div>
                {selected === station.name && (
                  <div className="ml-auto w-2 h-2 rounded-full bg-white" />
                )}
              </div>
            </button>
          ))}
        </div>

        {error && (
          <p className="text-akyra-red text-sm text-center font-mono mb-4">{error}</p>
        )}

        <button
          onClick={handleClaim}
          disabled={!selected || isClaiming}
          className={`w-full py-3 rounded-xl font-semibold transition-all ${
            selected && !isClaiming
              ? "bg-white text-black hover:bg-white/90"
              : "bg-akyra-surface text-akyra-secondary cursor-not-allowed"
          }`}
        >
          {isClaiming ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner size="sm" />
              Claiming...
            </span>
          ) : (
            "Claim Station"
          )}
        </button>
      </div>
    </div>
  )
}
