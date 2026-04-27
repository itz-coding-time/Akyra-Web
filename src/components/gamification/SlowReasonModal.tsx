import { useState } from "react"
import { X, Wrench } from "lucide-react"

interface SlowReasonModalProps {
  taskName: string
  onSubmit: (category: string, notes: string | null) => void
  onEquipmentIssue: () => void
  onDismiss: () => void
}

const REASONS = [
  { id: "long_line", label: "Long line", icon: undefined },
  { id: "high_volume", label: "High volume", icon: undefined },
  { id: "broken_equipment", label: "Broken equipment", icon: <Wrench className="w-3.5 h-3.5" /> },
  { id: "na", label: "N/A", icon: undefined },
]

export function SlowReasonModal({
  taskName,
  onSubmit,
  onEquipmentIssue,
  onDismiss,
}: SlowReasonModalProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [otherText, setOtherText] = useState("")
  const [showOther, setShowOther] = useState(false)

  function handleSelect(id: string) {
    if (id === "broken_equipment") {
      onEquipmentIssue()
      return
    }
    setSelected(id)
    setShowOther(false)
  }

  function handleSubmit() {
    if (!selected && !showOther) return
    const category = showOther ? "other" : selected!
    const notes = showOther ? otherText : null
    onSubmit(category, notes)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onDismiss} />
      <div className="relative w-full max-w-lg bg-akyra-surface border-t border-akyra-border rounded-t-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-white">What happened?</p>
            <p className="text-xs text-akyra-secondary font-mono mt-0.5">{taskName}</p>
          </div>
          <button onClick={onDismiss} className="text-akyra-secondary hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          {REASONS.map(reason => (
            <button
              key={reason.id}
              onClick={() => handleSelect(reason.id)}
              className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center gap-2 ${
                selected === reason.id
                  ? "border-white bg-white/10 text-white"
                  : "border-akyra-border text-akyra-secondary hover:border-white/40"
              }`}
            >
              {reason.icon}
              <span className="text-sm">{reason.label}</span>
            </button>
          ))}

          <button
            onClick={() => { setShowOther(true); setSelected(null) }}
            className={`w-full text-left p-3.5 rounded-xl border transition-all ${
              showOther
                ? "border-white bg-white/10 text-white"
                : "border-akyra-border text-akyra-secondary hover:border-white/40"
            }`}
          >
            <span className="text-sm">Other...</span>
          </button>

          {showOther && (
            <input
              type="text"
              placeholder="What happened?"
              value={otherText}
              onChange={e => setOtherText(e.target.value)}
              autoFocus
              className="w-full bg-akyra-black border border-akyra-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white"
            />
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!selected && !(showOther && otherText.trim())}
          className="w-full py-3 rounded-xl bg-white text-black font-bold disabled:opacity-50"
        >
          Submit
        </button>
      </div>
    </div>
  )
}
