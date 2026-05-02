import { useEffect, useState } from "react"
import type { ComponentType } from "react"
import { useAuth } from "../../context"
import {
  fetchAccountabilityFeed,
  fetchChallengedTasksForStoreManager,
  resolveChallenge,
  fetchEquipmentIssues,
  fetchStoreMetrics,
  fetchDistrictAssociatesLast30Days,
  fetchTimeSuggestions,
  reviewTimeSuggestion,
  fetchChallengePatterns,
  fetchStoreLeaderboard,
  fetchTaskIncidents,
  resolveTaskIncident,
} from "../../lib"
import { LoadingSpinner } from "../../components/LoadingSpinner"
import { HeatmapPanel } from "../../components/HeatmapPanel"
import { TierBadge } from "../../components/TierBadge"
import {
  Trophy,
  AlertTriangle,
  Wrench,
  BarChart3,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Flame,
  Activity,
} from "lucide-react"

type Panel = "performers" | "accountability" | "workorders" | "metrics" | "district" | "hr"

interface StoreMetrics {
  deadCodes: number
  wasteQuantity: number
  totalPulled: number
  wastePercent: number
  tasksCompleted: number
  tasksOrphaned: number
  hoursInTasks: number
  hoursOrphaned: number
}

export function StoreManagerPage() {
  const { state } = useAuth()
  const profile = state.profile
  const storeId = profile?.current_store_id
  const districtId = (profile as any)?.district_id as string | undefined

  const [activePanel, setActivePanel] = useState<Panel>("performers")
  const [loading, setLoading] = useState(false)

  const [feed, setFeed] = useState<any[]>([])
  const [challenges, setChallenges] = useState<any[]>([])
  const [timeSuggestions, setTimeSuggestions] = useState<any[]>([])
  const [equipmentIssues, setEquipmentIssues] = useState<any[]>([])
  const [metrics, setMetrics] = useState<StoreMetrics | null>(null)
  const [districtAssociates, setDistrictAssociates] = useState<any[]>([])
  const [challengePatterns, setChallengePatterns] = useState<any[]>([])
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [incidents, setIncidents] = useState<any[]>([])

  useEffect(() => {
    if (!storeId) return
    setLoading(true)

    const loadPanel = async () => {
      switch (activePanel) {
        case "performers":
          setLeaderboard(await fetchStoreLeaderboard(storeId))
          break
        case "accountability":
          setFeed(await fetchAccountabilityFeed(storeId))
          break
        case "workorders": {
          const [c, t, e, i] = await Promise.all([
            fetchChallengedTasksForStoreManager(storeId),
            fetchTimeSuggestions(storeId),
            fetchEquipmentIssues(storeId),
            fetchTaskIncidents(storeId),
          ])
          setChallenges(c)
          setTimeSuggestions(t)
          setEquipmentIssues(e)
          setIncidents(i)
          break
        }
        case "metrics":
          setMetrics(await fetchStoreMetrics(storeId))
          break
        case "district":
          setDistrictAssociates(await fetchDistrictAssociatesLast30Days(storeId, districtId ?? ""))
          break
        case "hr":
          setChallengePatterns(await fetchChallengePatterns(storeId))
          break
      }
      setLoading(false)
    }

    loadPanel()
  }, [activePanel, storeId, districtId])

  if (!storeId) {
    return (
      <div className="text-center text-akyra-secondary py-12 font-mono text-sm">
        No store assigned
      </div>
    )
  }

  const panels: { id: Panel; icon: ComponentType<{ className?: string }>; label: string }[] = [
    { id: "performers", icon: Trophy, label: "Performers" },
    { id: "accountability", icon: Flame, label: "Feed" },
    { id: "workorders", icon: Wrench, label: "Work Orders" },
    { id: "metrics", icon: BarChart3, label: "Metrics" },
    { id: "district", icon: Users, label: "District" },
    { id: "hr", icon: Activity, label: "HR" },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Manager View</h1>
        <p className="text-xs text-akyra-secondary font-mono uppercase tracking-widest">Store Overview</p>
      </div>

      {/* Panel tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {panels.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActivePanel(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono uppercase tracking-widest shrink-0 transition-colors ${
              activePanel === id
                ? "bg-white text-black"
                : "bg-akyra-surface border border-akyra-border text-akyra-secondary hover:text-white"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="space-y-3">
          {activePanel === "performers" && (
            <PerformersPanel leaderboard={leaderboard} />
          )}
          {activePanel === "accountability" && (
            <AccountabilityPanel feed={feed} />
          )}
          {activePanel === "workorders" && (
            <WorkOrdersPanel
              challenges={challenges}
              timeSuggestions={timeSuggestions}
              equipmentIssues={equipmentIssues}
              incidents={incidents}
              profileId={profile?.id ?? ""}
              onChallengeResolved={async () => {
                setChallenges(await fetchChallengedTasksForStoreManager(storeId))
              }}
              onTimeSuggestionReviewed={async () => {
                setTimeSuggestions(await fetchTimeSuggestions(storeId))
              }}
              onIncidentResolved={async () => {
                setIncidents(await fetchTaskIncidents(storeId))
              }}
            />
          )}
          {activePanel === "metrics" && (
            <MetricsPanel metrics={metrics} />
          )}
          {activePanel === "district" && (
            <DistrictPanel associates={districtAssociates} />
          )}
          {activePanel === "hr" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
                  Challenge Patterns · 90 Days
                </p>
                {challengePatterns.filter(p => p.flagLevel !== "watch").length > 0 && (
                  <span className="text-[10px] font-mono text-akyra-red">
                    {challengePatterns.filter(p => p.flagLevel !== "watch").length} flagged
                  </span>
                )}
              </div>

              {challengePatterns.length === 0 ? (
                <div className="bg-akyra-surface border border-akyra-border rounded-xl p-6 text-center">
                  <p className="text-sm text-akyra-secondary">No patterns detected.</p>
                  <p className="text-xs text-white/20 mt-1 font-mono">Clean slate.</p>
                </div>
              ) : (
                <>
                  <HeatmapPanel
                    title="Associate × Task — Retrain Signals"
                    xAxisLabel="Task"
                    yAxisLabel="Associate"
                    cells={challengePatterns
                      .filter(p => p.patternType === "associate_task")
                      .map(p => ({
                        xLabel: p.taskName,
                        yLabel: p.associateName,
                        count: p.challengeCount,
                        flagLevel: p.flagLevel,
                        patternId: p.id,
                      }))}
                    onCellTap={() => {}}
                  />

                  <HeatmapPanel
                    title="Supervisor × Task — SOP Signals"
                    xAxisLabel="Task"
                    yAxisLabel="Supervisor"
                    cells={challengePatterns
                      .filter(p => p.patternType === "supervisor_task")
                      .map(p => ({
                        xLabel: p.taskName,
                        yLabel: p.supervisorName ?? "Unknown",
                        count: p.challengeCount,
                        flagLevel: p.flagLevel,
                        patternId: p.id,
                      }))}
                    onCellTap={() => {}}
                  />

                  <HeatmapPanel
                    title="Supervisor × Associate — Bias Signals"
                    xAxisLabel="Associate"
                    yAxisLabel="Supervisor"
                    cells={challengePatterns
                      .filter(p => p.patternType === "associate_supervisor")
                      .map(p => ({
                        xLabel: p.associateName,
                        yLabel: p.supervisorName ?? "Unknown",
                        count: p.challengeCount,
                        flagLevel: p.flagLevel,
                        patternId: p.id,
                      }))}
                    onCellTap={() => {}}
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-panels ─────────────────────────────────────────────────────────────

function PerformersPanel({ leaderboard }: { leaderboard: any[] }) {
  if (leaderboard.length === 0) {
    return <EmptyState label="No ranking data yet. Complete a shift to see rankings." />
  }

  return (
    <div className="space-y-4">
      {/* Predator highlight */}
      {leaderboard.filter(r => r.isPredator).length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-yellow-400/60">
            🔱 Predators — Succession Candidates
          </p>
          {leaderboard.filter(r => r.isPredator).map((r) => (
            <div key={r.associateId} className="bg-yellow-500/[0.05] border border-yellow-500/20 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">{r.associateName}</p>
                  <p className="text-xs text-yellow-400/60 font-mono mt-0.5">
                    Ready for supervisor consideration
                  </p>
                </div>
                <div className="text-right">
                  <TierBadge tier="Predator" isPredator size="sm" />
                  <p className="text-[10px] font-mono text-white/30 mt-1">
                    {r.pointsTotal} pts
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full leaderboard */}
      <div className="space-y-2">
        <p className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary">
          Store Leaderboard · 30 Days
        </p>
        {leaderboard.map((r, i) => (
          <div
            key={r.associateId}
            className={`flex items-center justify-between bg-akyra-surface border rounded-xl px-4 py-3 ${
              r.isPredator ? "border-yellow-500/20" :
              r.isDesynced ? "border-orange-500/20" :
              "border-akyra-border"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`text-sm font-black w-5 text-center ${
                i === 0 ? "text-yellow-400" :
                i === 1 ? "text-white/50" :
                i === 2 ? "text-white/30" :
                "text-white/20"
              }`}>
                {i + 1}
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-white text-sm">{r.associateName}</p>
                  {r.isDesynced && (
                    <span className="text-[9px] text-orange-400" title="Desynced">⚡</span>
                  )}
                </div>
                <p className="text-[10px] font-mono text-white/30">
                  {r.pointsAssists > 0 && `${r.pointsAssists} assist pts · `}
                  {r.pointsTotal} total
                </p>
              </div>
            </div>
            <TierBadge tier={r.tier} isPredator={r.isPredator} size="sm" />
          </div>
        ))}
      </div>
    </div>
  )
}

function AccountabilityPanel({ feed }: { feed: any[] }) {
  if (feed.length === 0) {
    return <EmptyState label="No verification events yet" />
  }

  const typeLabel: Record<string, string> = {
    fast: "Fast",
    slow: "Slow",
    challenge: "Challenged",
    accepted: "Accepted",
  }
  const typeColor: Record<string, string> = {
    fast: "text-green-400",
    slow: "text-akyra-red",
    challenge: "text-yellow-400",
    accepted: "text-akyra-secondary",
  }

  return (
    <div className="space-y-2">
      {feed.map(v => (
        <div key={v.id} className="bg-akyra-surface border border-akyra-border rounded-xl p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white">{v.taskName}</p>
              <p className="text-[10px] font-mono text-akyra-secondary">{v.associateName}</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-xs font-bold font-mono uppercase ${typeColor[v.type] ?? "text-akyra-secondary"}`}>
                {typeLabel[v.type] ?? v.type}
              </p>
              <p className="text-[10px] font-mono text-akyra-secondary">
                {Math.abs(v.deltaPct)}% {v.deltaPct > 0 ? "over" : "under"}
              </p>
            </div>
          </div>
          {v.supervisorName && (
            <p className="mt-1 text-[10px] font-mono text-akyra-secondary">
              Sup: {v.supervisorName}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

interface WorkOrdersPanelProps {
  challenges: any[]
  timeSuggestions: any[]
  equipmentIssues: any[]
  incidents: any[]
  profileId: string
  onChallengeResolved: () => Promise<void>
  onTimeSuggestionReviewed: () => Promise<void>
  onIncidentResolved: () => Promise<void>
}

function WorkOrdersPanel({
  challenges,
  timeSuggestions,
  equipmentIssues,
  incidents,
  profileId,
  onChallengeResolved,
  onTimeSuggestionReviewed,
  onIncidentResolved,
}: WorkOrdersPanelProps) {
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  async function handleChallenge(id: string, verdict: "complete" | "incomplete") {
    setResolvingId(id)
    await resolveChallenge(id, profileId, verdict)
    await onChallengeResolved()
    setResolvingId(null)
  }

  async function handleTimeSuggestion(id: string, apply: boolean, taskId?: string, newMinutes?: number) {
    setReviewingId(id)
    await reviewTimeSuggestion(id, profileId, apply, taskId, newMinutes)
    await onTimeSuggestionReviewed()
    setReviewingId(null)
  }

  const hasAnything = challenges.length > 0 || timeSuggestions.length > 0 || equipmentIssues.length > 0 || incidents.length > 0

  if (!hasAnything) {
    return <EmptyState label="No open work orders" />
  }

  return (
    <div className="space-y-4">
      {incidents.filter(i => !i.isResolved).length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[#E63946]/60">
            ⚠ Neglected Tasks — Formal Incidents
          </p>
          {incidents.filter(i => !i.isResolved).map(incident => (
            <div
              key={incident.id}
              className="bg-[#E63946]/[0.05] border border-[#E63946]/30 rounded-xl p-4 space-y-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-white">{incident.taskName}</p>
                  <p className="text-xs font-mono text-[#E63946]/60">
                    {incident.neglectCount} shift{incident.neglectCount !== 1 ? "s" : ""} neglected · {incident.shiftBucket}
                  </p>
                  <p className="text-[10px] text-white/20 mt-0.5">
                    First missed: {new Date(incident.firstNeglectedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-[9px] font-mono text-[#E63946] border border-[#E63946]/30 rounded px-2 py-0.5 shrink-0">
                  Incident
                </span>
              </div>

              <button
                onClick={async () => {
                  const notes = `Resolved by Store Manager`
                  await resolveTaskIncident(incident.id, profileId, notes)
                  await onIncidentResolved()
                }}
                className="text-xs font-mono text-white/30 hover:text-white transition-colors"
              >
                Mark Resolved →
              </button>
            </div>
          ))}
        </div>
      )}
      {challenges.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-akyra-secondary uppercase tracking-widest">Challenged Tasks</p>
          {challenges.map(c => (
            <div key={c.id} className="bg-akyra-surface border border-yellow-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">{c.tasks?.task_name ?? "Unknown Task"}</p>
                  <p className="text-[10px] font-mono text-akyra-secondary">{c.associates?.name}</p>
                </div>
                <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
              </div>

              {/* Photo layout — Before/After not Supervisor/Associate */}
              <div className="grid grid-cols-2 gap-2">
                {c.supervisor_photo_url && (
                  <div>
                    <p className="text-[10px] font-mono text-akyra-secondary mb-1 uppercase tracking-widest">
                      Before
                    </p>
                    <img
                      src={c.supervisor_photo_url}
                      alt="Before"
                      className="w-full rounded-lg border border-akyra-border"
                    />
                    <p className="text-[9px] text-white/30 mt-0.5">At time of rejection</p>
                  </div>
                )}
                {c.associate_photo_url && (
                  <div>
                    <p className="text-[10px] font-mono text-akyra-secondary mb-1 uppercase tracking-widest">
                      After
                    </p>
                    <img
                      src={c.associate_photo_url}
                      alt="After"
                      className="w-full rounded-lg border border-akyra-border"
                    />
                    <p className="text-[9px] text-white/30 mt-0.5">When marked complete</p>
                  </div>
                )}
              </div>

              {/* Associate context */}
              {(c.slow_reason_category || c.slow_reason_notes) && (
                <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
                  <p className="text-[10px] font-mono text-akyra-secondary uppercase tracking-widest mb-1">
                    Associate Context
                  </p>
                  {c.slow_reason_category && (
                    <p className="text-sm font-bold text-white mb-1">
                      {c.slow_reason_category.replace(/_/g, " ")}
                    </p>
                  )}
                  {c.slow_reason_notes && (
                    <p className="text-xs text-akyra-secondary italic">"{c.slow_reason_notes}"</p>
                  )}
                </div>
              )}

              {c.challenge_note && (
                <p className="text-xs text-akyra-secondary italic">"{c.challenge_note}"</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => handleChallenge(c.id, "complete")}
                  disabled={resolvingId === c.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-bold hover:bg-green-500/30 disabled:opacity-50"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Complete
                </button>
                <button
                  onClick={() => handleChallenge(c.id, "incomplete")}
                  disabled={resolvingId === c.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-akyra-red text-xs font-bold hover:bg-red-500/30 disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" /> Incomplete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {timeSuggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-akyra-secondary uppercase tracking-widest">Time Suggestions</p>
          {timeSuggestions.map(s => (
            <div key={s.id} className="bg-akyra-surface border border-akyra-border rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">{s.tasks?.task_name ?? "Unknown Task"}</p>
                  <p className="text-[10px] font-mono text-akyra-secondary">
                    Current: {s.tasks?.expected_minutes}m → Suggested: {s.suggested_minutes}m
                  </p>
                </div>
                <Clock className="w-4 h-4 text-akyra-secondary shrink-0" />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleTimeSuggestion(s.id, true, s.task_id, s.suggested_minutes)}
                  disabled={reviewingId === s.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-bold hover:bg-green-500/30 disabled:opacity-50"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Apply
                </button>
                <button
                  onClick={() => handleTimeSuggestion(s.id, false)}
                  disabled={reviewingId === s.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-akyra-black border border-akyra-border text-akyra-secondary text-xs font-bold hover:text-white disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" /> Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {equipmentIssues.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-akyra-secondary uppercase tracking-widest">Equipment Issues</p>
          {equipmentIssues.map(e => (
            <div key={e.id} className="bg-akyra-surface border border-akyra-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">{e.equipment_name ?? e.category ?? "Equipment"}</p>
                  <p className="text-xs text-akyra-secondary">{e.description ?? "No description"}</p>
                </div>
                <Wrench className="w-4 h-4 text-akyra-secondary shrink-0" />
              </div>
              {e.status && (
                <p className="mt-2 text-[10px] font-mono uppercase tracking-widest text-akyra-secondary">{e.status}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MetricsPanel({ metrics }: { metrics: StoreMetrics | null }) {
  if (!metrics) {
    return <EmptyState label="No metrics available" />
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <MetricCard label="Tasks Completed" value={metrics.tasksCompleted} />
      <MetricCard label="Tasks Orphaned" value={metrics.tasksOrphaned} />
      <MetricCard label="Hours in Tasks" value={`${metrics.hoursInTasks}h`} />
      <MetricCard label="Hours Orphaned" value={`${metrics.hoursOrphaned}h`} />
      <MetricCard label="Total Pulled" value={metrics.totalPulled} />
      <MetricCard label="Waste %" value={`${metrics.wastePercent}%`} red={metrics.wastePercent > 10} />
      <MetricCard label="Dead Codes" value={metrics.deadCodes} red={metrics.deadCodes > 5} />
      <MetricCard label="Waste Qty" value={metrics.wasteQuantity} />
    </div>
  )
}

function MetricCard({ label, value, red }: { label: string; value: string | number; red?: boolean }) {
  return (
    <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4">
      <p className={`text-2xl font-black ${red ? "text-akyra-red" : "text-white"}`}>{value}</p>
      <p className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary mt-1">{label}</p>
    </div>
  )
}

function DistrictPanel({ associates }: { associates: any[] }) {
  if (associates.length === 0) {
    return <EmptyState label="No district activity in the last 30 days" />
  }
  return (
    <div className="space-y-2">
      {associates.map((a, i) => (
        <div key={i} className="bg-akyra-surface border border-akyra-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-white text-sm">{a.name ?? "Unknown"}</p>
              <p className="text-[10px] font-mono text-akyra-secondary">{a.store_name ?? "Unknown Store"}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-white">{a.visit_count ?? 0}</p>
              <p className="text-[10px] font-mono text-akyra-secondary uppercase tracking-widest">visits</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center text-akyra-secondary py-12 font-mono text-sm">{label}</div>
  )
}
