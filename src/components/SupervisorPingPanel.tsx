import { useState } from "react"
import { Bell, X } from "lucide-react"
import { sendPing } from "../lib"
import { LoadingSpinner } from "./LoadingSpinner"

interface SupervisorPingPanelProps {
  storeId: string
  supervisorAssociateId: string
  activeAssociates: Array<{ id: string; name: string; station: string }>
  orgStations: string[]
}

type PingTarget = "all" | "archetype" | "direct"

export function SupervisorPingPanel({
  storeId,
  supervisorAssociateId,
  activeAssociates,
  orgStations,
}: SupervisorPingPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [target, setTarget] = useState<PingTarget>("all")
  const [selectedArchetype, setSelectedArchetype] = useState(orgStations[0] ?? "Kitchen")
  const [selectedAssociateId, setSelectedAssociateId] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSend() {
    if (!message.trim()) return
    setIsSending(true)

    await sendPing(
      storeId,
      supervisorAssociateId,
      message.trim(),
      target === "all" ? "all_hands" : target === "archetype" ? "general" : "direct",
      {
        toAssociateId: target === "direct" ? (selectedAssociateId ?? undefined) : undefined,
        targetArchetype: target === "archetype" ? selectedArchetype : undefined,
      }
    )

    setIsSending(false)
    setSent(true)
    setMessage("")
    setTimeout(() => {
      setSent(false)
      setIsOpen(false)
    }, 1500)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-akyra-secondary hover:text-white border border-akyra-border rounded-lg px-3 py-2 transition-colors"
      >
        <Bell className="w-3.5 h-3.5" />
        Ping
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setIsOpen(false)} />
          <div className="relative w-full max-w-lg bg-akyra-surface border-t border-akyra-border rounded-t-2xl p-6 space-y-4">

            <div className="flex items-center justify-between">
              <p className="font-bold text-white">Send Ping</p>
              <button onClick={() => setIsOpen(false)} className="text-akyra-secondary hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target selector */}
            <div className="grid grid-cols-3 gap-2">
              {(["all", "archetype", "direct"] as PingTarget[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTarget(t)}
                  className={`py-2 rounded-xl border text-xs font-mono uppercase tracking-widest transition-all ${
                    target === t
                      ? "border-white bg-white text-black"
                      : "border-akyra-border text-akyra-secondary hover:text-white"
                  }`}
                >
                  {t === "all" ? "All Hands" : t === "archetype" ? "Station" : "Direct"}
                </button>
              ))}
            </div>

            {/* Archetype selector */}
            {target === "archetype" && (
              <div className="flex gap-2 flex-wrap">
                {orgStations.map(s => (
                  <button
                    key={s}
                    onClick={() => setSelectedArchetype(s)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                      selectedArchetype === s
                        ? "border-white bg-white/10 text-white"
                        : "border-akyra-border text-akyra-secondary hover:text-white"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Direct associate selector */}
            {target === "direct" && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {activeAssociates.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAssociateId(a.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-all flex items-center justify-between ${
                      selectedAssociateId === a.id
                        ? "border-white bg-white/10 text-white"
                        : "border-akyra-border text-akyra-secondary hover:text-white"
                    }`}
                  >
                    <span className="text-sm">{a.name}</span>
                    <span className="text-[10px] font-mono">{a.station}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Message */}
            <input
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={
                target === "all" ? "Message to all associates..." :
                target === "archetype" ? `Message to ${selectedArchetype}...` :
                "Message..."
              }
              className="w-full bg-akyra-black border border-akyra-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white"
              autoFocus
            />

            <button
              onClick={handleSend}
              disabled={!message.trim() || isSending || sent || (target === "direct" && !selectedAssociateId)}
              className="w-full py-3 rounded-xl bg-white text-black font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSending ? <><LoadingSpinner size="sm" /> Sending...</> :
               sent ? "✓ Sent" :
               <><Bell className="w-4 h-4" /> Send Ping</>}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
