import { useState } from "react"
import type { StationGroup } from "../hooks"
import type { Associate } from "../types"
import { LoadingSpinner } from "./LoadingSpinner"
import { Users, Coffee } from "lucide-react"

interface StationBoardProps {
  grouped: StationGroup[]
  unclaimed: Associate[]
  isLoading: boolean
  isReassigning: string | null
  onReassign: (associateId: string, newArchetype: string) => Promise<void>
  leaderboard?: any[]
  activeShifts?: any[]
}

const REASSIGN_OPTIONS = ["Kitchen", "POS", "Float", "MOD"]

const archetypeAccent: Record<string, string> = {
  MOD: "border-akyra-red/40",
  Kitchen: "border-white/20",
  POS: "border-white/20",
  Float: "border-white/10",
}

export function StationBoard({
  grouped,
  unclaimed,
  isLoading,
  isReassigning,
  onReassign,
  leaderboard = [],
  activeShifts = [],
}: StationBoardProps) {
  const [reassigningId, setReassigningId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="sm" />
      </div>
    )
  }

  async function handleReassign(associateId: string, archetype: string) {
    setReassigningId(null)
    await onReassign(associateId, archetype)
  }

  const extended = activeShifts.filter(s => s.is_extended).map(s => {
    let a = unclaimed.find(x => x.id === s.associate_id)
    if (!a) {
      for (const g of grouped) {
        const found = g.associates.find(x => x.id === s.associate_id)
        if (found) { a = found; break }
      }
    }
    return {
      associateId: s.associate_id,
      associateName: a?.name ?? "Unknown",
      station: a?.current_archetype ?? "Unknown"
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
          Station Board
        </p>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-[9px] font-mono uppercase tracking-widest text-akyra-secondary">
            Live
          </span>
        </div>
      </div>

      {extended.length > 0 && (
        <div className="mb-4">
          <p className="text-[9px] font-mono uppercase tracking-widest text-orange-400/40 mb-2">
            Holdovers from last shift
          </p>
          {extended.map(e => (
            <div key={e.associateId} className="flex items-center justify-between bg-orange-500/[0.04] border border-orange-500/15 rounded-xl px-3 py-2 mb-1.5">
              <p className="text-sm text-white/60">{e.associateName}</p>
              <span className="text-[9px] font-mono text-orange-400/50">{e.station} · extending</span>
            </div>
          ))}
        </div>
      )}

      {grouped.map(({ archetype, associates }) => (
        <div
          key={archetype}
          className={`bg-akyra-surface border rounded-xl p-4 ${archetypeAccent[archetype] ?? "border-akyra-border"}`}
        >
          <p className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary mb-3">
            {archetype} · {associates.length}
          </p>

          <div className="space-y-2">
            {associates.map((associate) => (
              <div key={associate.id} className="relative">
                <button
                  onClick={() =>
                    setReassigningId(
                      reassigningId === associate.id ? null : associate.id
                    )
                  }
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-akyra-border flex items-center justify-center">
                      <span className="text-xs font-bold text-white">
                        {associate.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-white">{associate.name}</span>
                        {leaderboard.find(r => r.associateId === associate.profile_id)?.isPredator && (
                          <span className="text-yellow-400 text-[10px]" title="Predator — Top 3">🔱</span>
                        )}
                        {leaderboard.find(r => r.associateId === associate.profile_id)?.isDesynced && (
                          <span className="text-orange-400 text-[10px]" title="Desynced">⚡</span>
                        )}
                      </div>
                      {(associate as any).hasActiveShift && !activeShifts.find(s => s.associate_id === associate.id)?.on_break && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          <span className="text-[9px] font-mono text-akyra-secondary uppercase tracking-widest">
                            On shift
                          </span>
                        </div>
                      )}
                      {activeShifts.find(s => s.associate_id === associate.id)?.on_break && (
                        <div className="flex items-center gap-1 mt-0.5 text-akyra-secondary">
                          <Coffee className="w-3 h-3" />
                          <span className="text-[9px] font-mono uppercase tracking-widest">
                            On break
                          </span>
                        </div>
                      )}
                      {activeShifts.find(s => s.associate_id === associate.id)?.is_extended && (
                        <span className="text-[9px] font-mono text-orange-400/60 border border-orange-500/20 rounded px-1.5 py-0.5 mt-1 inline-block">
                          extending
                        </span>
                      )}
                    </div>
                  </div>

                  {isReassigning === associate.id ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <span className="text-[9px] font-mono uppercase tracking-widest text-akyra-secondary">
                      Reassign
                    </span>
                  )}
                </button>

                {/* Reassign dropdown */}
                {reassigningId === associate.id && (
                  <div className="mt-1 bg-akyra-black border border-akyra-border rounded-xl overflow-hidden">
                    {REASSIGN_OPTIONS.filter((o) => o !== archetype).map((option) => (
                      <button
                        key={option}
                        onClick={() => handleReassign(associate.id, option)}
                        className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors border-b border-akyra-border last:border-0"
                      >
                        Move to {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Unclaimed associates */}
      {unclaimed.length > 0 && (
        <div className="bg-akyra-surface border border-akyra-red/20 rounded-xl p-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-akyra-red mb-3">
            No Station · {unclaimed.length}
          </p>
          <div className="space-y-1">
            {unclaimed.map((a) => (
              <div key={a.id} className="flex items-center gap-2 p-2">
                <div className="w-7 h-7 rounded-full bg-akyra-border flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{a.name.charAt(0)}</span>
                </div>
                <span className="text-sm text-akyra-secondary">{a.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {grouped.length === 0 && unclaimed.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <Users className="w-8 h-8 text-akyra-border" />
          <p className="text-sm text-akyra-secondary">No associates on shift yet.</p>
        </div>
      )}
    </div>
  )
}
