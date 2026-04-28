import { useEffect, useState } from "react"
import { useAuth } from "../../context"
import {
  fetchTasksForSupervisor,
  fetchStoreMetrics,
  fetchProfilesForStore,
  seedAssociatesForStore,
  getAssociateBurnCards,
  createJitTask,
} from "../../lib"
import { LoadingSpinner } from "../../components/LoadingSpinner"
import { TaskCard } from "../../components/TaskCard"
import { CreateTaskFAB } from "../../components/CreateTaskFAB"
import { BarChart3, UserPlus, ClipboardList, Plus } from "lucide-react"
import type { StoreConfigAssociate } from "../../types"

type Panel = "tasks" | "metrics" | "roster"

const ROLES = ["crew", "supervisor", "assistant_manager"]

export function AssistantManagerPage() {
  const { state } = useAuth()
  const storeId = state.profile?.current_store_id
  const profileId = state.profile?.id
  const [activePanel, setActivePanel] = useState<Panel>("tasks")
  const [isLoading, setIsLoading] = useState(true)

  // Tasks
  const [modTasks, setModTasks] = useState<any[]>([])
  const [isCreating, setIsCreating] = useState(false)

  // Metrics
  const [metrics, setMetrics] = useState<any>(null)

  // Roster
  const [profiles, setProfiles] = useState<any[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newAssoc, setNewAssoc] = useState<Partial<StoreConfigAssociate>>({
    role: "crew",
    default_start_time: "22:00",
    default_end_time: "06:30",
  })
  const [isAdding, setIsAdding] = useState(false)

  // Burn cards
  const [burnCards, setBurnCards] = useState(0)

  useEffect(() => {
    if (!storeId || !profileId) return
    setIsLoading(true)

    Promise.all([
      fetchTasksForSupervisor(storeId),
      fetchStoreMetrics(storeId, 30),
      fetchProfilesForStore(storeId),
      getAssociateBurnCards(profileId),
    ]).then(([tasks, m, p, bc]) => {
      setModTasks(tasks.filter(t => t.archetype === "MOD"))
      setMetrics(m)
      setProfiles(p)
      setBurnCards(bc)
      setIsLoading(false)
    })
  }, [storeId, profileId])

  async function handleAddAssociate() {
    if (!storeId || !newAssoc.name || !newAssoc.eeid) return
    setIsAdding(true)

    await seedAssociatesForStore(storeId, [newAssoc as StoreConfigAssociate])
    const updated = await fetchProfilesForStore(storeId)
    setProfiles(updated)
    setNewAssoc({ role: "crew", default_start_time: "22:00", default_end_time: "06:30" })
    setShowAddForm(false)
    setIsAdding(false)
  }

  const PANELS: { id: Panel; label: string; icon: React.ReactNode }[] = [
    { id: "tasks", label: "Tasks", icon: <ClipboardList className="w-4 h-4" /> },
    { id: "metrics", label: "Metrics", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "roster", label: "Roster", icon: <UserPlus className="w-4 h-4" /> },
  ]

  if (isLoading) {
    return <div className="flex justify-center py-12"><LoadingSpinner /></div>
  }

  return (
    <div className="space-y-6 pb-32">
      <h2 className="text-2xl font-black text-white">Assistant Manager</h2>

      {/* Panel nav */}
      <div className="flex gap-1">
        {PANELS.map(panel => (
          <button
            key={panel.id}
            onClick={() => setActivePanel(panel.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-mono uppercase tracking-widest transition-all ${
              activePanel === panel.id
                ? "bg-white text-black"
                : "text-akyra-secondary hover:text-white border border-akyra-border"
            }`}
          >
            {panel.icon}
            {panel.label}
          </button>
        ))}
      </div>

      {/* Tasks */}
      {activePanel === "tasks" && (
        <div className="space-y-3">
          {modTasks.length === 0 ? (
            <p className="text-sm text-akyra-secondary">No MOD tasks right now.</p>
          ) : modTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              isPersonal={true}
              onComplete={(id) => {
                setModTasks(prev => prev.filter(t => t.id !== id))
              }}
              burnCards={burnCards}
            />
          ))}
        </div>
      )}

      {/* Metrics */}
      {activePanel === "metrics" && metrics && (
        <div className="space-y-4">
          <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
            Last 30 Days
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4">
              <p className="text-[10px] font-mono text-akyra-secondary uppercase tracking-widest mb-1">Dead Codes</p>
              <p className="text-3xl font-black text-akyra-red">{metrics.deadCodes}</p>
              <p className="text-xs text-akyra-secondary mt-1">{metrics.wasteQuantity} units wasted</p>
            </div>
            <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4">
              <p className="text-[10px] font-mono text-akyra-secondary uppercase tracking-widest mb-1">Waste %</p>
              <p className="text-3xl font-black text-white">{metrics.wastePercent}%</p>
              <p className="text-xs text-akyra-secondary mt-1">of {metrics.totalPulled} pulled</p>
            </div>
            <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4">
              <p className="text-[10px] font-mono text-akyra-secondary uppercase tracking-widest mb-1">Hours Saved</p>
              <p className="text-3xl font-black text-white">{metrics.hoursInTasks}h</p>
              <p className="text-xs text-akyra-secondary mt-1">{metrics.tasksCompleted} tasks done</p>
            </div>
            <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4">
              <p className="text-[10px] font-mono text-akyra-secondary uppercase tracking-widest mb-1">Hours Bled</p>
              <p className="text-3xl font-black text-akyra-red">{metrics.hoursOrphaned}h</p>
              <p className="text-xs text-akyra-secondary mt-1">{metrics.tasksOrphaned} orphaned</p>
            </div>
          </div>
        </div>
      )}

      {/* Roster — Add only, no remove */}
      {activePanel === "roster" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
              Store Roster · {profiles.length}
            </p>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 text-xs font-mono text-white border border-akyra-border rounded-lg px-3 py-1.5 hover:border-white/40 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>

          {showAddForm && (
            <div className="bg-akyra-surface border border-white/20 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="EEID"
                  value={newAssoc.eeid ?? ""}
                  onChange={e => setNewAssoc(p => ({ ...p, eeid: e.target.value }))}
                  className="bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white"
                />
                <input
                  placeholder="Full Name"
                  value={newAssoc.name ?? ""}
                  onChange={e => setNewAssoc(p => ({ ...p, name: e.target.value }))}
                  className="bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white"
                />
                <select
                  value={newAssoc.role ?? "crew"}
                  onChange={e => setNewAssoc(p => ({ ...p, role: e.target.value }))}
                  className="col-span-2 bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-2 rounded-lg border border-akyra-border text-akyra-secondary text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddAssociate}
                  disabled={!newAssoc.name || !newAssoc.eeid || isAdding}
                  className="flex-1 py-2 rounded-lg bg-white text-black text-sm font-bold disabled:opacity-50"
                >
                  {isAdding ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          )}

          {profiles.map(profile => (
            <div key={profile.id} className="flex items-center justify-between bg-akyra-surface border border-akyra-border rounded-xl px-4 py-3">
              <div>
                <p className="font-semibold text-white">{profile.display_name}</p>
                <p className="text-xs font-mono text-akyra-secondary">
                  {profile.eeid} · {profile.role}
                </p>
              </div>
              <div className={`w-2 h-2 rounded-full ${profile.auth_uid ? "bg-white" : "bg-akyra-red"}`} />
            </div>
          ))}
        </div>
      )}

      {/* FAB for task creation */}
      {activePanel === "tasks" && storeId && (
        <CreateTaskFAB
          isCreating={isCreating}
          onCreateTask={async (name, archetype, priority) => {
            setIsCreating(true)
            const task = await createJitTask(storeId, name, archetype, priority)
            if (task?.archetype === "MOD") {
              setModTasks(prev => [task, ...prev])
            }
            setIsCreating(false)
            return task
          }}
        />
      )}
    </div>
  )
}
