import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAssociateTasks, useEquipmentIssues, useCodeCheck } from "../../hooks"
import { useAuth } from "../../context"
import {
  createAssistanceRequest,
  submitAssociatePhoto,
  logSlowCompletionReason,
  getAssociateSpendableCards,
  spendCard,
  fetchAssociateRanking,
  checkShiftOverdue,
  checkLockoutActive,
  getShiftBucket,
} from "../../lib"
import { TierBadge } from "../../components/TierBadge"
import { TaskCard } from "../../components/TaskCard"
import { FlipChecklist } from "../../components/FlipChecklist"
import { PullList } from "../../components/PullList"
import { LoadingSpinner } from "../../components/LoadingSpinner"
import { CodeCheckPanel } from "../../components/CodeCheckPanel"
import { WhosWorkingPanel } from "../../components/WhosWorkingPanel"
import {
  ShiftExtensionModal,
  EarlyDepartureModal,
  BreakScreen,
  TakeBreakModal,
  LockoutScreen,
  PartialCompletionModal,
} from "../../components"
import { RadialMenu } from "../../components/gamification/RadialMenu"
import { ArchetypeOfferModal } from "../../components/gamification/ArchetypeOfferModal"
import { SOPViewer } from "../../components/gamification/SOPViewer"
import { PingBanner } from "../../components/PingBanner"
import { PhotoCapture } from "../../components/gamification/PhotoCapture"
import { SlowReasonModal } from "../../components/gamification/SlowReasonModal"
import { BurnCardModal } from "../../components/gamification/BurnCardModal"
import { Wrench, AlertTriangle, Coffee } from "lucide-react"
import type { FloatMode } from "../../hooks"
import type { Associate } from "../../types"
import type { Database } from "../../types/database.types"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

const CATEGORIES = [
  "Refrigeration",
  "Cooking Equipment",
  "Coffee Machine",
  "POS / Register",
  "HVAC",
  "Plumbing",
  "Electrical",
  "Food Safety",
  "Other",
]

interface AssociateTaskViewProps {
  associate: Associate
  station: string
  floatMode: FloatMode
  phaseFilter?: "final-hour" | "final-fifteen" | null
  onChangeFloatMode?: () => void
  onLeaving?: () => void
}

export function AssociateTaskView({
  associate,
  station,
  floatMode,
  phaseFilter,
  onChangeFloatMode,
  onLeaving,
}: AssociateTaskViewProps) {
  const { signOut, orgStations } = useAuth()
  const navigate = useNavigate()

  const isFloatStation = orgStations.find(s => s.name === station)?.isFloat ?? false
  const primaryArchetype = isFloatStation
    ? (floatMode === "pos" ? "POS" : "Kitchen")
    : station

  const {
    myTasks,
    archetypeTasks,
    tableItems,
    inventoryItems,
    isLoading,
    startTask,
    completeTask,
    toggleTableItem,
    updateAmountHave,
    pendingVerification,
    clearPendingVerification,
    refetch,
  } = useAssociateTasks(associate.store_id, primaryArchetype, associate.name, associate.id)

  const { submitIssue, isSubmitting } = useEquipmentIssues(associate.store_id)

  const {
    expiringItems,
    isActioning,
    verifyUsedThrough,
    submitWaste,
  } = useCodeCheck(associate.store_id)

  async function handleSignOut() {
    await signOut()
    navigate("/app/login")
  }

  const [showCodeCheck, setShowCodeCheck] = useState(false)
  const [showIssueForm, setShowIssueForm] = useState(false)
  const [radialMenu, setRadialMenu] = useState<{
    taskId: string
    taskName: string
    position: { x: number; y: number }
  } | null>(null)
  const [sopTask, setSopTask] = useState<Task | null>(null)
  const [cards, setCards] = useState({ burnCards: 0, squadCards: 0, total: 0 })
  const [burnCardTask, setBurnCardTask] = useState<{ taskId: string; taskName: string } | null>(null)
  const [offeringTask, setOfferingTask] = useState<{ taskId: string; taskName: string } | null>(null)
  const [ranking, setRanking] = useState<any>(null)
  const [showProfile, setShowProfile] = useState(false)
  const [minutesOverdue, setMinutesOverdue] = useState(0)
  const [showExtension, setShowExtension] = useState(false)
  const [showEarlyDeparture, setShowEarlyDeparture] = useState(false)
  const [breakStatus, setBreakStatus] = useState<{
    onBreak: boolean
    breakTaken: boolean
    secondsRemaining: number
    breakStartedAt: string | null
  } | null>(null)
  const [showBreakModal, setShowBreakModal] = useState(false)

  const [lockoutActive, setLockoutActive] = useState(false)
  const [lockoutOverridden, setLockoutOverridden] = useState(false)
  const [showPartialModal, setShowPartialModal] = useState<{
    taskId: string
    taskName: string
  } | null>(null)

  const shiftBucket = getShiftBucket(associate.default_start_time)

  // Check shift overdue every 5 minutes
  useEffect(() => {
    async function checkOverdue() {
      const over = await checkShiftOverdue(associate.id, associate.store_id)
      const minutes = typeof over === "number" ? over : (over ? 1 : 0)
      if (minutes > 0 && !showExtension) {
        setMinutesOverdue(minutes)
        setShowExtension(true)
      }
    }

    checkOverdue()
    const interval = setInterval(checkOverdue, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [associate.id, associate.store_id, showExtension])

  // Check lockout every minute
  useEffect(() => {
    if (!associate.store_id || !shiftBucket) return

    async function checkLockout() {
      const active = await checkLockoutActive(associate.store_id, shiftBucket)
      setLockoutActive(active && !lockoutOverridden)
    }

    checkLockout()
    const interval = setInterval(checkLockout, 60 * 1000)
    return () => clearInterval(interval)
  }, [associate.store_id, shiftBucket, lockoutOverridden])

  useEffect(() => {
    if (associate.id && associate.store_id) {
      fetchAssociateRanking(associate.store_id, associate.id).then(setRanking)
    }
  }, [associate.id, associate.store_id])

  useEffect(() => {
    if (associate.profile_id) {
      getAssociateSpendableCards(associate.profile_id).then(setCards)
    }
  }, [associate.profile_id])

  // Load break status
  useEffect(() => {
    if (!associate.id || !associate.store_id) return
    async function loadBreakStatus() {
      const { getBreakStatus } = await import("../../lib")
      const status = await getBreakStatus(associate.id, associate.store_id)
      setBreakStatus(status)
    }

    loadBreakStatus()
    const interval = setInterval(loadBreakStatus, 30000)
    return () => clearInterval(interval)
  }, [associate.id, associate.store_id])

  async function handleRadialAction(
    direction: "up" | "down" | "left" | "right" | "up-left" | "left-hold",
    taskId: string
  ) {
    const task = [...myTasks, ...archetypeTasks].find(t => t.id === taskId)

    switch (direction) {
      case "left":
        completeTask(taskId)
        break
      case "left-hold":
        if (task) setOfferingTask({ taskId, taskName: task.task_name })
        break
      case "up": {
        const requestId = await createAssistanceRequest(
          associate.store_id,
          taskId,
          associate.id,
          1
        )
        if (requestId) {
          console.log("Assistance request created:", requestId)
        }
        break
      }
      case "right":
        if (task) setSopTask(task)
        break
      case "down":
        console.log("Report issue for task", taskId)
        break
      case "up-left":
        if (cards.total > 0) {
          const burnTask = [...myTasks, ...archetypeTasks].find(t => t.id === taskId)
          if (burnTask) setBurnCardTask({ taskId, taskName: burnTask.task_name })
        }
        break
    }
  }
  const [issueCategory, setIssueCategory] = useState("")
  const [issueDescription, setIssueDescription] = useState("")

  async function handleIssueSubmit() {
    if (!issueCategory || !issueDescription) return
    const success = await submitIssue(associate.id, issueCategory, issueDescription)
    if (success) {
      setShowIssueForm(false)
      setIssueCategory("")
      setIssueDescription("")
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-akyra-black flex items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  // Show lockout screen if active:
  if (lockoutActive) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <LockoutScreen
          storeId={associate.store_id}
          shiftBucket={shiftBucket}
          lockoutEndsAt="14:00"
          isSupervisor={(associate.role_rank ?? 1) >= 2}
          supervisorAssociateId={associate.id}
          onOverride={() => setLockoutOverridden(true)}
        />
      </div>
    )
  }

  // If on break, show BreakScreen instead of task view
  if (breakStatus?.onBreak && breakStatus.breakStartedAt) {
    return (
      <BreakScreen
        associateId={associate.id}
        storeId={associate.store_id}
        breakStartedAt={breakStatus.breakStartedAt}
        onBreakEnd={() => {
          setBreakStatus(prev => prev ? { ...prev, onBreak: false, breakTaken: true } : null)
        }}
      />
    )
  }

  // Apply phase-based task filtering
  const priorityFilter =
    phaseFilter === "final-fifteen" ? ["Critical"] :
    phaseFilter === "final-hour" ? ["Critical", "High"] : null

  const filteredMyTasks = priorityFilter
    ? myTasks.filter(t => priorityFilter.includes(t.priority))
    : myTasks
  const filteredArchetypeTasks = priorityFilter
    ? archetypeTasks.filter(t => priorityFilter.includes(t.priority))
    : archetypeTasks

  return (
    <div className="min-h-screen bg-akyra-black">
      <PingBanner
        storeId={associate.store_id}
        associateId={associate.id}
        associateName={associate.name}
        archetype={station}
        defaultStartTime={associate.default_start_time}
      />

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-akyra-border">
        <div>
          <button
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-2 text-left"
          >
            <div>
              <p className="font-bold text-white">{associate.name}</p>
              <p className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary">
                {isFloatStation ? `Float → ${floatMode}` : station}
              </p>
            </div>
            {ranking && (
              <TierBadge tier={ranking.tier} isPredator={ranking.isPredator} size="sm" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-3">
          {onLeaving && (
            <button
              onClick={onLeaving}
              className="text-xs font-mono uppercase tracking-widest text-[#E63946] hover:text-white transition-colors"
            >
              Leaving Shift
            </button>
          )}
          <button
            onClick={() => setShowEarlyDeparture(true)}
            className="text-xs font-mono uppercase tracking-widest text-akyra-secondary hover:text-[#E63946] transition-colors"
          >
            Leave early
          </button>
          {!breakStatus?.breakTaken && (
            <button
              onClick={() => setShowBreakModal(true)}
              className="flex items-center gap-1 text-xs font-mono uppercase tracking-widest text-akyra-secondary hover:text-white transition-colors"
            >
              <Coffee className="w-3.5 h-3.5" />
              Break
            </button>
          )}
          {breakStatus?.breakTaken && (
            <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest hidden sm:inline-block">
              Break Taken
            </span>
          )}
          <button
            onClick={() => setShowIssueForm(!showIssueForm)}
            className="flex items-center gap-1 text-xs font-mono text-akyra-secondary hover:text-white transition-colors"
          >
            <Wrench className="w-3.5 h-3.5" />
            Report
          </button>
          {isFloatStation && (
            <button
              onClick={onChangeFloatMode}
              className="text-xs font-mono uppercase tracking-widest text-akyra-secondary hover:text-white transition-colors"
            >
              Switch
            </button>
          )}
          <button
            onClick={handleSignOut}
            className="text-xs font-mono uppercase tracking-widest text-akyra-secondary hover:text-akyra-red transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Who's On panel */}
      <div className="px-6 pt-4">
        <WhosWorkingPanel
          storeId={associate.store_id}
          myAssociateId={associate.id}
        />
      </div>

      {/* Report Issue form */}
      {showIssueForm && (
        <div className="px-6 pt-4">
          <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4 space-y-3">
            <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
              Report Equipment Issue
            </p>

            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setIssueCategory(cat)}
                  className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                    issueCategory === cat
                      ? "border-white bg-white/10 text-white"
                      : "border-akyra-border text-akyra-secondary hover:border-white/40"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <textarea
              placeholder="Describe the issue..."
              value={issueDescription}
              onChange={e => setIssueDescription(e.target.value)}
              rows={3}
              className="w-full bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-akyra-secondary focus:outline-none focus:border-white/40 resize-none"
            />

            <div className="flex gap-2">
              <button
                onClick={() => { setShowIssueForm(false); setIssueCategory(""); setIssueDescription("") }}
                className="flex-1 py-2 rounded-lg border border-akyra-border text-xs font-mono text-akyra-secondary hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleIssueSubmit}
                disabled={!issueCategory || !issueDescription || isSubmitting}
                className={`flex-1 py-2 rounded-lg text-xs font-mono transition-all ${
                  issueCategory && issueDescription && !isSubmitting
                    ? "bg-white text-black hover:bg-white/90"
                    : "bg-akyra-surface text-akyra-secondary cursor-not-allowed"
                }`}
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-6 py-6 space-y-8 pb-20 max-w-lg mx-auto">

        {ranking?.isDesynced && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-orange-400 text-sm">⚡</span>
              <p className="text-sm font-semibold text-orange-400">Desync Detected</p>
            </div>
            <p className="text-xs text-white/60">
              You've had some rough shifts lately. No worries — help your squad and you'll be back in sync.
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
                  Assists to resync
                </p>
                <p className="text-[10px] font-mono text-white/60">
                  {ranking.desyncAssistsCompleted}/{ranking.desyncAssistsNeeded}
                </p>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full transition-all"
                  style={{ width: `${(ranking.desyncAssistsCompleted / ranking.desyncAssistsNeeded) * 100}%` }}
                />
              </div>
            </div>
            <p className="text-[10px] text-white/30 font-mono">
              Look for tasks being offered by your squad. Accept them. 2× points.
            </p>
          </div>
        )}

        {/* Tasks */}
        <div className="space-y-2">
          {filteredMyTasks.concat(filteredArchetypeTasks).map(task => {
            if (task.id === "code-check-synthetic") {
              return (
                <div key="code-check">
                  <div
                    onClick={() => setShowCodeCheck(!showCodeCheck)}
                    className="bg-akyra-surface border-l-4 border-l-akyra-red border border-akyra-red/40 rounded-xl p-4 cursor-pointer active:scale-[0.98] transition-transform"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-akyra-red animate-pulse" />
                      <p className="font-semibold text-white text-sm">Code Check</p>
                      <span className="text-[9px] font-mono uppercase tracking-widest bg-akyra-red/20 text-akyra-red px-1.5 py-0.5 rounded ml-auto">
                        Critical
                      </span>
                    </div>
                    <p className="text-xs text-akyra-secondary mt-1">
                      {expiringItems.length} item{expiringItems.length > 1 ? "s" : ""} expiring — tap to review
                    </p>
                  </div>

                  {showCodeCheck && (
                    <div className="mt-2">
                      <CodeCheckPanel
                        expiringItems={expiringItems}
                        isActioning={isActioning}
                        onVerifyUsedThrough={verifyUsedThrough}
                        onSubmitWaste={submitWaste}
                      />
                    </div>
                  )}
                </div>
              )
            }

            const isPersonal = task.assigned_to === associate.name
            return (
              <div key={task.id} onTouchStart={() => startTask(task.id)}>
                <TaskCard
                  task={task}
                  isPersonal={isPersonal}
                  onComplete={completeTask}
                  onHold={(taskId, taskName, position) =>
                    setRadialMenu({ taskId, taskName, position })
                  }
                  burnCards={0}
                />
                {phaseFilter && isPersonal && (
                  <button
                    onClick={() => setShowPartialModal({ taskId: task.id, taskName: task.task_name })}
                    className="text-[10px] font-mono text-white/20 hover:text-white/40 transition-colors mt-1 block mx-auto"
                  >
                    Can't finish — hand off
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {filteredMyTasks.length === 0 && filteredArchetypeTasks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-akyra-secondary text-sm">No tasks right now.</p>
            <p className="text-xs font-mono text-akyra-secondary mt-1">Check back in with your MOD.</p>
          </div>
        )}

        {/* Flip Checklist */}
        {tableItems.length > 0 && (
          <FlipChecklist
            items={tableItems}
            station={primaryArchetype}
            onToggle={toggleTableItem}
          />
        )}

        {/* Pull Lists — grouped by category */}
        {["Bread", "Prep"].map(category => {
          const categoryItems = inventoryItems.filter(i => i.category === category)
          if (categoryItems.length === 0) return null
          return (
            <PullList
              key={category}
              items={categoryItems}
              category={category}
              storeId={associate.store_id}
              onUpdateAmountHave={updateAmountHave}
              onPullConfirmed={() => {
                // Refetch tasks — Code Check task may now appear
                refetch()
              }}
            />
          )
        })}
      </div>

      {radialMenu && (
        <RadialMenu
          taskName={radialMenu.taskName}
          position={radialMenu.position}
          hasBurnCard={cards.total > 0}
          onSelect={(direction) => {
            handleRadialAction(direction, radialMenu.taskId)
            setRadialMenu(null)
          }}
          onDismiss={() => setRadialMenu(null)}
        />
      )}

      {sopTask && (
        <SOPViewer
          task={sopTask}
          onDismiss={() => setSopTask(null)}
        />
      )}

      {/* Photo Capture — fast completion verification */}
      {pendingVerification?.triggerType === "fast" && (
        <PhotoCapture
          storeId={associate.store_id}
          label="Show your completed work"
          onCapture={async (url) => {
            await submitAssociatePhoto(pendingVerification.verificationId, url)
            clearPendingVerification()
          }}
          onDismiss={clearPendingVerification}
        />
      )}

      {/* Slow Reason Modal */}
      {pendingVerification?.triggerType === "slow" && (
        <SlowReasonModal
          taskName={
            [...myTasks, ...archetypeTasks].find(t => t.id === pendingVerification.verificationId)?.task_name ?? "Task"
          }
          onSubmit={async (category, notes) => {
            await logSlowCompletionReason(
              associate.store_id,
              pendingVerification.verificationId,
              associate.id,
              category,
              notes,
              pendingVerification.actualMinutes,
              pendingVerification.expectedMinutes
            )
            clearPendingVerification()
          }}
          onEquipmentIssue={() => {
            clearPendingVerification()
            setShowIssueForm(true)
          }}
          onDismiss={clearPendingVerification}
        />
      )}

      {offeringTask && (
        <ArchetypeOfferModal
          taskId={offeringTask.taskId}
          taskName={offeringTask.taskName}
          storeId={associate.store_id}
          fromAssociateId={associate.id}
          fromAssociateName={associate.name}
          orgStations={orgStations.map(s => s.name)}
          onDismiss={() => setOfferingTask(null)}
          onOffered={() => {
            setOfferingTask(null)
            refetch()
          }}
        />
      )}

      {/* Burn Card Modal */}
      {burnCardTask && (
        <BurnCardModal
          taskName={burnCardTask.taskName}
          burnCards={cards.burnCards}
          squadCards={cards.squadCards}
          totalCards={cards.total}
          onConfirm={async () => {
            const success = await spendCard(
              associate.profile_id ?? "",
              burnCardTask.taskId,
              "supervisor-id-placeholder",
              "Your MOD"
            )
            if (success) {
              setCards(prev => ({
                ...prev,
                total: prev.total - 1,
                burnCards: prev.burnCards > 0 ? prev.burnCards - 1 : prev.burnCards,
                squadCards: prev.burnCards > 0 ? prev.squadCards : prev.squadCards - 1,
              }))
              refetch()
            }
          }}
          onDismiss={() => setBurnCardTask(null)}
        />
      )}

      {/* Profile Drawer */}
      {showProfile && ranking && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowProfile(false)} />
          <div className="relative w-full max-w-lg bg-akyra-surface border-t border-akyra-border rounded-t-2xl p-6 space-y-5">

            <div className="text-center space-y-2">
              <TierBadge tier={ranking.tier} isPredator={ranking.isPredator} size="lg" showPoints points={ranking.pointsTotal} />
              <p className="text-white font-bold">{associate.name}</p>
              {ranking.isPredator && (
                <p className="text-[10px] font-mono text-yellow-400/60">
                  Top 3 performer at this store
                </p>
              )}
            </div>

            {/* Points breakdown */}
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary">
                Points Breakdown · 30 Days
              </p>
              {[
                { label: "Tasks completed", value: ranking.pointsTotal - ranking.pointsAssists - (ranking.pointsKillLeader ?? 0) - (ranking.pointsMvp ?? 0) - (ranking.pointsVindicated ?? 0) },
                { label: "Assists given (2×)", value: ranking.pointsAssists },
                { label: "Kill Leader bonuses", value: ranking.pointsKillLeader ?? 0 },
                { label: "MVP bonuses", value: ranking.pointsMvp ?? 0 },
                { label: "Challenge vindicated", value: ranking.pointsVindicated ?? 0 },
              ].filter(row => row.value > 0).map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <p className="text-xs text-akyra-secondary">{row.label}</p>
                  <p className="text-xs font-mono text-white">+{row.value}</p>
                </div>
              ))}
              <div className="h-px bg-akyra-border" />
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-white">Total</p>
                <p className="text-xs font-mono font-bold text-white">{ranking.pointsTotal}</p>
              </div>
            </div>

            {/* Desync status if applicable */}
            {ranking.isDesynced && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 space-y-1">
                <p className="text-xs font-semibold text-orange-400">Desynced</p>
                <p className="text-[10px] text-white/40">
                  Complete {ranking.desyncAssistsNeeded - ranking.desyncAssistsCompleted} more assist{ranking.desyncAssistsNeeded - ranking.desyncAssistsCompleted !== 1 ? "s" : ""} to resync.
                </p>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 rounded-full"
                    style={{ width: `${(ranking.desyncAssistsCompleted / ranking.desyncAssistsNeeded) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={() => setShowProfile(false)}
              className="w-full py-3 rounded-xl border border-akyra-border text-akyra-secondary"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showExtension && (
        <ShiftExtensionModal
          associateId={associate.id}
          storeId={associate.store_id}
          minutesOverdue={minutesOverdue}
          onExtended={() => setShowExtension(false)}
          onLeaving={() => {
            setShowExtension(false)
            if (onLeaving) onLeaving()
          }}
          onLeft={() => {
            navigate("/app/login")
          }}
        />
      )}

      {showEarlyDeparture && (
        <EarlyDepartureModal
          associateId={associate.id}
          storeId={associate.store_id}
          onDeparted={() => navigate("/app/login")}
          onDismiss={() => setShowEarlyDeparture(false)}
        />
      )}

      {showBreakModal && (
        <TakeBreakModal
          associateId={associate.id}
          storeId={associate.store_id}
          onStarted={(breakStartedAt: string) => {
            setShowBreakModal(false)
            setBreakStatus({
              onBreak: true,
              breakTaken: false,
              secondsRemaining: 30 * 60,
              breakStartedAt,
            })
          }}
          onDismiss={() => setShowBreakModal(false)}
        />
      )}

      {showPartialModal && (
        <PartialCompletionModal
          taskId={showPartialModal.taskId}
          taskName={showPartialModal.taskName}
          associateName={associate.name}
          onSaved={() => {
            setShowPartialModal(null)
            refetch()
          }}
          onDismiss={() => setShowPartialModal(null)}
        />
      )}
    </div>
  )
}
