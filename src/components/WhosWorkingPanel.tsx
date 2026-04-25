import { useEffect, useState } from "react"
import { fetchActiveShiftsWithCurrentTask } from "../lib"
import { LoadingSpinner } from "./LoadingSpinner"
import { Users } from "lucide-react"

const STATION_EMOJI: Record<string, string> = {
  Kitchen: "🍳",
  POS: "🖥️",
  Float: "⚡",
  MOD: "👑",
  "Float-Kitchen": "⚡→🍳",
  "Float-POS": "⚡→🖥️",
}

interface WhosWorkingPanelProps {
  storeId: string
  myAssociateId: string
}

export function WhosWorkingPanel({ storeId, myAssociateId }: WhosWorkingPanelProps) {
  const [crew, setCrew] = useState<Array<{
    associateId: string
    associateName: string
    station: string
    currentTask: string | null
  }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setIsLoading(true)
    fetchActiveShiftsWithCurrentTask(storeId, myAssociateId)
      .then(data => {
        setCrew(data)
        setIsLoading(false)
      })
  }, [storeId, myAssociateId, isOpen])

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-akyra-secondary hover:text-white transition-colors border border-akyra-border rounded-lg px-3 py-2"
      >
        <Users className="w-3.5 h-3.5" />
        Who's On?
      </button>

      {isOpen && (
        <div className="mt-3 bg-akyra-surface border border-akyra-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-6">
              <LoadingSpinner size="sm" />
            </div>
          ) : crew.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs font-mono text-akyra-secondary">
                No one else on shift yet.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-akyra-border">
              {crew.map(person => (
                <div key={person.associateId} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">
                        {STATION_EMOJI[person.station] ?? "❓"}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {person.associateName.split(" ")[0]}
                        </p>
                        <p className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary">
                          {person.station}
                        </p>
                      </div>
                    </div>
                    {person.currentTask && (
                      <p className="text-xs text-akyra-secondary text-right max-w-[120px] truncate">
                        {person.currentTask}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
