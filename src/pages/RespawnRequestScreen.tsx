import { useEffect, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import {
  requestRespawnPin,
  completeRespawn,
  registerPasskey,
  getCachedWelcomeCode,
} from "../lib"
import { AkyraLogo } from "../components/AkyraLogo"
import { LoadingSpinner } from "../components/LoadingSpinner"

interface RespawnRequestScreenProps {
  eeid: string
  onBack: () => void
}

type RespawnPhase =
  | "generating"
  | "waiting"
  | "standby"
  | "set-password"
  | "verified"
  | "reinforcing"
  | "welcome"
  | "expired"
  | "error"

export function RespawnRequestScreen({ eeid, onBack }: RespawnRequestScreenProps) {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<RespawnPhase>("generating")
  const [arrows, setArrows] = useState<string[]>([])
  const [channel, setChannel] = useState("")
  const [timeLeft, setTimeLeft] = useState(300)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [glowIntensity, setGlowIntensity] = useState(0)
  const channelRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const glowRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const welcomePhrase = getCachedWelcomeCode() ?? ""

  useEffect(() => {
    async function generate() {
      const result = await requestRespawnPin(eeid, welcomePhrase)
      if (!result) {
        setPhase("error")
        return
      }
      setArrows(result.arrows)
      setChannel(result.channel)
      setPhase("waiting")
    }
    generate()
  }, [eeid, welcomePhrase])

  // Countdown timer
  useEffect(() => {
    if (phase !== "waiting") return

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          setPhase("expired")
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase])

  // Realtime — listen for supervisor authorization
  useEffect(() => {
    if (!channel || phase !== "waiting") return

    channelRef.current = supabase
      .channel(channel)
      .on("broadcast", { event: "authorized" }, () => {
        if (timerRef.current) clearInterval(timerRef.current)
        setPhase("standby")
        setTimeout(() => setPhase("set-password"), 1200)
      })
      .subscribe()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [channel, phase])

  // Reinforcing glow animation
  useEffect(() => {
    if (phase !== "reinforcing") return

    let intensity = 0
    glowRef.current = setInterval(() => {
      intensity = Math.min(intensity + 0.04, 1)
      setGlowIntensity(intensity)
      if (intensity >= 1) {
        clearInterval(glowRef.current!)
        setTimeout(() => setPhase("welcome"), 800)
      }
    }, 40)

    return () => { if (glowRef.current) clearInterval(glowRef.current) }
  }, [phase])

  async function handleSetPassword() {
    if (newPassword.length < 8 || newPassword !== confirmPassword) return
    setIsLoading(true)
    setPhase("verified")
    await new Promise(r => setTimeout(r, 1000))
    setPhase("reinforcing")
    const success = await completeRespawn(eeid, welcomePhrase, newPassword, channel)
    if (!success) {
      setError("Something went wrong. Please try again.")
      setPhase("set-password")
    }
    try { await registerPasskey(eeid) } catch {}
    setIsLoading(false)
  }

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`

  const timerPct = (timeLeft / 300) * 100
  const isLow = timeLeft < 60

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-6"
      style={{
        background: phase === "reinforcing" || phase === "welcome"
          ? `rgb(0, ${Math.round(glowIntensity * 35)}, 0)`
          : "black",
        transition: "background 0.3s ease",
      }}
    >
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {phase === "reinforcing" || phase === "welcome" ? (
          <div
            className="absolute inset-0 blur-[200px] rounded-full"
            style={{ background: `rgba(0, 255, 80, ${glowIntensity * 0.12})` }}
          />
        ) : (
          <div className="absolute -top-[10%] left-[20%] w-[60%] h-[40%] bg-white/[0.01] blur-[150px] rounded-full" />
        )}
      </div>

      <div className="relative z-10 w-full max-w-sm">

        {/* ── GENERATING ── */}
        {phase === "generating" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <AkyraLogo className="w-8 h-8 opacity-30 animate-pulse" />
            <LoadingSpinner size="md" />
            <p className="text-white/20 text-xs font-mono uppercase tracking-widest">
              Generating Stratagem...
            </p>
          </div>
        )}

        {/* ── WAITING — Show Stratagem ── */}
        {phase === "waiting" && (
          <div className="space-y-10 text-center">
            <div className="space-y-1">
              <p className="text-[9px] font-mono uppercase tracking-[0.5em] text-white/20">
                Reinforcement Request
              </p>
              <p className="text-sm text-white/40">
                Show your supervisor this Stratagem.
              </p>
            </div>

            {/* Stratagem arrows */}
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4">
                {arrows.map((arrow, i) => (
                  <div
                    key={i}
                    className="w-14 h-14 rounded-xl bg-white/[0.05] border border-white/20 flex items-center justify-center"
                  >
                    <span className="text-3xl text-white select-none">{arrow}</span>
                  </div>
                ))}
              </div>
              <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest">
                Your Stratagem
              </p>
            </div>

            {/* Timer */}
            <div className="space-y-2">
              <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    isLow ? "bg-[#E63946]" : "bg-white/30"
                  }`}
                  style={{ width: `${timerPct}%` }}
                />
              </div>
              <p className={`text-xs font-mono ${isLow ? "text-[#E63946]" : "text-white/20"}`}>
                Expires in {formatTime(timeLeft)}
              </p>
            </div>

            <button
              onClick={onBack}
              className="text-[10px] font-mono text-white/15 hover:text-white/30 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── STANDBY ── */}
        {phase === "standby" && (
          <div className="text-center space-y-6">
            <AkyraLogo className="w-8 h-8 mx-auto opacity-30" />
            <div>
              <p className="text-[9px] font-mono uppercase tracking-[0.5em] text-white/20 mb-3">
                Stratagem Confirmed
              </p>
              <p className="text-3xl font-black text-white animate-pulse">
                STANDBY.
              </p>
            </div>
            <LoadingSpinner size="md" />
          </div>
        )}

        {/* ── SET PASSWORD ── */}
        {phase === "set-password" && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <p className="text-[9px] font-mono uppercase tracking-[0.5em] text-white/20">
                Identity Confirmed
              </p>
              <h2 className="text-2xl font-black text-white">
                Reset your password.
              </h2>
              <p className="text-sm text-white/40">
                Make it something you won't forget.
              </p>
            </div>

            <div className="space-y-3">
              <input
                type="password"
                placeholder="New password (min 8 chars)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoFocus
                className="w-full bg-white/[0.05] border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white"
              />
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white"
              />
            </div>

            {error && <p className="text-[#E63946] text-sm font-mono text-center">{error}</p>}
            {newPassword.length > 0 && newPassword.length < 8 && (
              <p className="text-white/20 text-xs font-mono text-center">
                At least 8 characters
              </p>
            )}
            {newPassword.length >= 8 && newPassword !== confirmPassword && (
              <p className="text-[#E63946] text-xs font-mono text-center">
                Passwords don't match
              </p>
            )}

            <button
              onClick={handleSetPassword}
              disabled={newPassword.length < 8 || newPassword !== confirmPassword || isLoading}
              className="w-full py-4 rounded-2xl bg-white text-black font-black disabled:opacity-30 flex items-center justify-center gap-2"
            >
              {isLoading ? <><LoadingSpinner size="sm" /> One moment...</> : "Confirm →"}
            </button>
          </div>
        )}

        {/* ── VERIFIED ── */}
        {phase === "verified" && (
          <div className="text-center space-y-6">
            <p className="text-[9px] font-mono uppercase tracking-[0.5em] text-white/20">
              Password Set
            </p>
            <p className="text-2xl font-black text-white animate-pulse">
              Verified. One moment...
            </p>
            <LoadingSpinner size="md" />
          </div>
        )}

        {/* ── REINFORCING ── */}
        {phase === "reinforcing" && (
          <div className="text-center space-y-6">
            <AkyraLogo
              className="w-12 h-12 mx-auto"
            />
            <p
              className="text-4xl font-black tracking-tight"
              style={{
                color: `rgba(${Math.round(glowIntensity * 200)}, 255, ${Math.round(glowIntensity * 80)}, 1)`,
              }}
            >
              REINFORCING!
            </p>
            <p className="text-xs font-mono text-white/20 animate-pulse">
              Syncing credentials · Linking profile · Restoring access
            </p>
          </div>
        )}

        {/* ── WELCOME BACK ── */}
        {phase === "welcome" && (
          <div className="text-center space-y-8">
            <AkyraLogo className="w-12 h-12 mx-auto" />
            <div className="space-y-2">
              <p className="text-4xl font-black text-white">
                Welcome back.
              </p>
              <p className="text-lg font-mono text-green-400/80">
                Time to be a Legend. 🎮
              </p>
            </div>
            <button
              onClick={() => navigate("/app/dashboard")}
              className="w-full py-4 rounded-2xl bg-white text-black font-black text-lg active:scale-[0.98] transition-transform"
            >
              Back on the floor →
            </button>
          </div>
        )}

        {/* ── EXPIRED ── */}
        {phase === "expired" && (
          <div className="text-center space-y-6">
            <p className="text-[#E63946] font-bold">Stratagem Expired</p>
            <p className="text-sm text-white/40">
              The stratagem timed out before your supervisor could enter it.
            </p>
            <button
              onClick={() => {
                setPhase("generating")
                setTimeLeft(300)
                setArrows([])
              }}
              className="w-full py-4 rounded-2xl bg-white text-black font-black"
            >
              Generate New Stratagem
            </button>
            <button
              onClick={onBack}
              className="text-[10px] font-mono text-white/15 hover:text-white/30 transition-colors"
            >
              ← Back to login
            </button>
          </div>
        )}

        {/* ── ERROR ── */}
        {phase === "error" && (
          <div className="text-center space-y-4">
            <p className="text-[#E63946] font-bold">Reinforcement Unavailable</p>
            <p className="text-sm text-white/40">
              Account not found. Check your EEID and Welcome Code, or contact your supervisor.
            </p>
            <button
              onClick={onBack}
              className="text-[10px] font-mono text-white/15 hover:text-white/30 transition-colors"
            >
              ← Back
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
