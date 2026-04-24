import { useState } from "react"
import type { Database } from "../types/database.types"
import { confirmPull } from "../lib"
import { LoadingSpinner } from "./LoadingSpinner"

type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"]

interface PullListProps {
  items: InventoryItem[]
  category: string
  storeId: string
  onUpdateAmountHave: (id: string, amount: number) => void
  onPullConfirmed?: () => void
}

function calcPullAmount(item: InventoryItem): number {
  const buildTo = item.amount_needed ?? 0
  const have = item.amount_have ?? 0
  return Math.max(0, buildTo - have)
}

export function PullList({
  items,
  category,
  storeId,
  onUpdateAmountHave,
  onPullConfirmed,
}: PullListProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  if (items.length === 0) return null

  const itemsToPull = items.filter(i => calcPullAmount(i) > 0)
  const totalToPull = itemsToPull.reduce((sum, i) => sum + calcPullAmount(i), 0)

  async function handleConfirmPull() {
    if (itemsToPull.length === 0) return
    setIsConfirming(true)

    const success = await confirmPull(
      storeId,
      itemsToPull.map(item => ({
        itemId: item.id,
        itemName: item.item_name,
        category: item.category,
        quantityPulled: calcPullAmount(item),
        codeLifeDays: (item as any).code_life_days ?? 0,
      }))
    )

    setIsConfirming(false)
    if (success) {
      setConfirmed(true)
      onPullConfirmed?.()
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
          {category} Pull List
        </p>
        {totalToPull > 0 && !confirmed && (
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
                  {(item as any).code_life_days && toPull > 0 && (
                    <span className="text-akyra-secondary">
                      {" "}· {(item as any).code_life_days}d code
                    </span>
                  )}
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
                  disabled={confirmed}
                  className="w-14 text-center bg-akyra-border border border-akyra-border rounded-lg py-1 text-white font-mono text-sm focus:outline-none focus:border-white disabled:opacity-50"
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Confirm Pull button */}
      {totalToPull > 0 && (
        <div className="mt-4">
          {confirmed ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/20">
              <span className="text-xs font-mono text-white">
                ✓ {category} pull confirmed — codes logged
              </span>
            </div>
          ) : (
            <button
              onClick={handleConfirmPull}
              disabled={isConfirming}
              className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isConfirming ? (
                <>
                  <LoadingSpinner size="sm" />
                  Logging codes...
                </>
              ) : (
                `Confirm ${category} Pull · ${totalToPull} items`
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
