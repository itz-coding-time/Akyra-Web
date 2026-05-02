import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { useStation, useShiftLifecycle } from "../../hooks"
import { useAuth } from "../../context"
import { fetchActiveShiftsForStore, fetchShiftResultsForStore, fetchAssociateScheduleToday } from "../../lib"
import { DropSequence, ExtractionWarning, EndOfShiftResults } from "../../components/gamification"
import { LobbyScreen } from "./LobbyScreen"
import { LoadingSpinner } from "../../components/LoadingSpinner"
import { AssociateTaskView } from "./AssociateTaskView"
import { PlacementMatchScreen } from "./PlacementMatchScreen"
import type { FloatMode } from "../../hooks"
import type { Associate } from "../../types"
import type { TeamShiftResult } from "../../lib/repository"

interface AssociateDashboardProps {
  associate: Associate
}

interface FloatModePickerProps {
  onSelect: (mode: FloatMode) => void
}

function FloatModePicker({ onSelect }: FloatModePickerProps) {
  return (
    <div className="min-h-screen bg-akyra-black flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black">Float Mode</h2>
          <p className="text-akyra-secondary text-sm mt-2">
            Where do you need to help tonight?
          </p>
        </div>
        <div className="space-y-3">
          {[
            { mode: "kitchen" as const, label: "Help Kitchen", icon: "🍳" },
            { mode: "pos" as const, label: "Help POS", icon: "🖥️" },
            { mode: "both" as const, label: "Both", icon: "⚡" },
          ].map((opt) => (
            <button
              key={opt.mode}
              onClick={() => onSelect(opt.mode)}
              className="w-full text-left p-4 rounded-xl border border-akyra-border bg-akyra-surface hover:border-white/40 transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{opt.icon}</span>
                <span className="font-semibold text-white">{opt.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AssociateDashboard({ associate }: AssociateDashboardProps) {
  const navigate = useNavigate()
  const { station, floatMode, isClaiming, claim, setFloat } = useStation(associate)
  const { orgStations, signOut } = useAuth()

  const currentStation = orgStations.find(s => s.name === station)
  const isFloatStation = currentStation?.isFloat ?? false

  const [schedule, setSchedule] = useState<{ startTime: string; endTime: string } | null>(null)
  const [scheduleChecked, setScheduleChecked] = useState(false)
  const [showLobby, setShowLobby] = useState(false)
  const [readyUp, setReadyUp] = useState(false)
  const [placementNeeded, setPlacementNeeded] = useState<boolean | null>(null)
  const [supervisorOnFloor, setSupervisorOnFloor] = useState(false)

  useEffect(() => {
    async function checkPlacement() {
      if (!associate.profile_id) {
        setPlacementNeeded(false)
        return
      }

      // Only crew (T1) see placement match
      if (associate.role_rank !== 1) {
        setPlacementNeeded(false)
        return
      }

      const { needsPlacement } = await import("../../lib")
      const needs = await needsPlacement(associate.profile_id)

      if (needs) {
        // Check if supervisor is on floor
        const { data: supervisors } = await supabase
          .from("active_shifts")
          .select("associate_id, associates!associate_id(role_rank)")
          .eq("store_id", associate.store_id)
          .eq("is_active", true)
          .neq("associate_id", associate.id)

        const hasSup = (supervisors ?? []).some(
          (s: any) => (s.associates?.role_rank ?? 0) >= 2
        )
        setSupervisorOnFloor(hasSup)
        setPlacementNeeded(true)
      } else {
        setPlacementNeeded(false)
      }
    }
    checkPlacement()
  }, [associate.profile_id, associate.role_rank, associate.store_id, associate.id])

  useEffect(() => {
    fetchAssociateScheduleToday(associate.id, associate.store_id).then(s => {
      setSchedule(s)

      if (s) {
        const now = Date.now()
        const start = new Date(s.startTime).getTime()
        // Show Lobby if more than 2 minutes before shift start
        if (start - now > 120000) {
          setShowLobby(true)
        }
      }

      setScheduleChecked(true)
    })
  }, [associate.id, associate.store_id])

  // Squad members for drop sequence (fetch before station is claimed)
  const [squadMembers, setSquadMembers] = useState<Array<{ name: string; station: string; emoji: string }>>([])
  useEffect(() => {
    if (!station && associate.store_id) {
      fetchActiveShiftsForStore(associate.store_id).then(shifts => {
        const members = shifts
          .filter(s => (s as any).associates?.id !== associate.id)
          .map(s => {
            const assoc = (s as any).associates
            const stationEmoji = orgStations.find(o => o.name === s.station)?.emoji ?? "👤"
            return {
              name: (assoc?.name as string) ?? "Unknown",
              station: s.station,
              emoji: stationEmoji,
            }
          })
        setSquadMembers(members)
      })
    }
  }, [station, associate.store_id, associate.id, orgStations])

  // Shift lifecycle — drives extraction warnings and phase filtering
  const { phase, minutesRemaining, showWarning, dismissWarning } = useShiftLifecycle(
    associate.default_start_time,
    associate.default_end_time,
    associate.store_id,
    associate.id
  )

  // End of shift results
  const [showResults, setShowResults] = useState(false)
  const [teamResults, setTeamResults] = useState<TeamShiftResult[]>([])

  async function handleLeaving() {
    const results = await fetchShiftResultsForStore(associate.store_id)
    setTeamResults(results)
    setShowResults(true)
  }

  async function handleResultsDone() {
    await signOut()
    navigate("/app/login")
  }

  // If not checked yet, show loading
  if (!scheduleChecked || placementNeeded === null) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  // Show placement match if needed
  if (placementNeeded && associate.profile_id) {
    return (
      <PlacementMatchScreen
        associateId={associate.id}
        associateName={associate.name}
        storeId={associate.store_id}
        profileId={associate.profile_id}
        isOnShift={supervisorOnFloor}
        onComplete={() => setPlacementNeeded(false)}
      />
    )
  }

  // Show Lobby if applicable
  if (scheduleChecked && showLobby && !readyUp && schedule) {
    return (
      <LobbyScreen
        associateId={associate.id}
        storeId={associate.store_id}
        storeName={"Your Store"}
        scheduledStart={schedule.startTime}
        onReadyUp={() => {
          setShowLobby(false)
          setReadyUp(true)
        }}
      />
    )
  }

  // No station — show drop sequence (replaces StationClaimScreen)
  if (!station) {
    return (
      <DropSequence
        associateName={associate.name}
        squadMembers={squadMembers}
        stations={orgStations}
        onStationSelected={claim}
        isClaiming={isClaiming}
      />
    )
  }

  // Float with no mode — show float picker
  if (isFloatStation && !floatMode) {
    return <FloatModePicker onSelect={setFloat} />
  }

  // End of shift results screen
  if (showResults) {
    return (
      <EndOfShiftResults
        teamResults={teamResults}
        myAssociateId={associate.id}
        onDone={handleResultsDone}
      />
    )
  }

  // Phase filter for task view
  const phaseFilter: "final-hour" | "final-fifteen" | null =
    phase === "final-fifteen" ? "final-fifteen" :
    phase === "final-hour" ? "final-hour" : null

  const showLeavingButton = phase === "final-hour" || phase === "final-fifteen"

  return (
    <>
      {showWarning && (
        <ExtractionWarning
          minutesRemaining={minutesRemaining}
          onDismiss={dismissWarning}
        />
      )}
      <AssociateTaskView
        associate={associate}
        station={station}
        floatMode={floatMode}
        phaseFilter={phaseFilter}
        onChangeFloatMode={isFloatStation ? () => setFloat(null) : undefined}
        onLeaving={showLeavingButton ? handleLeaving : undefined}
      />
    </>
  )
}
