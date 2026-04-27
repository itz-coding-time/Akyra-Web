import { useState } from "react"
import type { PullEventSummary } from "../types"
import { LoadingSpinner } from "./LoadingSpinner"
import { AlertTriangle, CheckCircle, ClipboardList } from "lucide-react"

interface CodeCheckPanelProps {
  expiringItems: PullEventSummary[]
  isActioning: string | null
  onVerifyUsedThrough: (summary: PullEventSummary) => Promise<void>
  onSubmitWaste: (summary: PullEventSummary, quantity: number) => Promise<void>
}

interface ItemActionState {
  mode: "idle" | "waste_entry"
  wasteQuantity: string
}

export function CodeCheckPanel({
  expiringItems,
  isActioning,
  onVerifyUsedThrough,
  onSubmitWaste,
}: CodeCheckPanelProps) {
  const [itemStates, setItemStates] = useState<Record<string, ItemActionState>>({})

  if (expiringItems.length === 0) return null

  function getItemState(itemId: string): ItemActionState {
    return itemStates[itemId] ?? { mode: "idle", wasteQuantity: "" }
  }

  function setItemState(itemId: string, state: Partial<ItemActionState>) {
    setItemStates(prev => ({
      ...prev,
      [itemId]: { ...getItemState(itemId), ...state },
    }))
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-3.5 h-3.5 text-akyra-red animate-pulse" />
        <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
          Code Check · {expiringItems.length} item{expiringItems.length > 1 ? "s" : ""} expiring
        </p>
      </div>

      <div className="space-y-3">
        {expiringItems.map(summary => {
          const itemState = getItemState(summary.itemId)
          const isThisActioning = isActioning === summary.itemId

          return (
            <div
              key={summary.itemId}
              className="bg-akyra-surface border border-akyra-red/40 rounded-xl p-4 space-y-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{summary.itemName}</p>
                  <p className="text-xs font-mono text-akyra-secondary mt-0.5">
                    Expires: {new Date(summary.expiresDate).toLocaleDateString("en-US", {
                      month: "short", day: "numeric"
                    })}
                    {" "}· Pulled {summary.totalPulled} / BT {summary.buildTo}
                  </p>
                </div>

                <span className={`text-[9px] font-mono uppercase tracking-widest px-2 py-1 rounded border ${
                  summary.likelyUsedThrough
                    ? "border-white/20 text-white"
                    : "border-akyra-red/40 text-akyra-red"
                }`}>
                  {summary.likelyUsedThrough ? "Likely used through" : "Possible waste"}
                </span>
              </div>

              {/* Actions */}
              {isThisActioning ? (
                <div className="flex items-center gap-2 text-akyra-secondary">
                  <LoadingSpinner size="sm" />
                  <span className="text-xs font-mono">Processing...</span>
                </div>
              ) : itemState.mode === "idle" ? (
                <div className="flex gap-2">
                  {summary.likelyUsedThrough ? (
                    <button
                      onClick={() => onVerifyUsedThrough(summary)}
                      className="flex items-center gap-1.5 text-xs font-mono text-white border border-white/20 rounded-lg px-3 py-2 hover:bg-white/10 transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Confirm Used Through
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => onVerifyUsedThrough(summary)}
                        className="flex items-center gap-1.5 text-xs font-mono text-white border border-white/20 rounded-lg px-3 py-2 hover:bg-white/10 transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Used Through
                      </button>
                      <button
                        onClick={() => setItemState(summary.itemId, { mode: "waste_entry" })}
                        className="flex items-center gap-1.5 text-xs font-mono text-akyra-red border border-akyra-red/40 rounded-lg px-3 py-2 hover:bg-akyra-red/10 transition-colors"
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                        Record Waste
                      </button>
                    </>
                  )}
                </div>
              ) : (
                // Waste entry mode
                <div className="space-y-2">
                  <p className="text-xs text-akyra-secondary font-mono">
                    How much was wasted?
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={itemState.wasteQuantity}
                      onChange={e => setItemState(summary.itemId, { wasteQuantity: e.target.value })}
                      placeholder="0"
                      className="w-20 text-center bg-akyra-black border border-akyra-border rounded-lg py-2 text-white font-mono text-sm focus:outline-none focus:border-white"
                      autoFocus
                    />
                    <span className="text-xs text-akyra-secondary font-mono">units</span>
                    <button
                      onClick={() => {
                        const qty = parseInt(itemState.wasteQuantity)
                        if (qty > 0) onSubmitWaste(summary, qty)
                      }}
                      disabled={!itemState.wasteQuantity || parseInt(itemState.wasteQuantity) <= 0}
                      className="flex items-center gap-1.5 text-xs font-mono text-white border border-white/20 rounded-lg px-3 py-2 hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                      Submit
                    </button>
                    <button
                      onClick={() => setItemState(summary.itemId, { mode: "idle", wasteQuantity: "" })}
                      className="text-xs font-mono text-akyra-secondary hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
