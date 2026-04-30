import { useState, useEffect, useRef } from "react"
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
  | "authorized"
  | "set-password"
  | "set-passkey"
  | "respawning"
  | "respawned"
  | "expired"
  | "error"

export function RespawnRequestScreen({ eeid, onBack }: RespawnRequestScreenProps) {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<RespawnPhase>("generating")
  const [pin, setPin] = useState("")
  const [channel, setChannel] = useState("")
  const [timeLeft, setTimeLeft] = useState(300)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [glowIntensity, setGlowIntensity] = useState(0)
  const channelRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const welcomePhrase = getCachedWelcomeCode() ?? ""

  // Generate PIN when phase is "generating"
  useEffect(() => {
    if (phase !== "generating") return
    async function generate() {
      const result = await requestRespawnPin(eeid, welcomePhrase)
      if (!result) {
        setPhase("error")
        return
      }
      setPin(result.pin)
      setChannel(result.channel)
      setPhase("waiting")
    }
    generate()
  }, [phase, eeid, welcomePhrase])

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

  // Realtime subscription — listen for supervisor authorization
  useEffect(() => {
    if (!channel || phase !== "waiting") return

    channelRef.current = supabase
      .channel(channel)
      .on("broadcast", { event: "authorized" }, () => {
        if (timerRef.current) clearInterval(timerRef.current)
        setPhase("authorized")
      })
      .subscribe()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [channel, phase])

  // Respawning animation
  useEffect(() => {
    if (phase !== "respawning") return

    let intensity = 0
    const interval = setInterval(() => {
      intensity = Math.min(intensity + 0.05, 1)
      setGlowIntensity(intensity)
      if (intensity >= 1) {
        clearInterval(interval)
        setTimeout(() => setPhase("respawned"), 1000)
      }
    }, 50)

    return () => clearInterval(interval)
  }, [phase])

  async function handleSetPassword() {
    if (newPassword.length < 8) return
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match")
      return
    }
    setPhase("set-passkey")
  }

  async function handleEnrollPasskey() {
    setIsLoading(true)
    const success = await completeRespawn(eeid, welcomePhrase, newPassword, channel)
    if (!success) {
      setError("Something went wrong. Please try again.")
      setIsLoading(false)
      return
    }

    try {
      await registerPasskey(eeid)
    } catch {
      console.log("[Respawn] Passkey enrollment skipped")
    }

    setIsLoading(false)
    setPhase("respawning")
  }

  async function handleSkipPasskey() {
    setIsLoading(true)
    const success = await completeRespawn(eeid, welcomePhrase, newPassword, channel)
    setIsLoading(false)
    if (success) {
      setPhase("respawning")
    } else {
      setError("Something went wrong. Please try again.")
    }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`
  const timerPct = (timeLeft / 300) * 100

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-6"
      style={{
        background: phase === "respawning" || phase === "respawned"
          ? `rgba(0, ${Math.round(glowIntensity * 40)}, 0, 1)`
          : "black",
        transition: "background 0.3s ease",
      }}
    >
      {/* Ambient glow — green when respawning */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {phase === "respawning" || phase === "respawned" ? (
          <div
            className="absolute inset-0 rounded-full blur-[200px]"
            style={{
              background: `rgba(0, 255, 100, ${glowIntensity * 0.15})`,
              transition: "all 0.1s ease",
            }}
          />
        ) : (
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-white/[0.02] blur-[120px] rounded-full" />
        )}
      </div>

      <div className="relative z-10 w-full max-w-sm">

        {/* Generating */}
        {phase === "generating" && (
          <div className="flex flex-col items-center gap-4">
            <AkyraLogo className="w-10 h-10 animate-pulse" />
            <LoadingSpinner size="md" />
            <p className="text-white/40 text-sm font-mono">Generating Respawn PIN...</p>
          </div>
        )}

        {/* Waiting — show PIN */}
        {phase === "waiting" && (
          <div className="space-y-8 text-center">
            <div>
              <AkyraLogo className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/30">
                Respawn Protocol
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-white/50">
                Show this PIN to your supervisor.
              </p>
              <div className="bg-white/5 border border-white/20 rounded-2xl p-8">
                <p className="text-5xl font-black font-mono text-white tracking-[0.3em] animate-pulse">
                  {pin}
                </p>
              </div>
            </div>

            {/* Countdown */}
            <div className="space-y-2">
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    timeLeft < 60 ? "bg-akyra-red" : "bg-white/40"
                  }`}
                  style={{ width: `${timerPct}%` }}
                />
              </div>
              <p className={`text-xs font-mono ${timeLeft < 60 ? "text-akyra-red" : "text-white/30"}`}>
                Expires in {formatTime(timeLeft)}
              </p>
            </div>

            <button
              onClick={onBack}
              className="text-xs font-mono text-white/20 hover:text-white/40 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Authorized — confirm identity */}
        {phase === "authorized" && (
          <div className="space-y-6 text-center">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-green-400/60 mb-2">
                Supervisor Confirmed
              </p>
              <h1 className="text-2xl font-black text-white">First things first.</h1>
              <p className="text-sm text-white/50 mt-1">Is this you?</p>
            </div>

            <div className="bg-white/5 border border-white/20 rounded-2xl p-6">
              <p className="text-2xl font-black text-white">{eeid}</p>
              <p className="text-xs font-mono text-white/30 mt-1">EEID</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onBack}
                className="flex-1 py-3 rounded-xl border border-akyra-border text-akyra-secondary font-semibold"
              >
                No
              </button>
              <button
                onClick={() => setPhase("set-password")}
                className="flex-1 py-3 rounded-xl bg-white text-black font-bold"
              >
                Yes, that's me
              </button>
            </div>
          </div>
        )}

        {/* Set password */}
        {phase === "set-password" && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-black text-white">Create a new password.</h1>
              <p className="text-sm text-white/50 mt-1">Make it something you won't forget.</p>
            </div>

            <div className="space-y-3">
              <input
                type="password"
                placeholder="New password (min 8 chars)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoFocus
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white"
              />
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white"
              />
            </div>

            {error && <p className="text-akyra-red text-sm font-mono text-center">{error}</p>}

            <button
              onClick={handleSetPassword}
              disabled={newPassword.length < 8 || newPassword !== confirmPassword}
              className="w-full py-3 rounded-xl bg-white text-black font-bold disabled:opacity-50"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Enroll passkey */}
        {phase === "set-passkey" && (
          <div className="space-y-6 text-center">
            <div>
              <h1 className="text-2xl font-black text-white">One more thing.</h1>
              <p className="text-sm text-white/50 mt-2">
                Let's make sure this doesn't happen again.
                We're creating a new Passkey on this device.
              </p>
            </div>

            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto">
              <span className="text-3xl">🔒</span>
            </div>

            {error && <p className="text-akyra-red text-sm font-mono">{error}</p>}

            <button
              onClick={handleEnrollPasskey}
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-white text-black font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <><LoadingSpinner size="sm" /> Just a sec...</> : "Create Passkey"}
            </button>

            <button
              onClick={handleSkipPasskey}
              disabled={isLoading}
              className="text-xs font-mono text-white/20 hover:text-white/40 transition-colors"
            >
              Skip for now
            </button>
          </div>
        )}

        {/* Respawning */}
        {phase === "respawning" && (
          <div className="text-center space-y-4">
            <div style={{ opacity: glowIntensity }}>
              <AkyraLogo className="w-12 h-12 mx-auto" />
            </div>
            <div>
              <p
                className="text-3xl font-black tracking-tight"
                style={{ color: `rgba(${Math.round(glowIntensity * 255)}, 255, ${Math.round(glowIntensity * 100)}, 1)` }}
              >
                RESPAWNING...
              </p>
              <p className="text-xs font-mono text-white/20 mt-2 animate-pulse">
                Merging credentials · Linking profile · Syncing data
              </p>
            </div>
          </div>
        )}

        {/* Respawned */}
        {phase === "respawned" && (
          <div className="text-center space-y-6">
            <AkyraLogo className="w-12 h-12 mx-auto" />
            <div>
              <p className="text-3xl font-black text-white">RESPAWNED.</p>
              <p className="text-lg text-green-400/80 mt-2">
                Get back out there, Legend.
              </p>
            </div>
            <button
              onClick={() => navigate("/app/dashboard")}
              className="w-full py-3 rounded-xl bg-white text-black font-bold"
            >
              Let's go →
            </button>
          </div>
        )}

        {/* Expired */}
        {phase === "expired" && (
          <div className="text-center space-y-4">
            <p className="text-akyra-red font-bold">PIN Expired</p>
            <p className="text-sm text-white/50">
              The Respawn PIN expired before your supervisor could authorize it.
            </p>
            <button
              onClick={() => {
                setPhase("generating")
                setTimeLeft(300)
                setPin("")
              }}
              className="w-full py-3 rounded-xl bg-white text-black font-bold"
            >
              Try Again
            </button>
            <button
              onClick={onBack}
              className="text-xs font-mono text-white/30 hover:text-white transition-colors"
            >
              ← Back to login
            </button>
          </div>
        )}

        {/* Error */}
        {phase === "error" && (
          <div className="text-center space-y-4">
            <p className="text-akyra-red font-bold">Unable to Start Respawn</p>
            <p className="text-sm text-white/50">
              Your account wasn't found. Check your EEID and Welcome Code, or contact your supervisor.
            </p>
            <button
              onClick={onBack}
              className="text-xs font-mono text-white/30 hover:text-white transition-colors"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
