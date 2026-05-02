import { useEffect, useState, useRef } from "react"
import { sendBreakEndPing, endBreak } from "../lib"

interface BreakScreenProps {
  associateId: string
  storeId: string
  breakStartedAt: string
  onBreakEnd: () => void
}

const BREAK_SECONDS = 30 * 60

export function BreakScreen({
  associateId,
  storeId,
  breakStartedAt,
  onBreakEnd,
}: BreakScreenProps) {
  const [secondsLeft, setSecondsLeft] = useState(BREAK_SECONDS)
  const [breakOver, setBreakOver] = useState(false)
  const [isReturning, setIsReturning] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    function calcRemaining() {
      const elapsed = Math.floor(
        (Date.now() - new Date(breakStartedAt).getTime()) / 1000
      )
      return Math.max(0, BREAK_SECONDS - elapsed)
    }

    setSecondsLeft(calcRemaining())

    timerRef.current = setInterval(() => {
      const remaining = calcRemaining()
      setSecondsLeft(remaining)

      if (remaining === 0) {
        clearInterval(timerRef.current!)
        setBreakOver(true)
        sendBreakEndPing(associateId, storeId)
      }
    }, 1000)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [breakStartedAt, associateId, storeId])

  async function handleImBack() {
    setIsReturning(true)
    await endBreak(associateId, storeId)
    setIsReturning(false)
    onBreakEnd()
  }

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const pct = (secondsLeft / BREAK_SECONDS) * 100
  const isLow = secondsLeft < 5 * 60 // last 5 minutes

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-[50%] h-[50%] bg-white/[0.01] blur-[150px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-10 text-center">

        {!breakOver ? (
          <>
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/20">
                On Break
              </p>
              <p className="text-white/40 text-sm">
                Rest up. Your tasks are waiting.
              </p>
            </div>

            {/* Circular countdown */}
            <div className="relative w-48 h-48 mx-auto">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50" cy="50" r="44"
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="4"
                />
                {/* Progress circle */}
                <circle
                  cx="50" cy="50" r="44"
                  fill="none"
                  stroke={isLow ? "#E63946" : "rgba(255,255,255,0.3)"}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 44}`}
                  strokeDashoffset={`${2 * Math.PI * 44 * (1 - pct / 100)}`}
                  style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease" }}
                />
              </svg>

              {/* Time display */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className={`text-4xl font-black font-mono ${isLow ? "text-[#E63946]" : "text-white"}`}>
                  {minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}
                </p>
                <p className="text-[10px] font-mono text-white/20 mt-1">remaining</p>
              </div>
            </div>

            {isLow && (
              <p className="text-[#E63946]/60 text-sm font-mono animate-pulse">
                Wrapping up soon
              </p>
            )}

            {/* Early return */}
            <button
              onClick={handleImBack}
              disabled={isReturning}
              className="w-full py-4 rounded-2xl border border-white/20 text-white font-bold text-lg hover:bg-white/5 transition-colors active:scale-[0.98]"
            >
              {isReturning ? "Clocking back in..." : "I'm back →"}
            </button>

            <p className="text-[9px] font-mono text-white/15">
              Your break ends automatically in {minutes}:{seconds.toString().padStart(2, "0")}
            </p>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/20">
                Break Over
              </p>
              <p className="text-2xl font-black text-white">
                Get back out there. 💪
              </p>
              <p className="text-sm text-white/40">
                Your squad needs you.
              </p>
            </div>

            <button
              onClick={handleImBack}
              disabled={isReturning}
              className="w-full py-4 rounded-2xl bg-white text-black font-black text-lg active:scale-[0.98]"
            >
              {isReturning ? "Clocking back in..." : "Back on the floor →"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
