import { useNavigate } from "react-router-dom"
import { AkyraLogo } from "../../components/AkyraLogo"

export function AboutPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-white/[0.02] blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-lg w-full space-y-8">
        <div className="flex items-center gap-3">
          <AkyraLogo className="w-8 h-8" />
          <span className="font-black tracking-[0.15em] text-white">AKYRA</span>
        </div>

        <div className="space-y-6 text-white/70 leading-relaxed">
          <p className="text-xl font-bold text-white">
            Built for the floor. Not the office.
          </p>

          <p>
            Akyra is a shift intelligence platform built for the people actually on the floor. Not corporate. Not HR. The person at 2am figuring out what still needs to get done before the next crew walks in.
          </p>

          <p>
            It started as a frustration. Every shift tool either does too much — HR systems nobody actually uses — or too little — a group chat and a clipboard. Akyra lives in the middle. A fast, installable PWA that gives associates their task queue and gives supervisors live visibility into what's happening right now.
          </p>

          <p>
            Built by one person. Runs on every phone. No app store required.
          </p>
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
