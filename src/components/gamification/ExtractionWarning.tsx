import { useEffect, useState } from "react"

interface ExtractionWarningProps {
  minutesRemaining: number
  onDismiss: () => void
}

export function ExtractionWarning({ minutesRemaining, onDismiss }: ExtractionWarningProps) {
  const isFinal = minutesRemaining <= 15
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => setVisible(true), 50)
  }, [])

  return (
    <div className={`fixed inset-x-0 top-0 z-40 transition-transform duration-500 ${
      visible ? "translate-y-0" : "-translate-y-full"
    }`}>
      <div className={`px-6 py-4 border-b ${
        isFinal
          ? "bg-[#E63946]/20 border-[#E63946]/50"
          : "bg-yellow-500/10 border-yellow-500/30"
      }`}>
        <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              isFinal ? "bg-[#E63946]" : "bg-yellow-400"
            }`} />
            <div>
              <p className={`text-sm font-bold ${
                isFinal ? "text-[#E63946]" : "text-yellow-400"
              }`}>
                {isFinal
                  ? "Extraction in 15 minutes."
                  : "Final hour. Finish strong."}
              </p>
              <p className="text-xs text-white/40 font-mono mt-0.5">
                {isFinal
                  ? "Critical tasks only. Everything else hands off."
                  : "High and Critical priority tasks take focus."}
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-white/30 hover:text-white transition-colors text-xs font-mono"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
