import { useState } from "react"
import { startShift } from "../lib"
import { LoadingSpinner } from "./LoadingSpinner"
import { PlayCircle } from "lucide-react"

interface ShiftResetButtonProps {
  storeId: string
  onComplete: () => void
}

type ResetState =
  | { stage: "idle" }
  | { stage: "confirming" }
  | { stage: "resetting" }
  | { stage: "done"; tasksReset: number; itemsReset: number }

export function ShiftResetButton({ storeId, onComplete }: ShiftResetButtonProps) {
  const [state, setState] = useState<ResetState>({ stage: "idle" })

  async function handleReset() {
    setState({ stage: "resetting" })

    const result = await startShift(storeId)

    setState({
      stage: "done",
      tasksReset: result.tasksReset,
      itemsReset: result.itemsReset,
    })

    // Notify parent to refetch all data
    setTimeout(() => {
      setState({ stage: "idle" })
      onComplete()
    }, 2500)
  }

  if (state.stage === "idle") {
    return (
      <button
        onClick={() => setState({ stage: "confirming" })}
        className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-akyra-secondary hover:text-white transition-colors border border-akyra-border rounded-lg px-3 py-2"
      >
        <PlayCircle className="w-3.5 h-3.5" />
        Start Shift
      </button>
    )
  }

  if (state.stage === "confirming") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-akyra-secondary">Reset all tasks?</span>
        <button
          onClick={handleReset}
          className="text-xs font-mono uppercase tracking-widest text-akyra-red hover:text-white transition-colors border border-akyra-red/40 rounded-lg px-3 py-2"
        >
          Confirm
        </button>
        <button
          onClick={() => setState({ stage: "idle" })}
          className="text-xs font-mono text-akyra-secondary hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  if (state.stage === "resetting") {
    return (
      <div className="flex items-center gap-2 text-akyra-secondary">
        <LoadingSpinner size="sm" />
        <span className="text-xs font-mono">Starting shift...</span>
      </div>
    )
  }

  // Done
  return (
    <div className="flex items-center gap-2 text-white">
      <span className="text-xs font-mono">
        ✓ {state.tasksReset} tasks reset, {state.itemsReset} items cleared
      </span>
    </div>
  )
}
