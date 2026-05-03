# Akyra Web — RA3: Challenge Heatmap

Do only what is described. Nothing else.

**Context:** RA2 created the HR panel with a list view of challenge patterns. This stage upgrades it with a visual heatmap — three axes showing concentration of failures. Color intensity communicates severity. Tapping a cell opens pattern detail. This turns the HR panel from a list into a genuine analytical tool.

**Three heatmap axes:**
- Associate × Task → retrain signals
- Supervisor × Task → SOP rewrite signals  
- Supervisor × Associate → bias signals

**Prerequisites:** RA2 complete. `challenge_patterns` table populated.

---

## Before touching anything:

1. Read `src/pages/dashboard/StoreManagerPage.tsx` — find the HR panel from RA2
2. Read `src/components/index.ts` — check what's exported

---

## Change 1 of 2 — Create HeatmapPanel component

Create `src/components/HeatmapPanel.tsx`:

```tsx
import { useMemo } from "react"

interface HeatmapCell {
  xLabel: string
  yLabel: string
  count: number
  flagLevel: string
  patternId: string
}

interface HeatmapPanelProps {
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
  xAxisLabel,
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
```

Export from `src/components/index.ts`:

```typescript
export { HeatmapPanel } from "./HeatmapPanel"
```

---

## Change 2 of 2 — Replace HR list with heatmaps in StoreManagerPage

In `src/pages/dashboard/StoreManagerPage.tsx`, replace the pattern list cards in the HR panel with three HeatmapPanel instances. Keep the `selectedPattern` detail modal unchanged.

```tsx
import { HeatmapPanel } from "../../components/HeatmapPanel"

{activePanel === "hr" && (
  <div className="space-y-5">
    <div className="flex items-center justify-between">
      <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
        Challenge Patterns · 90 Days
      </p>
      {challengePatterns.filter(p => p.flagLevel !== "watch").length > 0 && (
        <span className="text-[10px] font-mono text-akyra-red">
          {challengePatterns.filter(p => p.flagLevel !== "watch").length} flagged
        </span>
      )}
    </div>

    {challengePatterns.length === 0 ? (
      <div className="bg-akyra-surface border border-akyra-border rounded-xl p-6 text-center">
        <p className="text-sm text-akyra-secondary">No patterns detected.</p>
        <p className="text-xs text-white/20 mt-1 font-mono">Clean slate.</p>
      </div>
    ) : (
      <>
        {/* Heatmap 1 — Associate × Task */}
        <HeatmapPanel
          title="Associate × Task — Retrain Signals"
          xAxisLabel="Task"
          yAxisLabel="Associate"
          cells={challengePatterns
            .filter(p => p.patternType === "associate_task")
            .map(p => ({
              xLabel: p.taskName,
              yLabel: p.associateName,
              count: p.challengeCount,
              flagLevel: p.flagLevel,
              patternId: p.id,
            }))}
          onCellTap={cell =>
            setSelectedPattern(challengePatterns.find(p => p.id === cell.patternId))
          }
        />

        {/* Heatmap 2 — Supervisor × Task */}
        <HeatmapPanel
          title="Supervisor × Task — SOP Signals"
          xAxisLabel="Task"
          yAxisLabel="Supervisor"
          cells={challengePatterns
            .filter(p => p.patternType === "supervisor_task")
            .map(p => ({
              xLabel: p.taskName,
              yLabel: p.supervisorName ?? "Unknown",
              count: p.challengeCount,
              flagLevel: p.flagLevel,
              patternId: p.id,
            }))}
          onCellTap={cell =>
            setSelectedPattern(challengePatterns.find(p => p.id === cell.patternId))
          }
        />

        {/* Heatmap 3 — Supervisor × Associate */}
        <HeatmapPanel
          title="Supervisor × Associate — Bias Signals"
          xAxisLabel="Associate"
          yAxisLabel="Supervisor"
          cells={challengePatterns
            .filter(p => p.patternType === "associate_supervisor")
            .map(p => ({
              xLabel: p.associateName,
              yLabel: p.supervisorName ?? "Unknown",
              count: p.challengeCount,
              flagLevel: p.flagLevel,
              patternId: p.id,
            }))}
          onCellTap={cell =>
            setSelectedPattern(challengePatterns.find(p => p.id === cell.patternId))
          }
        />
      </>
    )}

    {/* Pattern detail bottom sheet — unchanged from RA2 */}
    {selectedPattern && (
      // ... keep existing bottom sheet exactly as written in RA2
    )}
  </div>
)}
```

---

## Verify

Run:

```bash
npm run build
```

**Test heatmap rendering:**
1. Insert test rows into `challenge_patterns` in Supabase:
```sql
INSERT INTO challenge_patterns (
  store_id, org_id, task_name, associate_name, supervisor_name,
  pattern_type, challenge_count, flag_level
) VALUES
  ('YOUR_STORE_ID', 'YOUR_ORG_ID', 'Dishes', 'Joshua W.', null, 'associate_task', 3, 'retrain'),
  ('YOUR_STORE_ID', 'YOUR_ORG_ID', 'Dishes', 'Brandon C.', 'Jan S.', 'supervisor_task', 2, 'sop_review'),
  ('YOUR_STORE_ID', 'YOUR_ORG_ID', 'Fryer', 'Joshua W.', 'Jan S.', 'associate_supervisor', 3, 'bias_review');
```

2. Store Manager → HR tab
3. Three heatmaps render
4. Cells colored by flag level: white=watch, orange=retrain, yellow=SOP, red=bias
5. Cell intensity increases with count (dim at 1, bright at 3+)
6. Tap a cell → pattern detail modal
7. "Mark Resolved" removes it

Build must pass with zero TypeScript errors before you stop.
