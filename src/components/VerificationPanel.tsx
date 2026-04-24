import type { Database } from "../types/database.types"
import { LoadingSpinner } from "./LoadingSpinner"
import { Check, X } from "lucide-react"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

interface VerificationPanelProps {
  pendingTasks: Task[]
  isVerifying: string | null
  onVerify: (taskId: string) => Promise<void>
  onReject: (taskId: string) => Promise<void>
}

export function VerificationPanel({
  pendingTasks,
  isVerifying,
  onVerify,
  onReject,
}: VerificationPanelProps) {
  if (pendingTasks.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
          Pending Verification
        </p>
        <span className="text-[9px] font-mono bg-akyra-red text-white px-1.5 py-0.5 rounded-full">
          {pendingTasks.length}
        </span>
      </div>

      <div className="space-y-2">
        {pendingTasks.map((task) => (
          <div
            key={task.id}
            className="bg-akyra-surface border border-yellow-500/30 rounded-xl p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">{task.task_name}</p>
                <p className="text-xs text-akyra-secondary font-mono mt-0.5">
                  Marked done by: {task.completed_by ?? "Unknown"}
                </p>
                <p className="text-[10px] font-mono uppercase tracking-widest text-yellow-500 mt-1">
                  Task complete — actually done?
                </p>
              </div>

              {isVerifying === task.id ? (
                <LoadingSpinner size="sm" />
              ) : (
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => onReject(task.id)}
                    className="w-8 h-8 rounded-full border border-akyra-red/50 flex items-center justify-center hover:bg-akyra-red/20 transition-colors"
                    title="Not done — send back"
                  >
                    <X className="w-4 h-4 text-akyra-red" />
                  </button>
                  <button
                    onClick={() => onVerify(task.id)}
                    className="w-8 h-8 rounded-full border border-white/30 flex items-center justify-center hover:bg-white/10 transition-colors"
                    title="Confirmed done"
                  >
                    <Check className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
