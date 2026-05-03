import { useState, useEffect } from "react"
import { X, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react"
import { LoadingSpinner } from "../../components/LoadingSpinner"
import {
  fetchOrgStations,
  createOrgStation,
  updateOrgStation,
  deleteOrgStation,
  reorderOrgStations,
} from "../../lib"
import type { OrgStation } from "../../types"

interface StationManagerProps {
  orgId: string
  orgName: string
  onDone: () => void
}

const COMMON_EMOJIS = ["🍳", "🖥️", "⚡", "👑", "🥤", "🧹", "🌾", "🐄", "🔧", "📦", "🎯", "⭐"]

export function StationManager({ orgId, orgName, onDone }: StationManagerProps) {
  const [stations, setStations] = useState<OrgStation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [newStation, setNewStation] = useState({
    name: "",
    emoji: "⚡",
    description: "",
    isSupervisorOnly: false,
    isFloat: false,
  })

  const [editValues, setEditValues] = useState<Record<string, Partial<OrgStation>>>({})

  useEffect(() => {
    fetchOrgStations(orgId).then(data => {
      setStations(data)
      setIsLoading(false)
    })
  }, [orgId])

  async function handleAdd() {
    if (!newStation.name.trim()) return
    setIsSaving(true)

    const success = await createOrgStation(orgId, {
      ...newStation,
      displayOrder: stations.length + 1,
    })

    if (success) {
      const updated = await fetchOrgStations(orgId)
      setStations(updated)
      setNewStation({ name: "", emoji: "⚡", description: "", isSupervisorOnly: false, isFloat: false })
      setIsAdding(false)
    }
    setIsSaving(false)
  }

  async function handleUpdate(stationId: string) {
    const updates = editValues[stationId]
    if (!updates) return
    setIsSaving(true)

    await updateOrgStation(stationId, updates)
    const updated = await fetchOrgStations(orgId)
    setStations(updated)
    setEditingId(null)
    setIsSaving(false)
  }

  async function handleDelete(stationId: string) {
    if (!confirm("Remove this station? Associates currently using it will keep their archetype but the station won't appear for new claims.")) return
    await deleteOrgStation(stationId)
    setStations(prev => prev.filter(s => s.id !== stationId))
  }

  async function handleMove(index: number, direction: "up" | "down") {
    const newStations = [...stations]
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newStations.length) return

    ;[newStations[index], newStations[targetIndex]] = [newStations[targetIndex], newStations[index]]

    const reordered = newStations.map((s, i) => ({ ...s, displayOrder: i + 1 }))
    setStations(reordered)
    await reorderOrgStations(reordered.map(s => ({ id: s.id, displayOrder: s.displayOrder })))
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-y-auto">
      <div className="max-w-lg mx-auto px-6 py-8 space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Stations</h2>
            <p className="text-xs font-mono text-akyra-secondary">{orgName}</p>
          </div>
          <button onClick={onDone} className="text-akyra-secondary hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-xs text-akyra-secondary">
          Stations are the archetypes associates claim at the start of their shift. Order matters — it's the order shown on the claim screen.
        </p>

        {/* Station list */}
        <div className="space-y-2">
          {stations.map((station, index) => (
            <div key={station.id}>
              {editingId === station.id ? (
                // Edit mode
                <div className="bg-akyra-surface border border-white/20 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-akyra-secondary">Emoji</label>
                      <div className="flex flex-wrap gap-1">
                        {COMMON_EMOJIS.map(e => (
                          <button
                            key={e}
                            onClick={() => setEditValues(p => ({ ...p, [station.id]: { ...p[station.id], emoji: e } }))}
                            className={`text-lg p-1 rounded ${
                              (editValues[station.id]?.emoji ?? station.emoji) === e
                                ? "bg-white/20"
                                : "hover:bg-white/10"
                            }`}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-akyra-secondary">Name</label>
                      <input
                        value={editValues[station.id]?.name ?? station.name}
                        onChange={e => setEditValues(p => ({ ...p, [station.id]: { ...p[station.id], name: e.target.value } }))}
                        className="w-full bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-akyra-secondary">Description</label>
                    <input
                      value={editValues[station.id]?.description ?? station.description ?? ""}
                      onChange={e => setEditValues(p => ({ ...p, [station.id]: { ...p[station.id], description: e.target.value } }))}
                      className="w-full bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white"
                      placeholder="Short description..."
                    />
                  </div>

                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs text-akyra-secondary">
                      <input
                        type="checkbox"
                        checked={editValues[station.id]?.isSupervisorOnly ?? station.isSupervisorOnly}
                        onChange={e => setEditValues(p => ({ ...p, [station.id]: { ...p[station.id], isSupervisorOnly: e.target.checked } }))}
                        className="accent-white"
                      />
                      Supervisor only
                    </label>
                    <label className="flex items-center gap-2 text-xs text-akyra-secondary">
                      <input
                        type="checkbox"
                        checked={editValues[station.id]?.isFloat ?? station.isFloat}
                        onChange={e => setEditValues(p => ({ ...p, [station.id]: { ...p[station.id], isFloat: e.target.checked } }))}
                        className="accent-white"
                      />
                      Float (wildcard)
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex-1 py-2 rounded-lg border border-akyra-border text-akyra-secondary text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleUpdate(station.id)}
                      disabled={isSaving}
                      className="flex-1 py-2 rounded-lg bg-white text-black text-sm font-semibold disabled:opacity-50"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                // Display mode
                <div className="flex items-center gap-3 bg-akyra-surface border border-akyra-border rounded-xl p-3">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleMove(index, "up")}
                      disabled={index === 0}
                      className="text-akyra-secondary hover:text-white disabled:opacity-20"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleMove(index, "down")}
                      disabled={index === stations.length - 1}
                      className="text-akyra-secondary hover:text-white disabled:opacity-20"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>

                  <span className="text-xl">{station.emoji}</span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{station.name}</p>
                      {station.isSupervisorOnly && (
                        <span className="text-[9px] font-mono text-akyra-secondary border border-akyra-border rounded px-1.5 py-0.5">
                          Sup only
                        </span>
                      )}
                      {station.isFloat && (
                        <span className="text-[9px] font-mono text-akyra-secondary border border-akyra-border rounded px-1.5 py-0.5">
                          Float
                        </span>
                      )}
                    </div>
                    {station.description && (
                      <p className="text-xs text-akyra-secondary truncate">{station.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingId(station.id)
                        setEditValues(p => ({ ...p, [station.id]: {} }))
                      }}
                      className="text-xs font-mono text-akyra-secondary hover:text-white transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(station.id)}
                      className="text-akyra-secondary hover:text-akyra-red transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add new station */}
        {isAdding ? (
          <div className="bg-akyra-surface border border-white/20 rounded-xl p-4 space-y-3">
            <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
              New Station
            </p>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-akyra-secondary">Emoji</label>
              <div className="flex flex-wrap gap-1">
                {COMMON_EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => setNewStation(p => ({ ...p, emoji: e }))}
                    className={`text-lg p-1 rounded ${newStation.emoji === e ? "bg-white/20" : "hover:bg-white/10"}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <input
              placeholder="Station name (e.g. Farmhand, Drinks, Greeter)"
              value={newStation.name}
              onChange={e => setNewStation(p => ({ ...p, name: e.target.value }))}
              autoFocus
              className="w-full bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white"
            />

            <input
              placeholder="Description (optional)"
              value={newStation.description}
              onChange={e => setNewStation(p => ({ ...p, description: e.target.value }))}
              className="w-full bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white"
            />

            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs text-akyra-secondary">
                <input
                  type="checkbox"
                  checked={newStation.isSupervisorOnly}
                  onChange={e => setNewStation(p => ({ ...p, isSupervisorOnly: e.target.checked }))}
                  className="accent-white"
                />
                Supervisor only
              </label>
              <label className="flex items-center gap-2 text-xs text-akyra-secondary">
                <input
                  type="checkbox"
                  checked={newStation.isFloat}
                  onChange={e => setNewStation(p => ({ ...p, isFloat: e.target.checked }))}
                  className="accent-white"
                />
                Float (wildcard)
              </label>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsAdding(false)}
                className="flex-1 py-2.5 rounded-xl border border-akyra-border text-akyra-secondary font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!newStation.name.trim() || isSaving}
                className="flex-1 py-2.5 rounded-xl bg-white text-black font-bold disabled:opacity-50"
              >
                {isSaving ? "Adding..." : "Add Station"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full py-3 rounded-xl border border-dashed border-akyra-border text-akyra-secondary hover:border-white/40 hover:text-white transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Station
          </button>
        )}
      </div>
    </div>
  )
}
