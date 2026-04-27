import { useEffect, useState } from "react"
import { AlertTriangle, ShieldAlert } from "lucide-react"
import { supabase } from "../../lib/supabase"
import {
  fetchActiveAssistanceRequests,
  resolveAssistanceRequest,
} from "../../lib"
import { LoadingSpinner } from "../LoadingSpinner"

interface AssistancePanelProps {
  storeId: string
  supervisorAssociateId: string
}

export function AssistancePanel({ storeId, supervisorAssociateId }: AssistancePanelProps) {
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof fetchActiveAssistanceRequests>>>([])
  const [resolving, setResolving] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function loadRequests() {
    const data = await fetchActiveAssistanceRequests(storeId)
    setRequests(data)
  }

  useEffect(() => {
    loadRequests()

    const channel = supabase
      .channel(`assistance-${storeId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "assistance_requests",
        filter: `store_id=eq.${storeId}`,
      }, loadRequests)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId])

  async function handleResolve(requestId: string, _level: number) {
    setResolving(requestId)
    setErrors(prev => ({ ...prev, [requestId]: "" }))

    const result = await resolveAssistanceRequest(requestId, supervisorAssociateId)

    if (result.success) {
      setRequests(prev => prev.filter(r => r.id !== requestId))
    } else {
      setErrors(prev => ({ ...prev, [requestId]: result.message }))
    }
    setResolving(null)
  }

  if (requests.length === 0) return null

  return (
    <div className="space-y-3">
      <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
        Assistance Needed · {requests.length}
      </p>

      {requests.map(req => (
        <div
          key={req.id}
          className={`border rounded-xl p-4 space-y-3 ${
            req.level === 2
              ? "border-[#E63946]/60 bg-[#E63946]/10 animate-pulse"
              : "border-yellow-500/40 bg-yellow-500/5"
          }`}
        >
          <div className="flex items-start gap-2">
            {req.level === 2
              ? <ShieldAlert className="w-4 h-4 text-[#E63946] mt-0.5 shrink-0" />
              : <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
            }
            <div>
              <p className={`text-sm font-bold ${req.level === 2 ? "text-[#E63946]" : "text-yellow-400"}`}>
                {req.level === 2 ? "DANGER" : "Assistance Needed"}
              </p>
              <p className="text-sm text-white">{req.associateName} — {req.taskName}</p>
              <p className="text-[10px] font-mono text-white/40">
                {new Date(req.createdAt).toLocaleTimeString("en-US", {
                  hour: "2-digit", minute: "2-digit"
                })}
              </p>
            </div>
          </div>

          {req.level === 2 && req.supervisorCode && (
            <div className="space-y-2">
              <p className="text-[10px] font-mono text-white/40">
                Your code (share verbally with associate):
              </p>
              <p className="text-2xl font-black font-mono text-white tracking-[0.3em]">
                {req.supervisorCode}
              </p>
              <p className="text-[10px] font-mono text-white/40">
                Associate must enter this code to clear the alert.
              </p>
            </div>
          )}

          {req.level === 1 && (
            <button
              onClick={() => handleResolve(req.id, req.level)}
              disabled={resolving === req.id}
              className="w-full py-2 rounded-lg border border-yellow-400/30 text-yellow-400 text-xs font-mono uppercase tracking-widest hover:bg-yellow-400/10 transition-colors disabled:opacity-50"
            >
              {resolving === req.id
                ? <LoadingSpinner size="sm" />
                : "Mark Resolved"
              }
            </button>
          )}

          {errors[req.id] && (
            <p className="text-[#E63946] text-xs font-mono">{errors[req.id]}</p>
          )}
        </div>
      ))}
    </div>
  )
}
