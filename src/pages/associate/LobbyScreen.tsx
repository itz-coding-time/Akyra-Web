import { useEffect, useState, useRef } from "react"
import { AkyraLogo } from "../../components/AkyraLogo"
import { useLobbyAudio } from "../../hooks/useLobbyAudio"
import {
  fetchLobbySquad,
  fetchExtendedAssociates,
  getShiftBucketFromTime,
  type LobbySquadMember,
} from "../../lib"

interface LobbyScreenProps {
  associateId: string
  storeId: string
  storeName: string
  scheduledStart: string  // ISO string
  onReadyUp: () => void   // fires Drop Sequence
}

export function LobbyScreen({
  associateId,
  storeId,
  storeName,
  scheduledStart,
  onReadyUp,
}: LobbyScreenProps) {
  const [timeLeft, setTimeLeft] = useState(0)
  const [squad, setSquad] = useState<LobbySquadMember[]>([])
  const [extended, setExtended] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const shiftBucket = getShiftBucketFromTime(scheduledStart)
  const shiftDate = new Date(scheduledStart).toISOString().split("T")[0]

  const deployedCount = squad.filter(m => m.isDeployed).length

  const { startAmbient, launch } = useLobbyAudio({
    squadCount: deployedCount,
    secondsLeft: timeLeft,
    onLaunchComplete: () => {
      // Drop Sequence takes over — audio has handed off
    },
  })

  // Calculate initial time left
  useEffect(() => {
    function calculateTimeLeft() {
      const now = Date.now()
      const start = new Date(scheduledStart).getTime()
      return Math.max(0, Math.floor((start - now) / 1000))
    }

    setTimeLeft(calculateTimeLeft())

    timerRef.current = setInterval(() => {
      const left = calculateTimeLeft()
      setTimeLeft(left)

      if (left === 0) {
        clearInterval(timerRef.current!)
        launch()
        setTimeout(onReadyUp, 300) // Auto-fire Drop Sequence when time hits 0
      }
    }, 1000)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [scheduledStart, launch, onReadyUp])

  // Load squad data
  useEffect(() => {
    Promise.all([
      fetchLobbySquad(storeId, shiftDate, shiftBucket),
      fetchExtendedAssociates(storeId),
    ]).then(([s, e]) => {
      setSquad(s)
      setExtended(e)
      setIsLoading(false)
    })
  }, [storeId, shiftDate, shiftBucket])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  const isImminent = timeLeft < 60

  return (
    <div 
      className="min-h-screen bg-black flex flex-col"
      onClick={() => startAmbient()}
    >
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-[60%] h-[40%] bg-white/[0.015] blur-[150px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[40%] h-[40%] bg-[#E63946]/[0.03] blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 flex flex-col flex-1 px-6 pt-12 pb-8 max-w-sm mx-auto w-full">

        {/* Header */}
        <div className="text-center space-y-1 mb-10">
          <AkyraLogo className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/20">
            {storeName}
          </p>
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/20">
            {shiftBucket === "6a-2p" ? "6AM — 2PM" :
             shiftBucket === "2p-10p" ? "2PM — 10PM" :
             "10PM — 6AM"}
          </p>
        </div>

        {/* Countdown */}
        <div className="text-center mb-10">
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/20 mb-3">
            DROP IN
          </p>
          <p className={`text-6xl font-black font-mono tracking-tight transition-colors ${
            isImminent ? "text-[#E63946] animate-pulse" : "text-white"
          }`}>
            {formatTime(timeLeft)}
          </p>
          {isImminent && (
            <p className="text-[10px] font-mono text-[#E63946]/60 mt-2 animate-pulse">
              Get ready to drop
            </p>
          )}
        </div>

        {/* Extended associates from previous shift */}
        {extended.length > 0 && (
          <div className="mb-6 space-y-2">
            <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/20">
              Still on floor from last shift
            </p>
            {extended.map(e => (
              <div
                key={e.associateId}
                className="flex items-center justify-between bg-orange-500/[0.05] border border-orange-500/20 rounded-xl px-4 py-2.5"
              >
                <p className="text-sm text-white/60">{e.associateName}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-orange-400/60">{e.station}</span>
                  <span className="text-[9px] font-mono text-orange-400/40">extending</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Squad list */}
        <div className="flex-1 space-y-2">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/20 mb-3">
            Your squad is assembling
          </p>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-white/[0.03] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : squad.length === 0 ? (
            <p className="text-sm text-white/20 text-center py-6 font-mono">
              No squad found for this shift.
            </p>
          ) : (
            squad.map(member => (
              <div
                key={member.associateId}
                className={`flex items-center justify-between rounded-xl px-4 py-3 transition-all ${
                  member.isDeployed
                    ? "bg-white/[0.05] border border-white/10"
                    : "bg-white/[0.02] border border-white/[0.05]"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Status dot */}
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    member.isDeployed ? "bg-white" : "bg-white/20"
                  }`} />

                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm font-semibold ${
                        member.isDeployed ? "text-white" : "text-white/30"
                      }`}>
                        {member.isPredator ? "🔱 " : ""}{member.associateName}
                        {member.associateId === associateId && (
                          <span className="text-[9px] font-mono text-white/20 ml-1">you</span>
                        )}
                      </p>
                    </div>
                    {member.isDeployed && member.currentStation && (
                      <p className="text-[10px] font-mono text-white/30">
                        {member.currentStation}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {member.isDeployed ? (
                    <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">
                      deployed
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest">
                      not yet
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Ready Up button */}
        <div className="mt-8">
          <button
            onClick={() => {
              launch()
              setTimeout(onReadyUp, 300)
            }}
            className="w-full py-4 rounded-2xl bg-white text-black font-black text-lg tracking-tight hover:bg-white/90 transition-colors active:scale-[0.98]"
          >
            READY UP →
          </button>
          <p className="text-center text-[9px] font-mono text-white/15 mt-3">
            Skip the countdown and drop now
          </p>
        </div>
      </div>
    </div>
  )
}
