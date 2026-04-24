import { Alert, AlertDescription } from "./ui/alert"
import { X } from "lucide-react"
import { useState } from "react"

interface PastDueBannerProps {
  message: string
}

export function PastDueBanner({ message }: PastDueBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <Alert className="rounded-none border-x-0 border-t-0 border-b border-akyra-red/50 bg-akyra-red/10 text-white">
      <AlertDescription className="flex items-center justify-between gap-4">
        <span className="text-sm">{message}</span>
        <button
          onClick={() => setDismissed(true)}
          className="text-white/60 hover:text-white transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </AlertDescription>
    </Alert>
  )
}
