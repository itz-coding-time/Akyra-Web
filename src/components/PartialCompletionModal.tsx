import { useState } from "react"
import { markTaskPartial } from "../lib"
import { LoadingSpinner } from "./LoadingSpinner"
import { X } from "lucide-react"

interface PartialCompletionModalProps {
  taskId: string
  taskName: string
  associateName: string
  onSaved: () => void
  onDismiss: () => void
}

export function PartialCompletionModal({
  taskId,
  taskName,
  associateName,
  onSaved,
  onDismiss,
}: PartialCompletionModalProps) {
  const [progressPct, setProgressPct] = useState(50)
  const [notes, setNotes] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  async function handleSave() {
    setIsSaving(true)
    await markTaskPartial(taskId, progressPct, notes, associateName)
    setIsSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onDismiss} />
      <div className="relative w-full max-w-lg bg-akyra-surface border-t border-akyra-border rounded-t-2xl p-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-white">Partial Handoff</p>
            <p className="text-xs font-mono text-akyra-secondary">{taskName}</p>
          </div>
          <button onClick={onDismiss} className="text-akyra-secondary hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-akyra-secondary">
          How much is done? The next shift picks up where you left off.
        </p>

        {/* Progress slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono text-akyra-secondary uppercase tracking-widest">
              Progress
            </p>
            <p className="text-sm font-black text-white">{progressPct}%</p>
          </div>
          <input
            type="range"
            min={5}
            max={95}
            step={5}
            value={progressPct}
            onChange={e => setProgressPct(Number(e.target.value))}
            className="w-full accent-white"
          />
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <p className="text-xs font-mono text-akyra-secondary uppercase tracking-widest">
            Notes for next shift
          </p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Pulled items 1-3, ran out of time. Items 4-6 still needed."
            rows={3}
            className="w-full bg-akyra-black border border-akyra-border rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            className="flex-1 py-3 rounded-xl border border-akyra-border text-akyra-secondary text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-3 rounded-xl bg-white text-black font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? <><LoadingSpinner size="sm" /> Saving...</> : "Hand Off"}
          </button>
        </div>
      </div>
    </div>
  )
}
