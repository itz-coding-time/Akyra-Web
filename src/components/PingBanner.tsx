import { useState, useEffect } from "react"
import { Bell, X, CheckCircle } from "lucide-react"
import { supabase } from "../lib/supabase"
import { fetchActivePingsForAssociate, acknowledgePing, acceptTaskOffer } from "../lib"
import { LoadingSpinner } from "./LoadingSpinner"

interface PingBannerProps {
  storeId: string
  associateId: string
  associateName: string
  archetype: string
  defaultStartTime: string
}

export function PingBanner({
  storeId,
  associateId,
  associateName,
  archetype,
  defaultStartTime,
}: PingBannerProps) {
  const [pings, setPings] = useState<any[]>([])
  const [accepting, setAccepting] = useState<string | null>(null)

  async function loadPings() {
    const data = await fetchActivePingsForAssociate(storeId, associateId, archetype)
    setPings(data)
  }

  useEffect(() => {
    loadPings()

    const channel = supabase
      .channel(`pings-${associateId}`)
      .on("postgres_changes" as any, {
        event: "INSERT",
        schema: "public",
        table: "pings",
        filter: `store_id=eq.${storeId}`,
      }, () => { loadPings() })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, associateId, archetype])

  if (pings.length === 0) return null

  const ping = pings[0]

  async function handleDismiss() {
    await acknowledgePing(ping.id, associateId)
    setPings(prev => prev.slice(1))
  }

  async function handleAcceptTask() {
    if (!ping.taskId) return
    setAccepting(ping.id)
    await acceptTaskOffer(
      ping.id,
      ping.taskId,
      associateId,
      associateName,
      ping.fromAssociateId,
      storeId,
      defaultStartTime
    )
    setAccepting(null)
    setPings(prev => prev.slice(1))
  }

  const isTaskOffer = ping.pingType === "task_offer"

  return (
    <div className="fixed top-0 inset-x-0 z-40 px-4 pt-4">
      <div className={`w-full max-w-lg mx-auto border rounded-2xl p-4 shadow-lg ${
        isTaskOffer
          ? "bg-akyra-surface border-white/30"
          : "bg-akyra-surface border-akyra-border"
      }`}>
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
            isTaskOffer ? "bg-white/10" : "bg-akyra-red/20"
          }`}>
            <Bell className={`w-4 h-4 ${isTaskOffer ? "text-white" : "text-akyra-red"}`} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{ping.fromName}</p>
            <p className="text-sm text-white/70 mt-0.5">{ping.message}</p>
            {pings.length > 1 && (
              <p className="text-[10px] font-mono text-akyra-secondary mt-1">
                +{pings.length - 1} more
              </p>
            )}
          </div>

          <button onClick={handleDismiss} className="text-akyra-secondary hover:text-white shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isTaskOffer && ping.taskId && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleDismiss}
              className="flex-1 py-2 rounded-xl border border-akyra-border text-akyra-secondary text-xs font-mono"
            >
              Pass
            </button>
            <button
              onClick={handleAcceptTask}
              disabled={accepting === ping.id}
              className="flex-1 py-2 rounded-xl bg-white text-black text-xs font-bold flex items-center justify-center gap-1.5"
            >
              {accepting === ping.id ? (
                <><LoadingSpinner size="sm" /> Taking it...</>
              ) : (
                <><CheckCircle className="w-3.5 h-3.5" /> I got it</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
