import { useState, useRef, ReactNode } from "react"
import { X, Upload, PenLine, Download, Plus, Trash2, FileJson } from "lucide-react"
import { LoadingSpinner } from "../../components/LoadingSpinner"
import Papa from "papaparse"
import {
  seedAssociatesForStore,
  seedTasksForStore,
  seedInventoryForStore,
  seedTableItemsForStore,
  exportStoreConfig,
} from "../../lib"
import type {
  StoreConfig,
  StoreConfigAssociate,
  StoreConfigTask,
  StoreConfigInventoryItem,
  StoreConfigTableItem,
} from "../../types"

type Tab = "upload" | "manual" | "export"
type ManualSection = "associates" | "tasks" | "inventory" | "table_items"

interface StoreSetupWizardProps {
  storeId: string
  storeName: string
  orgStations: string[]
  onDone: () => void
}

interface SeedCategoryResult {
  success: number
  failed: number
  errors?: string[]
}

interface SeedResult {
  associates?: SeedCategoryResult
  tasks?: SeedCategoryResult
  inventory?: SeedCategoryResult
  tableItems?: SeedCategoryResult
}

export function StoreSetupWizard({
  storeId,
  storeName,
  orgStations,
  onDone,
}: StoreSetupWizardProps) {
  const [tab, setTab] = useState<Tab>("upload")
  const [isSeeding, setIsSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [parsedConfig, setParsedConfig] = useState<StoreConfig | null>(null)
  const [manualSection, setManualSection] = useState<ManualSection>("associates")
  const fileRef = useRef<HTMLInputElement>(null)

  // Manual entry state
  const [manualAssociates, setManualAssociates] = useState<StoreConfigAssociate[]>([])
  const [manualTasks, setManualTasks] = useState<StoreConfigTask[]>([])
  const [manualInventory, setManualInventory] = useState<StoreConfigInventoryItem[]>([])
  const [manualTableItems, setManualTableItems] = useState<StoreConfigTableItem[]>([])

  // New row forms
  const [newAssoc, setNewAssoc] = useState<Partial<StoreConfigAssociate>>({
    default_start_time: "22:00", default_end_time: "06:30", role: "crew"
  })
  const [newTask, setNewTask] = useState<Partial<StoreConfigTask>>({
    priority: "Normal", is_sticky: false, expected_minutes: 15, archetype: orgStations[0] ?? "Float"
  })
  const [newInventory, setNewInventory] = useState<Partial<StoreConfigInventoryItem>>({
    category: "Prep", amount_needed: 1
  })
  const [newTableItem, setNewTableItem] = useState<Partial<StoreConfigTableItem>>({
    station: orgStations[0] ?? "Starter"
  })

  // Parse uploaded file
  async function handleFile(file: File) {
    const text = await file.text()

    if (file.name.endsWith(".json")) {
      try {
        const config = JSON.parse(text) as StoreConfig
        setParsedConfig(config)
      } catch {
        alert("Invalid JSON file")
      }
      return
    }

    // CSV — infer type from filename
    const lower = file.name.toLowerCase()
    const { data } = Papa.parse<Record<string, string>>(text, {
      header: true, skipEmptyLines: true,
    })

    if (lower.includes("associate")) {
      const associates = data.map(r => ({
        eeid: r.eeid ?? r.EEID ?? "",
        name: r.name ?? r.Name ?? "",
        role: r.role ?? r.Role ?? "crew",
        default_start_time: r.default_start_time ?? "22:00",
        default_end_time: r.default_end_time ?? "06:30",
      }))
      setParsedConfig(prev => ({ ...prev, associates }))
    } else if (lower.includes("task")) {
      const tasks = data.map(r => ({
        task_name: r.task_name ?? r["Task Name"] ?? "",
        archetype: r.archetype ?? r.Archetype ?? "Float",
        priority: (r.priority ?? r.Priority ?? "Normal") as StoreConfigTask["priority"],
        is_sticky: r.is_sticky === "true" || r.is_sticky === "1",
        expected_minutes: parseInt(r.expected_minutes ?? "15") || 15,
      }))
      setParsedConfig(prev => ({ ...prev, tasks }))
    } else if (lower.includes("prep") || lower.includes("bread")) {
      const category = lower.includes("bread") ? "Bread" : "Prep"
      const inventory = data.map(r => ({
        item_name: r["Item Name"] ?? r.item_name ?? "",
        category,
        amount_needed: parseInt(r.amount_needed ?? r["Pull Amount"] ?? "1") || 1,
        code_life_days: r.code_life_days ? parseInt(r.code_life_days) : undefined,
      }))
      setParsedConfig(prev => ({ ...prev, inventory: [...(prev?.inventory ?? []), ...inventory] }))
    } else if (lower.includes("starter") || lower.includes("finisher")) {
      const station = lower.includes("starter") ? "Starter" :
                      lower.includes("finisher_a") || lower.includes("finisher a") ? "Finisher A" :
                      "Finisher B"
      const tableItems = data.map(r => ({
        item_name: r["Item Name"] ?? r.item_name ?? "",
        station,
      }))
      setParsedConfig(prev => ({ ...prev, table_items: [...(prev?.table_items ?? []), ...tableItems] }))
    }
  }

  async function handleSeed() {
    if (!parsedConfig) return
    setIsSeeding(true)
    const result: SeedResult = {}

    if (parsedConfig.associates?.length) {
      result.associates = await seedAssociatesForStore(storeId, parsedConfig.associates)
    }
    if (parsedConfig.tasks?.length) {
      result.tasks = await seedTasksForStore(storeId, parsedConfig.tasks)
    }
    if (parsedConfig.inventory?.length) {
      result.inventory = await seedInventoryForStore(storeId, parsedConfig.inventory)
    }
    if (parsedConfig.table_items?.length) {
      result.tableItems = await seedTableItemsForStore(storeId, parsedConfig.table_items)
    }

    setSeedResult(result)
    setIsSeeding(false)
  }

  async function handleManualSeed() {
    setIsSeeding(true)
    const config: StoreConfig = {
      associates: manualAssociates,
      tasks: manualTasks,
      inventory: manualInventory,
      table_items: manualTableItems,
    }
    const result: SeedResult = {}

    if (config.associates?.length) result.associates = await seedAssociatesForStore(storeId, config.associates)
    if (config.tasks?.length) result.tasks = await seedTasksForStore(storeId, config.tasks)
    if (config.inventory?.length) result.inventory = await seedInventoryForStore(storeId, config.inventory)
    if (config.table_items?.length) result.tableItems = await seedTableItemsForStore(storeId, config.table_items)

    setSeedResult(result)
    setIsSeeding(false)
  }

  async function handleExport() {
    const config = await exportStoreConfig(storeId)
    const json = JSON.stringify(config, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `store-${storeName.replace(/\s+/g, "-").toLowerCase()}-config.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: "upload", label: "Upload", icon: <Upload className="w-4 h-4" /> },
    { id: "manual", label: "Manual", icon: <PenLine className="w-4 h-4" /> },
    { id: "export", label: "Export", icon: <Download className="w-4 h-4" /> },
  ]

  const PRIORITIES = ["Low", "Normal", "High", "Critical"]
  const ROLES = ["crew", "supervisor", "assistant_manager", "store_manager"]

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Store Setup</h2>
            <p className="text-xs font-mono text-akyra-secondary">{storeName}</p>
          </div>
          <button onClick={onDone} className="text-akyra-secondary hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-akyra-surface border border-akyra-border rounded-xl p-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === t.id
                  ? "bg-white text-black"
                  : "text-akyra-secondary hover:text-white"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ── UPLOAD TAB ── */}
        {tab === "upload" && (
          <div className="space-y-4">
            <p className="text-xs text-akyra-secondary">
              Upload CSVs or a store_config.json. Filenames are used to infer type.
            </p>

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault()
                setDragOver(false)
                Array.from(e.dataTransfer.files).forEach(handleFile)
              }}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
                dragOver ? "border-white bg-white/5" : "border-akyra-border hover:border-white/30"
              }`}
            >
              <Upload className="w-8 h-8 text-akyra-secondary" />
              <p className="text-sm text-white">Drop files here or tap to browse</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {["associates.csv", "tasks.csv", "Prep_Pull.csv", "Bread_Pull.csv", "Starter_Flips.csv", "store_config.json"].map(f => (
                  <span key={f} className="text-[10px] font-mono text-akyra-secondary border border-akyra-border rounded px-2 py-0.5">
                    {f}
                  </span>
                ))}
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".csv,.json"
              className="hidden"
              onChange={e => Array.from(e.target.files ?? []).forEach(handleFile)}
            />

            {/* Parsed preview */}
            {parsedConfig && (
              <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4 space-y-2">
                <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
                  Ready to seed
                </p>
                {!!parsedConfig.associates?.length && (
                  <p className="text-sm text-white">{parsedConfig.associates.length} associates</p>
                )}
                {!!parsedConfig.tasks?.length && (
                  <p className="text-sm text-white">{parsedConfig.tasks.length} tasks</p>
                )}
                {!!parsedConfig.inventory?.length && (
                  <p className="text-sm text-white">{parsedConfig.inventory.length} inventory items</p>
                )}
                {!!parsedConfig.table_items?.length && (
                  <p className="text-sm text-white">{parsedConfig.table_items.length} flip checklist items</p>
                )}
              </div>
            )}

            {seedResult && (
              <div className="bg-white/5 border border-white/20 rounded-xl p-4 space-y-1">
                <p className="text-xs font-mono uppercase tracking-widest text-white mb-2">Seeded</p>
                {Object.entries(seedResult)
                  .filter((entry): entry is [string, SeedCategoryResult] => entry[1] !== undefined)
                  .map(([key, val]) => (
                    <div key={key} className="space-y-1">
                      <p className="text-sm text-white/70">
                        {key}: {val.success} ok, {val.failed} failed
                      </p>
                      {val.errors?.map((message, i) => (
                        <p key={i} className="text-xs font-mono text-akyra-red">
                          {message}
                        </p>
                      ))}
                    </div>
                  ))}
              </div>
            )}

            <button
              onClick={handleSeed}
              disabled={!parsedConfig || isSeeding}
              className="w-full py-3 rounded-xl bg-white text-black font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSeeding ? <><LoadingSpinner size="sm" /> Seeding...</> : "Seed Store"}
            </button>
          </div>
        )}

        {/* ── MANUAL TAB ── */}
        {tab === "manual" && (
          <div className="space-y-4">
            {/* Section nav */}
            <div className="flex gap-1 overflow-x-auto">
              {(["associates", "tasks", "inventory", "table_items"] as ManualSection[]).map(s => (
                <button
                  key={s}
                  onClick={() => setManualSection(s)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-widest transition-colors ${
                    manualSection === s
                      ? "bg-white/10 text-white"
                      : "text-akyra-secondary hover:text-white"
                  }`}
                >
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>

            {/* Associates form */}
            {manualSection === "associates" && (
              <div className="space-y-3">
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
                    className="bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <div className="flex gap-1">
                    <input
                      placeholder="Start"
                      value={newAssoc.default_start_time ?? "22:00"}
                      onChange={e => setNewAssoc(p => ({ ...p, default_start_time: e.target.value }))}
                      className="flex-1 bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white font-mono"
                    />
                    <input
                      placeholder="End"
                      value={newAssoc.default_end_time ?? "06:30"}
                      onChange={e => setNewAssoc(p => ({ ...p, default_end_time: e.target.value }))}
                      className="flex-1 bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white font-mono"
                    />
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (newAssoc.name && newAssoc.eeid) {
                      setManualAssociates(p => [...p, newAssoc as StoreConfigAssociate])
                      setNewAssoc({ default_start_time: "22:00", default_end_time: "06:30", role: "crew" })
                    }
                  }}
                  className="flex items-center gap-2 text-sm text-white border border-akyra-border rounded-lg px-3 py-2 hover:border-white/40 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Associate
                </button>

                {manualAssociates.map((a, i) => (
                  <div key={i} className="flex items-center justify-between bg-akyra-surface border border-akyra-border rounded-lg px-3 py-2">
                    <div>
                      <span className="text-sm text-white">{a.name}</span>
                      <span className="text-xs font-mono text-akyra-secondary ml-2">{a.eeid} · {a.role}</span>
                    </div>
                    <button onClick={() => setManualAssociates(p => p.filter((_, j) => j !== i))}>
                      <Trash2 className="w-3.5 h-3.5 text-akyra-secondary hover:text-akyra-red" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Tasks form */}
            {manualSection === "tasks" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Task Name"
                    value={newTask.task_name ?? ""}
                    onChange={e => setNewTask(p => ({ ...p, task_name: e.target.value }))}
                    className="col-span-2 bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white"
                  />
                  <select
                    value={newTask.archetype ?? orgStations[0]}
                    onChange={e => setNewTask(p => ({ ...p, archetype: e.target.value }))}
                    className="bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm"
                  >
                    {orgStations.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select
                    value={newTask.priority ?? "Normal"}
                    onChange={e => setNewTask(p => ({ ...p, priority: e.target.value as StoreConfigTask["priority"] }))}
                    className="bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm"
                  >
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <input
                    type="number"
                    placeholder="Expected minutes"
                    value={newTask.expected_minutes ?? 15}
                    onChange={e => setNewTask(p => ({ ...p, expected_minutes: parseInt(e.target.value) || 15 }))}
                    className="bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white"
                  />
                  <label className="flex items-center gap-2 text-sm text-akyra-secondary col-span-1">
                    <input
                      type="checkbox"
                      checked={newTask.is_sticky ?? false}
                      onChange={e => setNewTask(p => ({ ...p, is_sticky: e.target.checked }))}
                      className="accent-white"
                    />
                    Sticky (repeats each shift)
                  </label>
                </div>
                <button
                  onClick={() => {
                    if (newTask.task_name) {
                      setManualTasks(p => [...p, newTask as StoreConfigTask])
                      setNewTask({ priority: "Normal", is_sticky: false, expected_minutes: 15, archetype: orgStations[0] ?? "Float" })
                    }
                  }}
                  className="flex items-center gap-2 text-sm text-white border border-akyra-border rounded-lg px-3 py-2 hover:border-white/40"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Task
                </button>

                {manualTasks.map((task, i) => (
                  <div key={i} className="flex items-center justify-between bg-akyra-surface border border-akyra-border rounded-lg px-3 py-2">
                    <div>
                      <span className="text-sm text-white">{task.task_name}</span>
                      <span className="text-xs font-mono text-akyra-secondary ml-2">{task.archetype} · {task.priority}</span>
                    </div>
                    <button onClick={() => setManualTasks(p => p.filter((_, j) => j !== i))}>
                      <Trash2 className="w-3.5 h-3.5 text-akyra-secondary hover:text-akyra-red" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Inventory form */}
            {manualSection === "inventory" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Item Name"
                    value={newInventory.item_name ?? ""}
                    onChange={e => setNewInventory(p => ({ ...p, item_name: e.target.value }))}
                    className="col-span-2 bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white"
                  />
                  <input
                    placeholder="Category (e.g. Prep)"
                    value={newInventory.category ?? ""}
                    onChange={e => setNewInventory(p => ({ ...p, category: e.target.value }))}
                    className="bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white"
                  />
                  <input
                    type="number"
                    placeholder="Build-to qty"
                    value={newInventory.amount_needed ?? ""}
                    onChange={e => setNewInventory(p => ({ ...p, amount_needed: parseInt(e.target.value) || 1 }))}
                    className="bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white"
                  />
                  <input
                    type="number"
                    placeholder="Code life (days, optional)"
                    value={newInventory.code_life_days ?? ""}
                    onChange={e => setNewInventory(p => ({ ...p, code_life_days: parseInt(e.target.value) || undefined }))}
                    className="col-span-2 bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white"
                  />
                </div>
                <button
                  onClick={() => {
                    if (newInventory.item_name && newInventory.category) {
                      setManualInventory(p => [...p, newInventory as StoreConfigInventoryItem])
                      setNewInventory({ category: "Prep", amount_needed: 1 })
                    }
                  }}
                  className="flex items-center gap-2 text-sm text-white border border-akyra-border rounded-lg px-3 py-2 hover:border-white/40"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>

                {manualInventory.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-akyra-surface border border-akyra-border rounded-lg px-3 py-2">
                    <div>
                      <span className="text-sm text-white">{item.item_name}</span>
                      <span className="text-xs font-mono text-akyra-secondary ml-2">
                        {item.category} · qty {item.amount_needed}
                        {item.code_life_days ? ` · ${item.code_life_days}d` : ""}
                      </span>
                    </div>
                    <button onClick={() => setManualInventory(p => p.filter((_, j) => j !== i))}>
                      <Trash2 className="w-3.5 h-3.5 text-akyra-secondary hover:text-akyra-red" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Table Items form */}
            {manualSection === "table_items" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Item Name"
                    value={newTableItem.item_name ?? ""}
                    onChange={e => setNewTableItem(p => ({ ...p, item_name: e.target.value }))}
                    className="bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white"
                  />
                  <input
                    placeholder="Station (e.g. Starter)"
                    value={newTableItem.station ?? ""}
                    onChange={e => setNewTableItem(p => ({ ...p, station: e.target.value }))}
                    className="bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white"
                  />
                </div>
                <button
                  onClick={() => {
                    if (newTableItem.item_name && newTableItem.station) {
                      setManualTableItems(p => [...p, newTableItem as StoreConfigTableItem])
                      setNewTableItem({ station: orgStations[0] ?? "Starter" })
                    }
                  }}
                  className="flex items-center gap-2 text-sm text-white border border-akyra-border rounded-lg px-3 py-2 hover:border-white/40"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>

                {manualTableItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-akyra-surface border border-akyra-border rounded-lg px-3 py-2">
                    <div>
                      <span className="text-sm text-white">{item.item_name}</span>
                      <span className="text-xs font-mono text-akyra-secondary ml-2">{item.station}</span>
                    </div>
                    <button onClick={() => setManualTableItems(p => p.filter((_, j) => j !== i))}>
                      <Trash2 className="w-3.5 h-3.5 text-akyra-secondary hover:text-akyra-red" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Seed button */}
            {(manualAssociates.length > 0 || manualTasks.length > 0 || manualInventory.length > 0 || manualTableItems.length > 0) && (
              <>
                {seedResult && (
                  <div className="bg-white/5 border border-white/20 rounded-xl p-4 space-y-1">
                    <p className="text-xs font-mono uppercase tracking-widest text-white mb-2">Seeded</p>
                    {Object.entries(seedResult)
                      .filter((entry): entry is [string, SeedCategoryResult] => entry[1] !== undefined)
                      .map(([key, val]) => (
                        <div key={key} className="space-y-1">
                          <p className="text-sm text-white/70">
                            {key}: {val.success} ok, {val.failed} failed
                          </p>
                          {val.errors?.map((message, i) => (
                            <p key={i} className="text-xs font-mono text-akyra-red">
                              {message}
                            </p>
                          ))}
                        </div>
                      ))}
                  </div>
                )}
                <button
                  onClick={handleManualSeed}
                  disabled={isSeeding}
                  className="w-full py-3 rounded-xl bg-white text-black font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSeeding ? <><LoadingSpinner size="sm" /> Seeding...</> : `Seed Store (${manualAssociates.length + manualTasks.length + manualInventory.length + manualTableItems.length} items)`}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── EXPORT TAB ── */}
        {tab === "export" && (
          <div className="space-y-4">
            <p className="text-sm text-akyra-secondary">
              Download the current store configuration as a JSON file. Use this to clone the setup to another store or back up your configuration.
            </p>

            <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-akyra-secondary" />
                <p className="text-sm font-mono text-white">
                  store-{storeName.replace(/\s+/g, "-").toLowerCase()}-config.json
                </p>
              </div>
              <p className="text-xs text-akyra-secondary">
                Contains: associates, tasks, inventory items, flip checklist items
              </p>
            </div>

            <button
              onClick={handleExport}
              className="w-full py-3 rounded-xl bg-white text-black font-bold flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Config
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
