import type { Database } from "../types/database.types"
import { CheckCircle } from "lucide-react"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

interface TaskCardProps {
  task: Task
  isPersonal: boolean
  onComplete: (id: string) => void
}

const priorityStyles: Record<string, string> = {
  Critical: "border-l-akyra-red border-l-2",
  High: "border-l-yellow-500 border-l-2",
  Normal: "border-l-transparent border-l-2",
  Low: "border-l-transparent border-l-2 opacity-70",
}

export function TaskCard({ task, isPersonal, onComplete }: TaskCardProps) {
  return (
    <div
      className={`bg-akyra-surface border border-akyra-border rounded-xl p-4 flex items-start gap-3 ${priorityStyles[task.priority] ?? ""}`}
    >
      <button
        onClick={() => onComplete(task.id)}
        className="mt-0.5 shrink-0 text-akyra-secondary hover:text-white transition-colors"
      >
        <CheckCircle className="w-5 h-5" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-white text-sm">{task.task_name}</p>
          {isPersonal && (
            <span className="text-[9px] font-mono uppercase tracking-widest bg-white/10 text-white px-1.5 py-0.5 rounded">
              Assigned
            </span>
          )}
          {task.priority === "Critical" && (
            <span className="text-[9px] font-mono uppercase tracking-widest bg-akyra-red/20 text-akyra-red px-1.5 py-0.5 rounded">
              Critical
            </span>
          )}
        </div>
        {task.task_description && (
          <p className="text-xs text-akyra-secondary mt-1">{task.task_description}</p>
        )}
      </div>
    </div>
  )
}
