import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AkyraLogo } from "../../components/AkyraLogo"
import { usePwaInstall } from "../../hooks"
import { Download, ArrowRight, Zap, Shield, BarChart3, Wrench, Users, Clock } from "lucide-react"

export function LandingPage() {
  const navigate = useNavigate()
  const { canInstall, isInstalled, promptInstall } = usePwaInstall()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handler)
    return () => window.removeEventListener("scroll", handler)
  }, [])

  const features = [
    {
      icon: Users,
      title: "Live Station Board",
      description: "See who claimed what station in real time. Reassign on the fly. No radios, no shouting across the store.",
    },
    {
      icon: BarChart3,
      title: "Pacing Intelligence",
      description: "Task completion vs time elapsed, per associate, per shift. Know who's ahead before they fall behind.",
    },
    {
      icon: Zap,
      title: "Ghost Protocol",
      description: "Sessions expire automatically. Orphaned tasks escalate to Critical and surface for the incoming MOD.",
    },
    {
      icon: Shield,
      title: "Trust But Verify",
      description: "Associates mark tasks done. Supervisors confirm. Quality control built into every completed task.",
    },
    {
      icon: Clock,
      title: "Code Tracking",
      description: "Pull events create code dates automatically. Expiring items surface before the MOD has to check.",
    },
    {
      icon: Wrench,
      title: "Equipment Issues",
      description: "Associates flag broken equipment with photos. Supervisors track to resolution. No more lost sticky notes.",
    },
  ]

  return (
    <div className="min-h-screen bg-black text-white">

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-white/[0.015] blur-[150px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[40%] h-[40%] bg-[#E63946]/[0.04] blur-[120px] rounded-full" />
      </div>

      {/* Nav */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-black/80 backdrop-blur-md border-b border-white/10" : ""
      }`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AkyraLogo className="w-7 h-7" />
            <span className="font-black tracking-[0.15em] text-white">AKYRA</span>
          </div>

          <div className="flex items-center gap-4">
            {isInstalled ? (
              <button
                onClick={() => navigate("/app/login")}
                className="flex items-center gap-2 text-sm font-semibold bg-white text-black px-4 py-2 rounded-full hover:bg-white/90 transition-colors"
              >
                Open App
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : canInstall ? (
              <button
                onClick={promptInstall}
                className="flex items-center gap-2 text-sm font-semibold bg-white text-black px-4 py-2 rounded-full hover:bg-white/90 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Install Akyra
              </button>
            ) : (
              <button
                onClick={() => navigate("/app/login")}
                className="flex items-center gap-2 text-sm font-semibold border border-white/20 text-white px-4 py-2 rounded-full hover:border-white/60 transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-40 pb-24 px-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.3em] text-white/40 border border-white/10 rounded-full px-4 py-2 mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-[#E63946] animate-pulse" />
          Shift Intelligence Platform
        </div>

        <h1 className="text-5xl sm:text-7xl font-black leading-[0.95] tracking-tight mb-6">
          What happens
          <br />
          <span className="text-white/30">on the floor</span>
          <br />
          stays on record.
        </h1>

        <p className="text-lg text-white/50 max-w-xl mx-auto mb-10 leading-relaxed">
          Akyra manages the operational black hole of the 24/7 shift — task tracking, labor visibility, code management, and real-time accountability. Built for the floor, not the office.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          {canInstall ? (
            <button
              onClick={promptInstall}
              className="flex items-center gap-2 bg-white text-black font-bold px-6 py-3.5 rounded-full hover:bg-white/90 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              Install Akyra
            </button>
          ) : (
            <button
              onClick={() => navigate("/app/login")}
              className="flex items-center gap-2 bg-white text-black font-bold px-6 py-3.5 rounded-full hover:bg-white/90 transition-all active:scale-95"
            >
              Open Akyra
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Hero stat pills */}
        <div className="flex items-center justify-center gap-3 mt-12 flex-wrap">
          {[
            "Real-time station board",
            "10-hour session TTL",
            "Trust-But-Verify",
            "PWA — no app store",
          ].map(label => (
            <span
              key={label}
              className="text-[10px] font-mono uppercase tracking-widest text-white/30 border border-white/10 rounded-full px-3 py-1.5"
            >
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 hover:border-white/20 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                <Icon className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-bold text-white mb-2">{title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <AkyraLogo className="w-5 h-5" />
            <span className="font-black tracking-[0.15em] text-white/60 text-sm">AKYRA</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-white/30 font-mono">
            <span>© 2026 Akyra</span>
            <button onClick={() => navigate("/about")} className="hover:text-white transition-colors">About</button>
            <button onClick={() => navigate("/privacy")} className="hover:text-white transition-colors">Privacy</button>
          </div>
        </div>
      </footer>
    </div>
  )
}
