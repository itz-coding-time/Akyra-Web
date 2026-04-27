import { X } from "lucide-react"
import type { Database } from "../../types/database.types"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

interface SOPViewerProps {
  task: Task
  onDismiss: () => void
}

export function SOPViewer({ task, onDismiss }: SOPViewerProps) {
  const hasSOP = !!(task as any).sop_content || !!(task as any).sop_photo_url

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onDismiss} />
      <div className="relative w-full max-w-lg bg-akyra-surface border-t border-akyra-border rounded-t-2xl p-6 space-y-4 max-h-[75vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-white">{task.task_name}</p>
            <p className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary mt-0.5">
              Standard Operating Procedure
            </p>
          </div>
          <button onClick={onDismiss} className="text-akyra-secondary hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {hasSOP ? (
          <>
            {(task as any).sop_content && (
              <div className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                {(task as any).sop_content}
              </div>
            )}
            {(task as any).sop_photo_url && (
              <img
                src={(task as any).sop_photo_url}
                alt="SOP reference"
                className="w-full rounded-xl border border-akyra-border"
              />
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-white/40 text-sm">No SOP has been added for this task yet.</p>
            <p className="text-white/20 text-xs font-mono mt-2">
              Supervisors can add SOPs from the task management view.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
