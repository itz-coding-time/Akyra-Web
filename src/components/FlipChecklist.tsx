import type { Database } from "../types/database.types"
import { AlertTriangle } from "lucide-react"

type TableItem = Database["public"]["Tables"]["table_items"]["Row"]

interface FlipChecklistProps {
  items: TableItem[]
  station: string
  onToggle: (id: string, current: boolean) => void
}

export function FlipChecklist({ items, station, onToggle }: FlipChecklistProps) {
  if (items.length === 0) return null

  const flaggedCount = items.filter((i) => !i.is_initialed).length

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
          {station} Flip Checklist
        </p>
        {flaggedCount > 0 && (
          <div className="flex items-center gap-1 text-akyra-red">
            <AlertTriangle className="w-3 h-3" />
            <span className="text-xs font-mono">{flaggedCount} flagged</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onToggle(item.id, item.is_initialed)}
            className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
              item.is_initialed
                ? "border-akyra-border bg-akyra-surface"
                : "border-akyra-red/50 bg-akyra-red/10"
            }`}
          >
            <span className="text-sm text-white">{item.item_name}</span>
            <span
              className={`text-xs font-mono uppercase tracking-widest ${
                item.is_initialed ? "text-akyra-secondary" : "text-akyra-red"
              }`}
            >
              {item.is_initialed ? "✓ Done" : "⚠ Flag"}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
