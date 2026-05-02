import { useState, useEffect, useRef } from "react"
import { AkyraLogo } from "../../components/AkyraLogo"
import { LoadingSpinner } from "../../components/LoadingSpinner"
import { TierBadge } from "../../components/TierBadge"
import {
  completePlacement,
  skipPlacement,
  notifyPlacementStarted,
  notifyPlacementComplete,
  notifyFirstDrop,
} from "../../lib"

interface PlacementMatchScreenProps {
  profileId: string
  associateName: string
  storeId: string
  associateId: string
  isOnShift: boolean // supervisor is present on the floor
  onComplete: () => void // fires Drop Sequence
}

type PlacementPhase =
  | "intro"
  | "round-1-brief"
  | "round-1-task"
  | "round-1-complete"
  | "round-2-brief"
  | "round-2-sop"
  | "round-2-assist"
  | "round-2-complete"
  | "round-3-brief"
  | "round-3-tasks"
  | "round-3-complete"
  | "results"
  | "dropping"

// Practice tasks — never written to DB, pure UI simulation
const PRACTICE_TASKS = {
  round1: {
    name: "Sweep the floor",
    archetype: "Kitchen",
    minutes: 10,
    description: "Keep the floor clean and clear of debris. Safety first.",
  },
  round2: {
    name: "Reset the coffee station",
    archetype: "POS",
    minutes: 15,
    description: "Restock cups, lids, and sleeves. Wipe down surfaces.",
  },
  round3a: {
    name: "Restock the cooler",
    archetype: "Kitchen",
    minutes: 20,
    description: "Pull product from backstock and face the cooler.",
  },
  round3b: {
    name: "Check expiry dates",
    archetype: "Kitchen",
    minutes: 10,
    description: "Pull any items within 24 hours of expiry.",
  },
}

export function PlacementMatchScreen({
  profileId,
  associateName,
  storeId,
  associateId,
  isOnShift,
  onComplete,
}: PlacementMatchScreenProps) {
  const [phase, setPhase] = useState<PlacementPhase>("intro")
  const [isLoading, setIsLoading] = useState(false)
  const [showRadialHint, setShowRadialHint] = useState(false)
  const [showSOPHint, setShowSOPHint] = useState(false)
  const [showAssistHint, setShowAssistHint] = useState(false)
  const [radialDemoState, setRadialDemoState] = useState<"idle" | "holding" | "complete">("idle")
  const [sopViewed, setSOPViewed] = useState(false)
  const [assistCalled, setAssistCalled] = useState(false)
  const [round3Progress, setRound3Progress] = useState(0)
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const firstName = associateName.split(" ")[0]

  // Notify supervisor when onboarding starts
  useEffect(() => {
    if (isOnShift) {
      notifyPlacementStarted(associateName, storeId, associateId)
    }
  }, [isOnShift, associateName, storeId, associateId])

  // Show radial hint after 5 seconds on round 1 task
  useEffect(() => {
    if (phase !== "round-1-task") return
    const timer = setTimeout(() => setShowRadialHint(true), 5000)
    return () => clearTimeout(timer)
  }, [phase])

  // Show SOP hint after 8 seconds on round 2
  useEffect(() => {
    if (phase !== "round-2-brief") return
    const timer = setTimeout(() => setShowSOPHint(true), 8000)
    return () => clearTimeout(timer)
  }, [phase])

  // Show assist hint after SOP is viewed
  useEffect(() => {
    if (!sopViewed) return
    const timer = setTimeout(() => setShowAssistHint(true), 4000)
    return () => clearTimeout(timer)
  }, [sopViewed])

  async function handleComplete() {
    setIsLoading(true)
    await completePlacement(profileId)
    if (isOnShift) {
      await notifyPlacementComplete(associateName, storeId, associateId)
    }
    setIsLoading(false)
    setPhase("results")
  }

  async function handleDrop() {
    setPhase("dropping")
    if (isOnShift) {
      await notifyFirstDrop(associateName, storeId, associateId)
    }
    setTimeout(() => onComplete(), 1500)
  }

  async function handleSkip() {
    setIsLoading(true)
    await skipPlacement(profileId)
    setIsLoading(false)
    onComplete()
  }

  function handleRadialHold() {
    setRadialDemoState("holding")
    holdTimer.current = setTimeout(() => {
      setRadialDemoState("complete")
    }, 1500)
  }

  function handleRadialRelease() {
    if (radialDemoState !== "complete") {
      if (holdTimer.current) clearTimeout(holdTimer.current)
      setRadialDemoState("idle")
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-[50%] h-[40%] bg-white/[0.015] blur-[150px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[30%] h-[30%] bg-[#E63946]/[0.03] blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 flex flex-col flex-1 px-6 pt-12 pb-8 max-w-sm mx-auto w-full">

        {/* ── INTRO ── */}
        {phase === "intro" && (
          <div className="flex flex-col flex-1 items-center justify-center space-y-8 text-center">
            <AkyraLogo className="w-10 h-10 opacity-60" />

            <div className="space-y-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/20">
                Welcome to Akyra
              </p>
              <h1 className="text-3xl font-black text-white leading-tight">
                Before you deploy,<br />let's run a placement.
              </h1>
              <p className="text-sm text-white/40 max-w-xs mx-auto">
                Three quick rounds. Learn the tools. Then drop into your first real shift.
              </p>
            </div>

            <div className="w-full space-y-3">
              <button
                onClick={() => setPhase("round-1-brief")}
                className="w-full py-4 rounded-2xl bg-white text-black font-black text-lg active:scale-[0.98] transition-transform"
              >
                Start Placement →
              </button>
              <button
                onClick={handleSkip}
                disabled={isLoading}
                className="w-full text-xs font-mono text-white/15 hover:text-white/30 transition-colors"
              >
                Already know the drill? Skip placement →
              </button>
            </div>
          </div>
        )}

        {/* ── ROUND 1 BRIEF ── */}
        {phase === "round-1-brief" && (
          <div className="flex flex-col flex-1 justify-center space-y-8">
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/20">
                Round 1 of 3
              </p>
              <h2 className="text-2xl font-black text-white">
                Complete your first task.
              </h2>
              <p className="text-sm text-white/40">
                Every task has a radial menu. Tap and hold to open it. Swipe right to complete.
              </p>
            </div>

            <div className="bg-akyra-surface border border-akyra-border rounded-2xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-bold text-white">{PRACTICE_TASKS.round1.name}</p>
                <span className="text-[10px] font-mono text-white/30">
                  {PRACTICE_TASKS.round1.minutes} min
                </span>
              </div>
              <p className="text-xs text-white/40">{PRACTICE_TASKS.round1.description}</p>
              <span className="text-[9px] font-mono text-white/20 border border-white/10 rounded px-2 py-0.5">
                {PRACTICE_TASKS.round1.archetype}
              </span>
            </div>

            <button
              onClick={() => setPhase("round-1-task")}
              className="w-full py-4 rounded-2xl bg-white text-black font-black text-lg"
            >
              Got it →
            </button>
          </div>
        )}

        {/* ── ROUND 1 TASK (interactive) ── */}
        {phase === "round-1-task" && (
          <div className="flex flex-col flex-1 justify-between">
            <div className="space-y-4 pt-4">
              <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/20">
                Round 1 — Your turn
              </p>

              {/* Practice task card */}
              <div
                className={`bg-akyra-surface border rounded-2xl p-5 space-y-3 transition-all select-none ${
                  radialDemoState === "holding"
                    ? "border-white/40 scale-[0.98]"
                    : radialDemoState === "complete"
                    ? "border-white bg-white/5"
                    : "border-akyra-border"
                }`}
                onMouseDown={handleRadialHold}
                onMouseUp={handleRadialRelease}
                onTouchStart={handleRadialHold}
                onTouchEnd={handleRadialRelease}
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-white">{PRACTICE_TASKS.round1.name}</p>
                  <span className="text-[10px] font-mono text-white/30">
                    {PRACTICE_TASKS.round1.minutes} min
                  </span>
                </div>
                <p className="text-xs text-white/40">{PRACTICE_TASKS.round1.description}</p>

                {radialDemoState === "idle" && (
                  <p className="text-[10px] font-mono text-white/20 animate-pulse">
                    Tap and hold to open the menu...
                  </p>
                )}
                {radialDemoState === "holding" && (
                  <p className="text-[10px] font-mono text-white/60">
                    Keep holding...
                  </p>
                )}
                {radialDemoState === "complete" && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono text-white/60">
                      Radial menu open. Now swipe RIGHT to complete.
                    </p>
                    <button
                      onClick={() => setPhase("round-1-complete")}
                      className="w-full py-2.5 rounded-xl bg-white text-black font-bold text-sm"
                    >
                      → Complete Task
                    </button>
                  </div>
                )}
              </div>

              {/* Hint */}
              {showRadialHint && radialDemoState === "idle" && (
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
                  <p className="text-xs text-white/50">
                    💡 Tap and hold anywhere on the task card. Hold for 1.5 seconds until the menu opens.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ROUND 1 COMPLETE ── */}
        {phase === "round-1-complete" && (
          <div className="flex flex-col flex-1 justify-center space-y-8 text-center">
            <div className="space-y-3">
              <p className="text-4xl">✓</p>
              <h2 className="text-2xl font-black text-white">Task complete.</h2>
              <p className="text-sm text-white/40">
                Your supervisor gets notified. They verify. You move on.
              </p>
              <p className="text-[10px] font-mono text-white/20">
                In a real shift, verification takes a moment. During placement, it's instant.
              </p>
            </div>

            <button
              onClick={() => setPhase("round-2-brief")}
              className="w-full py-4 rounded-2xl bg-white text-black font-black text-lg"
            >
              Round 2 →
            </button>
          </div>
        )}

        {/* ── ROUND 2 BRIEF ── */}
        {phase === "round-2-brief" && (
          <div className="flex flex-col flex-1 justify-between">
            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/20">
                  Round 2 of 3
                </p>
                <h2 className="text-2xl font-black text-white">
                  What if you don't know how?
                </h2>
                <p className="text-sm text-white/40">
                  Every task has a SOP — Standard Operating Procedure. It's your guide. And if you're still stuck, your squad is there.
                </p>
              </div>

              {/* Practice task */}
              <div className="bg-akyra-surface border border-akyra-border rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-white">{PRACTICE_TASKS.round2.name}</p>
                  <span className="text-[10px] font-mono text-white/30">
                    {PRACTICE_TASKS.round2.minutes} min
                  </span>
                </div>
                <p className="text-xs text-white/40">{PRACTICE_TASKS.round2.description}</p>

                {/* SOP button */}
                <button
                  onClick={() => {
                    setSOPViewed(true)
                    setShowSOPHint(false)
                  }}
                  className={`w-full py-2 rounded-xl border text-xs font-mono transition-all ${
                    sopViewed
                      ? "border-white/30 text-white bg-white/5"
                      : "border-akyra-border text-akyra-secondary hover:border-white/30"
                  }`}
                >
                  {sopViewed ? "✓ SOP Viewed" : "📋 View SOP"}
                </button>

                {/* Assist button — appears after SOP */}
                {showAssistHint && !assistCalled && (
                  <button
                    onClick={() => setAssistCalled(true)}
                    className="w-full py-2 rounded-xl border border-akyra-border text-akyra-secondary text-xs font-mono hover:border-white/30 transition-all animate-pulse"
                  >
                    🙋 Still stuck? Ask for help
                  </button>
                )}

                {assistCalled && (
                  <div className="bg-white/[0.03] border border-white/10 rounded-lg p-2">
                    <p className="text-[10px] text-white/50 font-mono">
                      ✓ Help request sent. Your supervisor has been notified.
                    </p>
                  </div>
                )}
              </div>

              {/* Hint */}
              {showSOPHint && !sopViewed && (
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
                  <p className="text-xs text-white/50">
                    💡 Not sure how to reset the coffee station? Tap "View SOP" to see the step-by-step guide.
                  </p>
                </div>
              )}
            </div>

            {/* Can only proceed after SOP viewed */}
            {sopViewed && (
              <button
                onClick={() => setPhase("round-2-complete")}
                className="w-full py-4 rounded-2xl bg-white text-black font-black text-lg mt-6"
              >
                Got it →
              </button>
            )}
          </div>
        )}

        {/* ── ROUND 2 COMPLETE ── */}
        {phase === "round-2-complete" && (
          <div className="flex flex-col flex-1 justify-center space-y-8 text-center">
            <div className="space-y-3">
              <p className="text-4xl">📋</p>
              <h2 className="text-2xl font-black text-white">
                The SOP is always there.
              </h2>
              <p className="text-sm text-white/40">
                Every task has one. Your squad has your back. You're never on your own.
              </p>
            </div>

            <button
              onClick={() => setPhase("round-3-brief")}
              className="w-full py-4 rounded-2xl bg-white text-black font-black text-lg"
            >
              Final Round →
            </button>
          </div>
        )}

        {/* ── ROUND 3 BRIEF ── */}
        {phase === "round-3-brief" && (
          <div className="flex flex-col flex-1 justify-center space-y-8">
            <div className="space-y-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/20">
                Round 3 of 3
              </p>
              <h2 className="text-2xl font-black text-white">
                Can you keep up?
              </h2>
              <p className="text-sm text-white/40">
                Real shifts have multiple tasks. Work through them in order. The pacing bar shows how you're doing.
              </p>
            </div>

            <div className="space-y-2">
              {[PRACTICE_TASKS.round3a, PRACTICE_TASKS.round3b].map((task, i) => (
                <div key={i} className="bg-akyra-surface border border-akyra-border rounded-xl px-4 py-3 flex items-center justify-between">
                  <p className="text-sm text-white/60">{task.name}</p>
                  <span className="text-[10px] font-mono text-white/30">{task.minutes} min</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setPhase("round-3-tasks")}
              className="w-full py-4 rounded-2xl bg-white text-black font-black text-lg"
            >
              Let's go →
            </button>
          </div>
        )}

        {/* ── ROUND 3 TASKS ── */}
        {phase === "round-3-tasks" && (
          <div className="flex flex-col flex-1 justify-between pt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/20">
                  Round 3 — Final
                </p>
                <p className="text-xs font-mono text-white/30">
                  {round3Progress}/2 complete
                </p>
              </div>

              {/* Pacing bar */}
              <div className="space-y-1">
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{ width: `${(round3Progress / 2) * 100}%` }}
                  />
                </div>
                <p className="text-[9px] font-mono text-white/20">
                  {round3Progress === 0 ? "On pace" : round3Progress === 1 ? "Making progress" : "All done"}
                </p>
              </div>

              {/* Task list */}
              {[PRACTICE_TASKS.round3a, PRACTICE_TASKS.round3b].map((task, i) => {
                const isDone = round3Progress > i
                const isNext = round3Progress === i

                return (
                  <div
                    key={i}
                    className={`bg-akyra-surface border rounded-2xl p-5 space-y-3 transition-all ${
                      isDone ? "border-white/20 opacity-40" :
                      isNext ? "border-akyra-border" :
                      "border-white/5 opacity-20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className={`font-bold ${isDone ? "line-through text-white/30" : "text-white"}`}>
                        {task.name}
                      </p>
                      {isDone && <span className="text-white/40 text-sm">✓</span>}
                    </div>

                    {isNext && (
                      <button
                        onClick={() => setRound3Progress(prev => {
                          const next = prev + 1
                          if (next >= 2) setTimeout(() => setPhase("round-3-complete"), 600)
                          return next
                        })}
                        className="w-full py-2.5 rounded-xl bg-white text-black font-bold text-sm"
                      >
                        → Complete
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── ROUND 3 COMPLETE ── */}
        {phase === "round-3-complete" && (
          <div className="flex flex-col flex-1 justify-center space-y-6 text-center">
            <div className="space-y-2">
              <p className="text-4xl animate-bounce">🎯</p>
              <h2 className="text-2xl font-black text-white">All done.</h2>
              <p className="text-sm text-white/40">
                You worked through the queue, used your tools, and kept pace.
              </p>
            </div>

            <button
              onClick={handleComplete}
              disabled={isLoading}
              className="w-full py-4 rounded-2xl bg-white text-black font-black text-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <><LoadingSpinner size="sm" /> One sec...</> : "See your results →"}
            </button>
          </div>
        )}

        {/* ── RESULTS ── */}
        {phase === "results" && (
          <div className="flex flex-col flex-1 justify-center space-y-8 text-center">
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/20">
                Placement Complete
              </p>
              <h1 className="text-3xl font-black text-white">
                Welcome to the squad,<br />{firstName}.
              </h1>
            </div>

            {/* Placement result */}
            <div className="bg-akyra-surface border border-akyra-border rounded-2xl p-6 space-y-4">
              <p className="text-xs font-mono text-white/30 uppercase tracking-widest">
                Starting Rank
              </p>
              <div className="flex justify-center">
                <TierBadge tier="Platinum" size="lg" />
              </div>
              <p className="text-xs text-white/30 max-w-xs mx-auto">
                Everyone starts here. Where you go is up to you.
              </p>
            </div>

            {/* What they learned */}
            <div className="space-y-2 text-left">
              {[
                "Complete tasks using the radial menu",
                "Find the SOP when you're not sure",
                "Ask your squad for help when you need it",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <span className="text-[9px] text-white">✓</span>
                  </div>
                  <p className="text-xs text-white/50">{item}</p>
                </div>
              ))}
            </div>

            <button
              onClick={handleDrop}
              className="w-full py-4 rounded-2xl bg-white text-black font-black text-lg active:scale-[0.98] transition-transform"
            >
              Drop into your first shift →
            </button>
          </div>
        )}

        {/* ── DROPPING ── */}
        {phase === "dropping" && (
          <div className="flex flex-col flex-1 items-center justify-center space-y-6 text-center">
            <AkyraLogo className="w-10 h-10 animate-pulse" />
            <div>
              <p className="text-2xl font-black text-white">Deploying...</p>
              <p className="text-sm text-white/40 mt-1 font-mono">
                Get out there, {firstName}. 🎮
              </p>
            </div>
            <LoadingSpinner size="md" />
          </div>
        )}

      </div>
    </div>
  )
}
