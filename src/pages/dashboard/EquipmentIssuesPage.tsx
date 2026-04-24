import { useState, useRef } from "react"
import { useAuth } from "../../context"
import { useEquipmentIssues } from "../../hooks"
import { LoadingSpinner } from "../../components/LoadingSpinner"
import { Camera, Wrench, CheckCircle, Clock, AlertTriangle } from "lucide-react"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"

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

const STATUS_CONFIG = {
  New:      { icon: AlertTriangle, color: "text-akyra-red",  border: "border-akyra-red/40",  label: "New" },
  Pending:  { icon: Clock,         color: "text-yellow-400", border: "border-yellow-400/40", label: "Pending" },
  Resolved: { icon: CheckCircle,   color: "text-white/40",   border: "border-akyra-border",  label: "Resolved" },
}

export function EquipmentIssuesPage() {
  const { state } = useAuth()
  const storeId = state.profile?.current_store_id
  const { newIssues, pendingIssues, resolvedIssues, isLoading, isSubmitting, submitIssue, updateStatus } = useEquipmentIssues(storeId)

  const [showForm, setShowForm] = useState(false)
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit() {
    if (!category || !description) return
    const associateId = "" // TODO: resolve from profile in WS3 integration
    const success = await submitIssue(associateId, category, description, photoFile ?? undefined)
    if (success) {
      setShowForm(false)
      setCategory("")
      setDescription("")
      setPhotoFile(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner />
      </div>
    )
  }

  const sections = [
    { label: "New",      issues: newIssues,      status: "New" as const },
    { label: "Pending",  issues: pendingIssues,   status: "Pending" as const },
    { label: "Resolved", issues: resolvedIssues,  status: "Resolved" as const },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black">Equipment</h2>
        <Button
          onClick={() => setShowForm(!showForm)}
          variant={showForm ? "outline" : "default"}
          className="text-xs"
        >
          {showForm ? "Cancel" : "+ Report Issue"}
        </Button>
      </div>

      {/* Report form */}
      {showForm && (
        <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4 space-y-4">
          <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
            New Equipment Issue
          </p>

          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                  category === cat
                    ? "border-white bg-white/10 text-white"
                    : "border-akyra-border text-akyra-secondary hover:border-white/40"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <Input
            placeholder="Describe the issue..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="bg-akyra-black border-akyra-border"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 text-xs font-mono text-akyra-secondary hover:text-white transition-colors border border-akyra-border rounded-lg px-3 py-2"
            >
              <Camera className="w-3.5 h-3.5" />
              {photoFile ? photoFile.name : "Add Photo"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => setPhotoFile(e.target.files?.[0] ?? null)}
            />

            <Button
              onClick={handleSubmit}
              disabled={!category || !description || isSubmitting}
              className="ml-auto"
            >
              {isSubmitting ? <LoadingSpinner size="sm" /> : "Submit"}
            </Button>
          </div>
        </div>
      )}

      {/* Kanban columns */}
      {sections.map(({ label, issues, status }) => {
        const config = STATUS_CONFIG[status]
        const Icon = config.icon

        if (issues.length === 0 && status === "Resolved") return null

        return (
          <div key={label}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`w-3.5 h-3.5 ${config.color}`} />
              <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
                {label} · {issues.length}
              </p>
            </div>

            {issues.length === 0 ? (
              <p className="text-xs text-akyra-secondary font-mono px-1">None</p>
            ) : (
              <div className="space-y-2">
                {issues.map(issue => (
                  <div
                    key={issue.id}
                    className={`bg-akyra-surface border ${config.border} rounded-xl p-4`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border ${config.border} ${config.color}`}>
                            {issue.category}
                          </span>
                        </div>
                        <p className="text-sm text-white mt-1.5">{issue.description}</p>
                        {issue.photo_url && (
                          <a
                            href={issue.photo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono text-akyra-secondary hover:text-white transition-colors mt-1 flex items-center gap-1"
                          >
                            <Camera className="w-3 h-3" />
                            View photo
                          </a>
                        )}
                        <p className="text-[10px] text-akyra-secondary font-mono mt-2">
                          {new Date(issue.created_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>

                      {/* Status actions */}
                      <div className="flex flex-col gap-1 shrink-0">
                        {status === "New" && (
                          <button
                            onClick={() => updateStatus(issue.id, "Pending")}
                            className="text-[9px] font-mono uppercase tracking-widest text-yellow-400 hover:text-white transition-colors border border-yellow-400/30 rounded px-2 py-1"
                          >
                            In Progress
                          </button>
                        )}
                        {status === "Pending" && (
                          <button
                            onClick={() => updateStatus(issue.id, "Resolved")}
                            className="text-[9px] font-mono uppercase tracking-widest text-white hover:text-akyra-red transition-colors border border-white/20 rounded px-2 py-1"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {newIssues.length === 0 && pendingIssues.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Wrench className="w-10 h-10 text-akyra-border" />
          <p className="text-sm text-akyra-secondary">No equipment issues reported.</p>
        </div>
      )}
    </div>
  )
}
