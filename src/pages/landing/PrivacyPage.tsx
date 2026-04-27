import { useNavigate } from "react-router-dom"
import { AkyraLogo } from "../../components/AkyraLogo"

export function PrivacyPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <div className="relative z-10 max-w-lg w-full space-y-8">
        <div className="flex items-center gap-3">
          <AkyraLogo className="w-8 h-8" />
          <span className="font-black tracking-[0.15em] text-white">AKYRA</span>
        </div>

        <div className="space-y-5">
          <h1 className="text-2xl font-black">Privacy & Legal Notice</h1>

          <div className="space-y-4 text-white/60 leading-relaxed text-sm">
            <p>
              Akyra is an in-development platform. All data entered into this platform is subject to erasure at any time without notice. Do not enter any information you wish to retain permanently.
            </p>

            <p>
              This platform — including its design, code, architecture, and all associated intellectual property — is the exclusive property of Brandon Case. All rights reserved.
            </p>

            <p>
              You do not have permission to copy, clone, reproduce, redistribute, reverse engineer, or otherwise use any part of this platform or its underlying intellectual property without explicit written consent from the owner.
            </p>

            <p className="text-white font-semibold">
              Violation of these terms will result in legal action.
            </p>

            <p className="text-white/30">
              © 2026 Akyra. All rights reserved.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate("/")}
          className="text-xs font-mono text-white/30 hover:text-white transition-colors"
        >
          ← Back
        </button>
      </div>
    </div>
  )
}
