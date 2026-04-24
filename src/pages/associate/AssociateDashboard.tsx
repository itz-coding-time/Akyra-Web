import { useStation } from "../../hooks"
import { StationClaimScreen } from "./StationClaimScreen"
import type { Associate } from "../../types"

interface AssociateDashboardProps {
  associate: Associate
}

export function AssociateDashboard({ associate }: AssociateDashboardProps) {
  const { station, floatMode, isClaiming, claim, setFloat } = useStation(associate)

  // No station claimed yet — show claiming screen
  if (!station) {
    return (
      <StationClaimScreen
        associateName={associate.name}
        onClaim={claim}
        isClaiming={isClaiming}
      />
    )
  }

  // Float needs to pick a secondary mode
  if (station === "Float" && !floatMode) {
    return (
      <div className="min-h-screen bg-akyra-black flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black">Float Mode</h2>
            <p className="text-akyra-secondary text-sm mt-2">
              Where do you need to help tonight?
            </p>
          </div>
          <div className="space-y-3">
            {[
              { mode: "kitchen" as const, label: "Help Kitchen", icon: "🍳" },
              { mode: "pos" as const, label: "Help POS", icon: "🖥️" },
              { mode: "both" as const, label: "Both", icon: "⚡" },
            ].map((opt) => (
              <button
                key={opt.mode}
                onClick={() => setFloat(opt.mode)}
                className="w-full text-left p-4 rounded-xl border border-akyra-border bg-akyra-surface hover:border-white/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{opt.icon}</span>
                  <span className="font-semibold text-white">{opt.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Station claimed — task view placeholder (built in WA4)
  return (
    <div className="min-h-screen bg-akyra-black flex flex-col items-center justify-center">
      <p className="font-mono text-akyra-secondary text-sm">
        {station === "Float" ? `Float → ${floatMode}` : station} task view — coming in WA4
      </p>
      <button
        onClick={() => setFloat(null)}
        className="mt-4 text-xs font-mono text-akyra-secondary hover:text-white transition-colors"
      >
        {station === "Float" ? "Change float mode" : ""}
      </button>
    </div>
  )
}
