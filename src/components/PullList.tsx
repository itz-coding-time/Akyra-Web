import type { Database } from "../types/database.types"

type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"]

interface PullListProps {
  items: InventoryItem[]
  category: string
  onUpdateAmountHave: (id: string, amount: number) => void
}

function calcPullAmount(item: InventoryItem): number {
  const buildTo = item.amount_needed ?? 0
  const have = item.amount_have ?? 0
  return Math.max(0, buildTo - have)
}

export function PullList({ items, category, onUpdateAmountHave }: PullListProps) {
  if (items.length === 0) return null

  const totalToPull = items.reduce((sum, i) => sum + calcPullAmount(i), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
          {category} Pull List
        </p>
        {totalToPull > 0 && (
          <span className="text-xs font-mono text-white">
            {totalToPull} to pull
          </span>
        )}
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const toPull = calcPullAmount(item)
          return (
            <div
              key={item.id}
              className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
                toPull > 0
                  ? "border-white/20 bg-akyra-surface"
                  : "border-akyra-border bg-akyra-surface opacity-50"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{item.item_name}</p>
                <p className="text-xs text-akyra-secondary font-mono">
                  Pull: <span className={toPull > 0 ? "text-white font-bold" : ""}>{toPull}</span>
                  {" "}/ Build to: {item.amount_needed ?? "—"}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-akyra-secondary font-mono">Have:</span>
                <input
                  type="number"
                  min={0}
                  value={item.amount_have ?? ""}
                  onChange={(e) =>
                    onUpdateAmountHave(item.id, parseInt(e.target.value) || 0)
                  }
                  className="w-14 text-center bg-akyra-border border border-akyra-border rounded-lg py-1 text-white font-mono text-sm focus:outline-none focus:border-white"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
