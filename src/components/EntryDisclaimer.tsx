import { useState } from "react"
import { AkyraLogo } from "./AkyraLogo"

interface EntryDisclaimerProps {
  onAccept: () => void
}

export function EntryDisclaimer({ onAccept }: EntryDisclaimerProps) {
  const [isAccepting, setIsAccepting] = useState(false)

  function handleAccept() {
    setIsAccepting(true)
    localStorage.setItem("akyra_disclaimer_accepted", "true")
    setTimeout(onAccept, 300)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center px-8">

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-[50%] h-[50%] bg-white/[0.015] blur-[150px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[40%] h-[40%] bg-[#E63946]/[0.04] blur-[120px] rounded-full" />
      </div>

      <div className={`relative z-10 max-w-sm w-full space-y-8 text-center transition-opacity duration-300 ${isAccepting ? "opacity-0" : "opacity-100"}`}>

        <AkyraLogo className="w-12 h-12 mx-auto" />

        <div className="space-y-4">
          <h1 className="text-xl font-black text-white tracking-tight">
            Before you continue.
          </h1>

          <div className="space-y-3 text-white/50 text-sm leading-relaxed text-left">
            <p>
              Akyra is an in-development platform. All data is subject to erasure without notice.
            </p>
            <p>
              You are accessing this platform because you have been given expressed permission by its creator.
            </p>
            <p>
              Copying, cloning, or otherwise reproducing any part of this platform without written consent is prohibited and will result in legal action.
            </p>
            <p>
              By continuing, you acknowledge that usage data and interactions may be used for academic research on machine learning responses in volatile 24/7 operational environments.
            </p>
          </div>
        </div>

        <button
          onClick={handleAccept}
          className="w-full py-3.5 rounded-xl bg-white text-black font-bold text-sm hover:bg-white/90 transition-all active:scale-95"
        >
          I Understand — Continue
        </button>

        <p className="text-[10px] font-mono text-white/20 uppercase tracking-widest">
          © 2026 Akyra — All Rights Reserved
        </p>

      </div>
    </div>
  )
}
