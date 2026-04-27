import { useRef, useState } from "react"
import type { Database } from "../types/database.types"
import { CheckCircle, AlertTriangle } from "lucide-react"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

interface TaskCardProps {
  task: Task
  isPersonal: boolean
  onComplete: (id: string) => void
  onClearOrphan?: (id: string) => void
  onHold?: (taskId: string, taskName: string, position: { x: number; y: number }) => void
  burnCards?: number
}

const priorityStyles: Record<string, string> = {
  Critical: "border-l-akyra-red border-l-2",
  High: "border-l-yellow-500 border-l-2",
  Normal: "border-l-transparent border-l-2",
  Low: "border-l-transparent border-l-2 opacity-70",
}

export function TaskCard({ task, isPersonal, onComplete, onClearOrphan, onHold }: TaskCardProps) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [isHolding, setIsHolding] = useState(false)

  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0]
    setIsHolding(false)
    holdTimer.current = setTimeout(() => {
      setIsHolding(true)
      const rect = cardRef.current?.getBoundingClientRect()
      const x = rect ? rect.left + rect.width / 2 : touch.clientX
      const y = rect ? rect.top + rect.height / 2 : touch.clientY
      onHold?.(task.id, task.task_name, { x, y })
    }, 500)
  }

  function handleTouchEnd() {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    setIsHolding(false)
  }

  const isOrphaned = task.is_orphaned === true

  return (
    <div
      ref={cardRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className={`bg-akyra-surface border rounded-xl p-4 flex items-start gap-3 transition-all select-none ${
        isHolding ? "scale-[0.97] opacity-80" : ""
      } ${
        isOrphaned
          ? "border-akyra-red border-l-4 border-l-akyra-red"
          : priorityStyles[task.priority] ?? ""
      }`}
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

          {isOrphaned && (
            <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest bg-akyra-red/20 text-akyra-red px-1.5 py-0.5 rounded animate-pulse">
              <AlertTriangle className="w-2.5 h-2.5" />
              Orphaned
            </span>
          )}

          {isPersonal && !isOrphaned && (
            <span className="text-[9px] font-mono uppercase tracking-widest bg-white/10 text-white px-1.5 py-0.5 rounded">
              Assigned
            </span>
          )}

          {task.priority === "Critical" && !isOrphaned && (
            <span className="text-[9px] font-mono uppercase tracking-widest bg-akyra-red/20 text-akyra-red px-1.5 py-0.5 rounded">
              Critical
            </span>
          )}
        </div>

        {task.task_description && (
          <p className="text-xs text-akyra-secondary mt-1">{task.task_description}</p>
        )}

        {isOrphaned && onClearOrphan && (
          <button
            onClick={() => onClearOrphan(task.id)}
            className="text-[10px] font-mono text-akyra-secondary hover:text-white transition-colors mt-1"
          >
            Clear orphan flag →
          </button>
        )}

        <p className="text-[9px] font-mono text-white/20 mt-2 uppercase tracking-widest">
          Hold to open actions
        </p>
      </div>
    </div>
  )
}
