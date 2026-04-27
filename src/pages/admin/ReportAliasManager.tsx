import { useState, useEffect } from "react"
import { X, Wand2, Download, Search } from "lucide-react"
import { LoadingSpinner } from "../../components/LoadingSpinner"
import {
  fetchReportAliases,
  updateReportAlias,
  autoGenerateAliases,
  generateResearchReport,
  type ReportAliasItem,
} from "../../lib"

interface ReportAliasManagerProps {
  storeId: string
  storeName: string
  onDone: () => void
}

type FilterType = "all" | "inventory" | "task" | "unaliased"

export function ReportAliasManager({
  storeId,
  storeName,
  onDone,
}: ReportAliasManagerProps) {
  const [items, setItems] = useState<ReportAliasItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [filter, setFilter] = useState<FilterType>("all")
  const [search, setSearch] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [saving, setSaving] = useState<string | null>(null)

  // Report date range
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  )

  useEffect(() => {
    fetchReportAliases(storeId).then(data => {
      setItems(data)
      setIsLoading(false)
    })
  }, [storeId])

  async function handleAutoGenerate() {
    setIsGenerating(true)
    const count = await autoGenerateAliases(storeId)
    const updated = await fetchReportAliases(storeId)
    setItems(updated)
    setIsGenerating(false)
    if (count > 0) {
      alert(`Generated ${count} aliases automatically.`)
    } else {
      alert("All items already have aliases.")
    }
  }

  async function handleSaveAlias(item: ReportAliasItem) {
    setSaving(item.id)
    await updateReportAlias(item.id, item.type, editValue || null)
    setItems(prev => prev.map(i =>
      i.id === item.id ? { ...i, reportAlias: editValue || null } : i
    ))
    setEditingId(null)
    setSaving(null)
  }

  async function handleExportReport() {
    setIsExporting(true)
    const report = await generateResearchReport(storeId, startDate, endDate)

    // Build CSV sections
    const lines: string[] = []

    lines.push(`Akyra Research Report — ${storeName}`)
    lines.push(`Period: ${report.period.start} to ${report.period.end}`)
    lines.push("")

    lines.push("SHIFT METRICS")
    lines.push(`Total Shifts,${report.shiftMetrics.totalShifts}`)
    lines.push(`Avg Tasks Completed,${report.shiftMetrics.avgTasksCompleted}`)
    lines.push(`Avg Completion %,${report.shiftMetrics.avgCompletionPct}%`)
    lines.push(`Kill Leader Events,${report.shiftMetrics.killLeaderCount}`)
    lines.push(`Burn Cards Earned,${report.shiftMetrics.burnCardsEarned}`)
    lines.push("")

    lines.push("TASK METRICS")
    lines.push("Alias,Archetype,Completions,Avg Actual (min),Expected (min),Avg Delta %,Fast,Slow")
    for (const t of report.taskMetrics) {
      lines.push(`${t.alias},${t.archetype},${t.completions},${t.avgActualMinutes},${t.expectedMinutes},${t.deltaAvgPct}%,${t.fastCompletions},${t.slowCompletions}`)
    }
    lines.push("")

    lines.push("INVENTORY METRICS")
    lines.push("Alias,Category,Total Pulled,Waste Events,Waste Qty,Avg Code Life (days)")
    for (const i of report.inventoryMetrics) {
      lines.push(`${i.alias},${i.category},${i.totalPulled},${i.wasteEvents},${i.wasteQuantity},${i.avgCodeLife}`)
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `akyra-report-${storeName.replace(/\s+/g, "-").toLowerCase()}-${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setIsExporting(false)
  }

  const filtered = items.filter(item => {
    if (filter === "inventory" && item.type !== "inventory") return false
    if (filter === "task" && item.type !== "task") return false
    if (filter === "unaliased" && item.reportAlias) return false
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const unaliasedCount = items.filter(i => !i.reportAlias).length

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Report Aliases</h2>
            <p className="text-xs font-mono text-akyra-secondary">{storeName}</p>
          </div>
          <button onClick={onDone} className="text-akyra-secondary hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-xs text-akyra-secondary leading-relaxed">
          Aliases anonymize item names in exported reports. Associates always see the real name in the app. Reports show the alias. Set them manually or auto-generate sequentially.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-akyra-surface border border-akyra-border rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-white">{items.length}</p>
            <p className="text-[10px] font-mono text-akyra-secondary">Total Items</p>
          </div>
          <div className="bg-akyra-surface border border-akyra-border rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-white">{items.length - unaliasedCount}</p>
            <p className="text-[10px] font-mono text-akyra-secondary">Aliased</p>
          </div>
          <div className={`bg-akyra-surface border rounded-xl p-3 text-center ${
            unaliasedCount > 0 ? "border-yellow-500/30" : "border-akyra-border"
          }`}>
            <p className={`text-2xl font-black ${unaliasedCount > 0 ? "text-yellow-400" : "text-white"}`}>
              {unaliasedCount}
            </p>
            <p className="text-[10px] font-mono text-akyra-secondary">Unaliased</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleAutoGenerate}
            disabled={isGenerating || unaliasedCount === 0}
            className="flex items-center gap-2 text-xs font-mono text-white border border-akyra-border rounded-lg px-3 py-2 hover:border-white/40 transition-colors disabled:opacity-40"
          >
            {isGenerating ? <LoadingSpinner size="sm" /> : <Wand2 className="w-3.5 h-3.5" />}
            Auto-Generate {unaliasedCount > 0 ? `(${unaliasedCount})` : ""}
          </button>
        </div>

        {/* Filter + Search */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "inventory", "task", "unaliased"] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] font-mono uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors ${
                filter === f
                  ? "bg-white/10 text-white"
                  : "text-akyra-secondary hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
          <div className="flex items-center gap-2 flex-1 min-w-[160px] bg-akyra-black border border-akyra-border rounded-lg px-3 py-1.5">
            <Search className="w-3 h-3 text-akyra-secondary shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search items..."
              className="flex-1 bg-transparent text-white text-xs focus:outline-none placeholder-akyra-secondary"
            />
          </div>
        </div>

        {/* Item list */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-sm text-akyra-secondary text-center py-8">
              No items match your filter.
            </p>
          )}

          {filtered.map(item => (
            <div
              key={item.id}
              className={`bg-akyra-surface border rounded-xl p-3 transition-colors ${
                item.reportAlias ? "border-akyra-border" : "border-yellow-500/20"
              }`}
            >
              {editingId === item.id ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-mono text-akyra-secondary mb-1">
                      {item.type === "inventory" ? item.category : item.archetype} ·{" "}
                      {item.type}
                    </p>
                    <p className="text-sm text-white/60 truncate">{item.name}</p>
                  </div>
                  <input
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    placeholder="Report alias..."
                    autoFocus
                    className="flex-1 bg-akyra-black border border-white rounded-lg px-3 py-2 text-white text-sm focus:outline-none font-mono"
                  />
                  <button
                    onClick={() => handleSaveAlias(item)}
                    disabled={saving === item.id}
                    className="text-xs font-mono text-white border border-white/20 rounded-lg px-3 py-2 hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    {saving === item.id ? "..." : "Save"}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-akyra-secondary hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  className="flex items-center justify-between gap-3 cursor-pointer"
                  onClick={() => {
                    setEditingId(item.id)
                    setEditValue(item.reportAlias ?? "")
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-white/20 border border-white/10 rounded px-1.5 py-0.5 shrink-0">
                        {item.type === "inventory" ? item.category : item.archetype}
                      </span>
                      <p className="text-sm text-white truncate">{item.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.reportAlias ? (
                      <span className="text-xs font-mono text-white/50">
                        → {item.reportAlias}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-yellow-400/60">
                        No alias
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-akyra-secondary hover:text-white">
                      Edit
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Report Export */}
        <div className="border-t border-akyra-border pt-6 space-y-4">
          <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
            Export Research Report
          </p>
          <p className="text-xs text-akyra-secondary">
            Generates a CSV using aliases throughout. No org-specific names appear in the output.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-akyra-secondary">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-akyra-secondary">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white font-mono"
              />
            </div>
          </div>

          {unaliasedCount > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
              <p className="text-xs text-yellow-400">
                {unaliasedCount} item{unaliasedCount > 1 ? "s" : ""} have no alias.
                They will appear as "Unaliased Item" or "Unaliased Task" in the report.
                Auto-generate aliases first for clean output.
              </p>
            </div>
          )}

          <button
            onClick={handleExportReport}
            disabled={isExporting}
            className="w-full py-3 rounded-xl bg-white text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isExporting ? (
              <><LoadingSpinner size="sm" /> Generating...</>
            ) : (
              <><Download className="w-4 h-4" /> Export Report CSV</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
