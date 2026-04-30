import { useState } from "react"
import { X } from "lucide-react"
import { sendPing } from "../../lib"
import { LoadingSpinner } from "../LoadingSpinner"

interface ArchetypeOfferModalProps {
  taskId: string
  taskName: string
  storeId: string
  fromAssociateId: string
  fromAssociateName: string
  orgStations: string[]
  onDismiss: () => void
  onOffered: () => void
}

export function ArchetypeOfferModal({
  taskId,
  taskName,
  storeId,
  fromAssociateId,
  fromAssociateName,
  orgStations,
  onDismiss,
  onOffered,
}: ArchetypeOfferModalProps) {
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)

  async function handleOffer() {
    if (!selectedArchetype) return
    setIsSending(true)

    await sendPing(
      storeId,
      fromAssociateId,
      `${fromAssociateName} is offering: "${taskName}" — want it?`,
      "task_offer",
      {
        targetArchetype: selectedArchetype,
        taskId,
      }
    )

    setIsSending(false)
    onOffered()
  }

  const claimableStations = orgStations.filter(s => s !== "MOD")

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onDismiss} />
      <div className="relative w-full max-w-lg bg-akyra-surface border-t border-akyra-border rounded-t-2xl p-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-white">Offer to Squad</p>
            <p className="text-xs text-akyra-secondary font-mono">{taskName}</p>
          </div>
          <button onClick={onDismiss} className="text-akyra-secondary hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-akyra-secondary">
          Which station gets the ping?
        </p>

        <div className="space-y-2">
          {claimableStations.map(station => (
            <button
              key={station}
              onClick={() => setSelectedArchetype(station)}
              className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                selectedArchetype === station
                  ? "border-white bg-white/10 text-white"
                  : "border-akyra-border text-akyra-secondary hover:border-white/40"
              }`}
            >
              <span className="text-sm">{station}</span>
            </button>
          ))}
        </div>

        <button
          onClick={handleOffer}
          disabled={!selectedArchetype || isSending}
          className="w-full py-3 rounded-xl bg-white text-black font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSending ? <><LoadingSpinner size="sm" /> Sending...</> : "Send Offer"}
        </button>
      </div>
    </div>
  )
}
