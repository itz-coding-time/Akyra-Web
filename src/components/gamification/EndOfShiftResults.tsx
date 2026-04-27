import { AkyraLogo } from "../AkyraLogo"
import type { Database } from "../../types/database.types"

type ShiftResult = Database["public"]["Tables"]["shift_results"]["Row"]

interface TeamResult {
  associateName: string
  result: ShiftResult
}

interface EndOfShiftResultsProps {
  teamResults: TeamResult[]
  myAssociateId: string
  onDone: () => void
}

const BENCHMARK_CONFIG = {
  Exceeded: { color: "text-white", border: "border-white/40", bar: "bg-white" },
  Performed: { color: "text-white/70", border: "border-white/20", bar: "bg-white/60" },
  Executed: { color: "text-white/40", border: "border-white/10", bar: "bg-white/30" },
}

export function EndOfShiftResults({
  teamResults,
  myAssociateId,
  onDone,
}: EndOfShiftResultsProps) {
  const killLeader = teamResults.find(r => r.result.is_kill_leader)

  return (
    <div className="fixed inset-0 bg-black z-50 overflow-y-auto">
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">

          {/* Header */}
          <div className="text-center space-y-2">
            <AkyraLogo className="w-10 h-10 mx-auto mb-4" />
            <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30">
              Shift Complete
            </p>
            <h1 className="text-3xl font-black text-white">
              Extracted.
            </h1>
          </div>

          {/* Kill Leader */}
          {killLeader && (
            <div className="bg-white/5 border border-white/20 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-mono uppercase tracking-widest text-white/30 mb-2">
                Kill Leader
              </p>
              <p className="text-xl font-black text-white">
                {killLeader.associateName.split(" ")[0]}
              </p>
              <p className="text-xs text-white/40 mt-1">
                +1 Burn Card earned
              </p>
            </div>
          )}

          {/* Team results */}
          <div className="space-y-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-white/30">
              Squad Performance
            </p>

            {teamResults
              .sort((a, b) => (b.result.completion_pct ?? 0) - (a.result.completion_pct ?? 0))
              .map(({ associateName, result }) => {
                const benchmark = result.benchmark as keyof typeof BENCHMARK_CONFIG
                const config = BENCHMARK_CONFIG[benchmark] ?? BENCHMARK_CONFIG.Executed
                const isMe = result.associate_id === myAssociateId
                const pct = result.completion_pct ?? 0

                return (
                  <div
                    key={result.associate_id}
                    className={`border rounded-xl p-4 ${config.border} ${
                      isMe ? "bg-white/[0.05]" : "bg-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className={`font-semibold ${config.color}`}>
                          {associateName.split(" ")[0]}
                          {isMe && (
                            <span className="text-[10px] font-mono text-white/30 ml-2">you</span>
                          )}
                        </p>
                        {result.is_kill_leader && (
                          <span className="text-[9px] font-mono text-white bg-white/10 px-1.5 py-0.5 rounded">
                            KILL LEADER
                          </span>
                        )}
                      </div>
                      <span className={`text-xs font-mono font-bold ${config.color}`}>
                        {benchmark}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${config.bar}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex justify-between mt-1.5">
                      <span className="text-[10px] font-mono text-white/30">
                        {result.tasks_completed}/{result.tasks_total} tasks
                      </span>
                      <span className={`text-[10px] font-mono ${config.color}`}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                )
              })}
          </div>

          {/* Done button */}
          <button
            onClick={onDone}
            className="w-full py-3.5 rounded-xl bg-white text-black font-bold hover:bg-white/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
