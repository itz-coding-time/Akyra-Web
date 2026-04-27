import { useState } from "react"
import { Plus, X } from "lucide-react"
import type { Database } from "../types/database.types"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

const ARCHETYPES = ["Kitchen", "POS", "Float", "MOD"]
const PRIORITIES = ["Normal", "High", "Critical"]

interface CreateTaskFABProps {
  isCreating: boolean
  onCreateTask: (taskName: string, archetype: string, priority: string) => Promise<Task | null>
}

export function CreateTaskFAB({ isCreating, onCreateTask }: CreateTaskFABProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [taskName, setTaskName] = useState("")
  const [archetype, setArchetype] = useState("Kitchen")
  const [priority, setPriority] = useState("Normal")

  async function handleSubmit() {
    const name = taskName.trim()
    if (!name) return
    const result = await onCreateTask(name, archetype, priority)
    if (result) {
      setTaskName("")
      setArchetype("Kitchen")
      setPriority("Normal")
      setIsOpen(false)
    }
  }

  return (
    <>
      {/* Backdrop when open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sheet */}
      {isOpen && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-50">
          <div className="bg-akyra-surface border border-akyra-border rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary">
                Create Task
              </p>
              <button onClick={() => setIsOpen(false)}>
                <X className="w-4 h-4 text-akyra-secondary hover:text-white transition-colors" />
              </button>
            </div>

            <input
              type="text"
              placeholder="Task name…"
              value={taskName}
              onChange={e => setTaskName(e.target.value)}
              className="w-full bg-akyra-black border border-akyra-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-akyra-secondary focus:outline-none focus:border-white/40"
            />

            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary mb-2">
                Station
              </p>
              <div className="flex gap-2 flex-wrap">
                {ARCHETYPES.map(a => (
                  <button
                    key={a}
                    onClick={() => setArchetype(a)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                      archetype === a
                        ? "border-white bg-white/10 text-white"
                        : "border-akyra-border text-akyra-secondary hover:border-white/40"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary mb-2">
                Priority
              </p>
              <div className="flex gap-2">
                {PRIORITIES.map(p => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                      priority === p
                        ? "border-white bg-white/10 text-white"
                        : "border-akyra-border text-akyra-secondary hover:border-white/40"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!taskName.trim() || isCreating}
              className={`w-full py-2.5 rounded-xl text-sm font-mono transition-all ${
                taskName.trim() && !isCreating
                  ? "bg-white text-black hover:bg-white/90"
                  : "bg-akyra-surface text-akyra-secondary cursor-not-allowed border border-akyra-border"
              }`}
            >
              {isCreating ? "Creating…" : "Create Task"}
            </button>
          </div>
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-4 z-50 w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:bg-white/90 transition-all active:scale-95"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
      </button>
    </>
  )
}
