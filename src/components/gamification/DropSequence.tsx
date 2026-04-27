import { useState, useEffect } from "react"
import { AkyraLogo } from "../AkyraLogo"
import type { OrgStation } from "../../types"

interface DropSequenceProps {
  associateName: string
  squadMembers: Array<{ name: string; station: string; emoji: string }>
  stations: OrgStation[]
  onStationSelected: (station: string) => Promise<boolean>
  isClaiming: boolean
}

type Phase = "champion" | "dropping" | "deployed"

export function DropSequence({
  associateName,
  squadMembers,
  stations,
  onStationSelected,
  isClaiming,
}: DropSequenceProps) {
  const [phase, setPhase] = useState<Phase>("champion")
  const [selectedStation, setSelectedStation] = useState<string | null>(null)
  const [isDeploying, setIsDeploying] = useState(false)

  // Auto-advance from champion to dropping after 2.5 seconds
  useEffect(() => {
    if (phase === "champion") {
      const timer = setTimeout(() => setPhase("dropping"), 2500)
      return () => clearTimeout(timer)
    }
  }, [phase])

  async function handleStationSelect(stationName: string) {
    setSelectedStation(stationName)
    setIsDeploying(true)

    // Show "Deployed." briefly before handing off
    await new Promise(r => setTimeout(r, 800))
    setPhase("deployed")
    await new Promise(r => setTimeout(r, 1200))

    await onStationSelected(stationName)
  }

  const firstName = associateName.split(" ")[0]

  // Phase 1: Champion screen
  if (phase === "champion") {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-6 z-50">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/[0.03] to-transparent" />
        </div>

        <div className="relative z-10 w-full max-w-sm space-y-8 text-center">
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30 animate-pulse">
            This is your squad
          </p>

          {/* Current user — the champion */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-white/10 border-2 border-white flex items-center justify-center">
              <span className="text-3xl font-black text-white">
                {firstName.charAt(0)}
              </span>
            </div>
            <p className="text-2xl font-black text-white">{firstName}</p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#E63946] animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">
                Your Champion
              </span>
            </div>
          </div>

          {/* Squad */}
          {squadMembers.length > 0 && (
            <div className="flex items-center justify-center gap-4">
              {squadMembers.slice(0, 4).map(member => (
                <div key={member.name} className="flex flex-col items-center gap-1.5">
                  <div className="w-11 h-11 rounded-full bg-white/5 border border-white/20 flex items-center justify-center">
                    <span className="text-lg">{member.emoji}</span>
                  </div>
                  <span className="text-[9px] font-mono text-white/30">
                    {member.name.split(" ")[0]}
                  </span>
                </div>
              ))}
              {squadMembers.length > 4 && (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-11 h-11 rounded-full bg-white/5 border border-white/20 flex items-center justify-center">
                    <span className="text-xs font-mono text-white/40">
                      +{squadMembers.length - 4}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {squadMembers.length === 0 && (
            <p className="text-sm text-white/20 font-mono">First one on the floor.</p>
          )}
        </div>
      </div>
    )
  }

  // Phase 2: Dropping — station select
  if (phase === "dropping") {
    const claimableStations = stations.filter(s => !s.isSupervisorOnly)

    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-6 z-50">
        <div className="relative z-10 w-full max-w-sm space-y-8">
          <div className="text-center">
            <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30 mb-2">
              Dropping...
            </p>
            <p className="text-2xl font-black text-white">
              Pick your drop zone.
            </p>
          </div>

          <div className="space-y-3">
            {claimableStations.map(station => (
              <button
                key={station.name}
                onClick={() => !isClaiming && !isDeploying && handleStationSelect(station.name)}
                disabled={isClaiming || isDeploying}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedStation === station.name
                    ? "border-white bg-white/10 scale-[0.98]"
                    : "border-white/10 bg-white/[0.03] hover:border-white/30 active:scale-[0.97]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{station.emoji}</span>
                  <div>
                    <p className="font-bold text-white">{station.name}</p>
                    {station.description && (
                      <p className="text-xs text-white/40">{station.description}</p>
                    )}
                  </div>
                  {selectedStation === station.name && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-white animate-pulse" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Phase 3: Deployed
  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
      <div className="text-center space-y-4">
        <AkyraLogo className="w-12 h-12 mx-auto animate-pulse" />
        <p className="text-3xl font-black text-white tracking-tight">
          Deployed.
        </p>
        <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30">
          {selectedStation} · Get to work.
        </p>
      </div>
    </div>
  )
}
