import { getPacingColor, getPacingBorderColor, getPacingLabel } from "../lib/pacing"
import { formatElapsedTime } from "../lib/timeEngine"
import type { AssociatePacing } from "../hooks"

interface PacingCardProps {
  data: AssociatePacing
}

function ProgressBar({
  value,
  color,
}: {
  value: number
  color: string
}) {
  return (
    <div className="h-1 bg-akyra-border rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(100, value * 100)}%` }}
      />
    </div>
  )
}

export function PacingCard({ data }: PacingCardProps) {
  const {
    associateName,
    archetype,
    startTime,
    endTime,
    onClock,
    completedTasks,
    totalTasks,
    pacing,
  } = data

  const borderColor = getPacingBorderColor(pacing.status)
  const textColor = getPacingColor(pacing.status)
  const label = getPacingLabel(pacing.status, pacing.delta)
  const elapsed = formatElapsedTime(startTime)

  return (
    <div className={`bg-akyra-surface border ${borderColor} rounded-xl p-4 space-y-3`}>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-white">{associateName}</p>
          <p className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary">
            {archetype} · {startTime}–{endTime}
          </p>
        </div>
        <div className={`text-right ${textColor}`}>
          <p className="text-xs font-mono font-bold">{label}</p>
          {!onClock && (
            <p className="text-[9px] font-mono text-akyra-secondary mt-0.5">Not on clock</p>
          )}
        </div>
      </div>

      {onClock && (
        <>
          {/* Task progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono text-akyra-secondary">
              <span>Tasks</span>
              <span>{completedTasks}/{totalTasks} · {Math.round(pacing.taskPct * 100)}%</span>
            </div>
            <ProgressBar
              value={pacing.taskPct}
              color={pacing.status === "BEHIND" ? "bg-akyra-red" : pacing.status === "TRAILING" ? "bg-yellow-400" : "bg-white"}
            />
          </div>

          {/* Time progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono text-akyra-secondary">
              <span>Time</span>
              <span>{elapsed} · {Math.round(pacing.timePct * 100)}%</span>
            </div>
            <ProgressBar value={pacing.timePct} color="bg-white/40" />
          </div>
        </>
      )}
    </div>
  )
}
