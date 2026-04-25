import { useState } from "react"
import type { Database } from "../types/database.types"

type Task = Database["public"]["Tables"]["tasks"]["Row"]
type ActiveShift = Database["public"]["Tables"]["active_shifts"]["Row"]

interface AssignTaskSheetProps {
  task: Task
  activeShifts: ActiveShift[]
  onAssign: (taskId: string, associateId: string, associateName: string) => Promise<boolean>
  onClose: () => void
}

export function AssignTaskSheet({
  task,
  activeShifts,
  onAssign,
  onClose,
}: AssignTaskSheetProps) {
  const [isAssigning, setIsAssigning] = useState(false)
  const [assignedId, setAssignedId] = useState<string | null>(null)

  async function handleAssign(associateId: string, associateName: string) {
    setIsAssigning(true)
    setAssignedId(associateId)
    await onAssign(task.id, associateId, associateName)
    setIsAssigning(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-akyra-surface border border-akyra-border rounded-t-2xl p-6 space-y-4">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary mb-1">
            Assign Task
          </p>
          <p className="font-bold text-white">{task.task_name}</p>
          {task.task_description && (
            <p className="text-xs text-akyra-secondary mt-1">{task.task_description}</p>
          )}
        </div>

        <div className="space-y-2">
          {activeShifts.length === 0 ? (
            <p className="text-xs text-akyra-secondary py-4 text-center">
              No associates on shift.
            </p>
          ) : (
            activeShifts.map(shift => {
              const assoc = (shift as any).associates
              const name: string = assoc?.name ?? "Unknown"
              const station: string = shift.station ?? "—"
              return (
                <button
                  key={shift.id}
                  onClick={() => handleAssign(shift.associate_id, name)}
                  disabled={isAssigning}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                    assignedId === shift.associate_id
                      ? "border-white bg-white/10"
                      : "border-akyra-border hover:border-white/40"
                  }`}
                >
                  <div className="text-left">
                    <p className="text-sm font-semibold text-white">{name.split(" ")[0]}</p>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary">
                      {station}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-akyra-secondary">
                    {isAssigning && assignedId === shift.associate_id ? "Assigning…" : "Assign →"}
                  </span>
                </button>
              )
            })
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl border border-akyra-border text-xs font-mono text-akyra-secondary hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
