import { useMemo } from "react"

export interface HeatmapCell {
  xLabel: string
  yLabel: string
  count: number
  flagLevel: string
  patternId: string
}

export interface HeatmapPanelProps {
  title: string
  xAxisLabel: string
  yAxisLabel: string
  cells: HeatmapCell[]
  onCellTap?: (cell: HeatmapCell) => void
}

const FLAG_BG: Record<string, string> = {
  watch: "bg-white/10",
  retrain: "bg-orange-500/50",
  sop_review: "bg-yellow-500/50",
  bias_review: "bg-[#E63946]/60",
}

const INTENSITY: Record<number, number> = { 1: 0.4, 2: 0.7, 3: 1 }

export function HeatmapPanel({
  title,
  yAxisLabel,
  cells,
  onCellTap,
}: HeatmapPanelProps) {
  const xLabels = useMemo(() => [...new Set(cells.map(c => c.xLabel))], [cells])
  const yLabels = useMemo(() => [...new Set(cells.map(c => c.yLabel))], [cells])

  const getCell = (x: string, y: string) =>
    cells.find(c => c.xLabel === x && c.yLabel === y)

  if (cells.length === 0) {
    return (
      <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4">
        <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary mb-2">
          {title}
        </p>
        <p className="text-sm text-akyra-secondary">No patterns detected.</p>
      </div>
    )
  }

  return (
    <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4 space-y-3">
      <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
        {title}
      </p>

      <div className="overflow-x-auto -mx-2 px-2">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="text-[8px] font-mono text-white/20 text-left pb-2 pr-3 min-w-[80px]">
                {yAxisLabel} ↓
              </th>
              {xLabels.map(x => (
                <th key={x} className="pb-2 px-1 min-w-[40px]">
                  <span
                    className="block text-[8px] font-mono text-white/30 text-center truncate max-w-[40px]"
                    title={x}
                  >
                    {x.length > 6 ? x.slice(0, 6) + "…" : x}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yLabels.map(y => (
              <tr key={y}>
                <td className="pr-3 py-1">
                  <span
                    className="text-[8px] font-mono text-white/40 truncate max-w-[80px] block"
                    title={y}
                  >
                    {y.length > 10 ? y.slice(0, 10) + "…" : y}
                  </span>
                </td>
                {xLabels.map(x => {
                  const cell = getCell(x, y)
                  const intensity = INTENSITY[Math.min(cell?.count ?? 0, 3)] ?? 0
                  return (
                    <td key={x} className="px-1 py-1 text-center">
                      {cell ? (
                        <button
                          onClick={() => onCellTap?.(cell)}
                          style={{ opacity: intensity }}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black text-white transition-all hover:scale-110 hover:opacity-100 ${
                            FLAG_BG[cell.flagLevel] ?? "bg-white/10"
                          }`}
                          title={`${cell.count} occurrence${cell.count !== 1 ? "s" : ""} — ${cell.flagLevel.replace("_", " ")}`}
                        >
                          {cell.count}
                        </button>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-white/[0.03]" />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap pt-1">
        <span className="text-[8px] font-mono text-white/20 uppercase tracking-widest">Legend:</span>
        {[
          { flag: "watch", label: "Watch", color: "bg-white/20" },
          { flag: "retrain", label: "Retrain", color: "bg-orange-500/60" },
          { flag: "sop_review", label: "SOP Review", color: "bg-yellow-500/60" },
          { flag: "bias_review", label: "Bias Review", color: "bg-[#E63946]/60" },
        ].map(({ flag, label, color }) => (
          <div key={flag} className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded ${color}`} />
            <span className="text-[8px] font-mono text-white/30">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
