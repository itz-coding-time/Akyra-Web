import { useState, useRef, useCallback } from "react"
import { useAuth } from "../../context"
import { LoadingSpinner } from "../../components/LoadingSpinner"
import { Button } from "../../components/ui/button"
import {
  inferImportFromFilename,
  parseImportCsv,
  buildImportDiff,
  applyImport,
  type ImportPreview,
} from "../../lib/csvImport"
import { Upload, FileText, Plus, RefreshCw, Trash2, Minus } from "lucide-react"

type ImportState =
  | { stage: "idle" }
  | { stage: "inferring"; filename: string }
  | { stage: "error"; message: string }
  | { stage: "preview"; preview: ImportPreview; file: File }
  | { stage: "applying" }
  | { stage: "done"; message: string }

export function ImportPage() {
  const { state } = useAuth()
  const storeId = state.profile?.current_store_id
  const fileRef = useRef<HTMLInputElement>(null)
  const [importState, setImportState] = useState<ImportState>({ stage: "idle" })

  const handleFile = useCallback(async (file: File) => {
    setImportState({ stage: "inferring", filename: file.name })

    const inferred = inferImportFromFilename(file.name)
    if (!inferred) {
      setImportState({
        stage: "error",
        message: `Couldn't infer category from "${file.name}". Expected filenames like Prep_Pull.csv, Bread_Pull.csv, Starter_Flips.csv, Finisher_A_Flips.csv, or Finisher_B_Flips.csv.`
      })
      return
    }

    const text = await file.text()
    const parsedItems = parseImportCsv(text, inferred.target)

    if (parsedItems.length === 0) {
      setImportState({ stage: "error", message: "No items found in CSV. Check the file format." })
      return
    }

    const diff = await buildImportDiff(storeId ?? "", inferred, parsedItems)

    setImportState({
      stage: "preview",
      preview: { inferred, diff, parsedItems },
      file,
    })
  }, [storeId])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function handleApply() {
    if (importState.stage !== "preview") return
    const { preview } = importState

    setImportState({ stage: "applying" })

    const result = await applyImport(storeId ?? "", preview.inferred, preview.parsedItems)

    if (result.success) {
      setImportState({ stage: "done", message: result.message })
    } else {
      setImportState({ stage: "error", message: result.message })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black">Import</h2>
        <p className="text-akyra-secondary text-sm mt-1">
          Upload a CSV to sync prep sheets or flip checklists.
        </p>
      </div>

      {/* Drop zone */}
      {(importState.stage === "idle" || importState.stage === "error") && (
        <>
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-akyra-border rounded-xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-white/30 transition-colors"
          >
            <Upload className="w-10 h-10 text-akyra-secondary" />
            <div className="text-center">
              <p className="text-white font-semibold">Drop CSV here</p>
              <p className="text-akyra-secondary text-sm mt-1">or tap to browse</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {["Prep_Pull.csv", "Bread_Pull.csv", "Starter_Flips.csv", "Finisher_A.csv", "Finisher_B.csv"].map(name => (
                <span key={name} className="text-[10px] font-mono text-akyra-secondary border border-akyra-border rounded px-2 py-0.5">
                  {name}
                </span>
              ))}
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
              e.target.value = ""
            }}
          />

          {importState.stage === "error" && (
            <div className="bg-akyra-red/10 border border-akyra-red/40 rounded-xl p-4">
              <p className="text-akyra-red text-sm font-mono">{importState.message}</p>
            </div>
          )}
        </>
      )}

      {/* Inferring */}
      {importState.stage === "inferring" && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <LoadingSpinner size="md" />
          <p className="text-akyra-secondary text-sm font-mono">
            Reading {importState.filename}...
          </p>
        </div>
      )}

      {/* Preview */}
      {importState.stage === "preview" && (
        <div className="space-y-4">
          <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-akyra-secondary" />
              <p className="font-semibold text-white">{importState.preview.inferred.displayName}</p>
            </div>
            <p className="text-xs font-mono text-akyra-secondary">
              {importState.file.name} · {importState.preview.parsedItems.length} items
            </p>
          </div>

          {/* Diff summary */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Adding",    count: importState.preview.diff.added.length,     icon: Plus,      color: "text-white" },
              { label: "Removing",  count: importState.preview.diff.removed.length,   icon: Trash2,    color: "text-akyra-red" },
              { label: "Updating",  count: importState.preview.diff.updated.length,   icon: RefreshCw, color: "text-yellow-400" },
              { label: "No change", count: importState.preview.diff.unchanged.length, icon: Minus,     color: "text-akyra-secondary" },
            ].map(({ label, count, icon: Icon, color }) => (
              <div key={label} className="bg-akyra-surface border border-akyra-border rounded-xl p-3">
                <div className={`flex items-center gap-1.5 ${color} mb-1`}>
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-mono uppercase tracking-widest">{label}</span>
                </div>
                <p className={`text-2xl font-black ${count > 0 ? color : "text-akyra-secondary"}`}>
                  {count}
                </p>
              </div>
            ))}
          </div>

          {/* Removed items list — most important to show */}
          {importState.preview.diff.removed.length > 0 && (
            <div className="bg-akyra-red/10 border border-akyra-red/40 rounded-xl p-4">
              <p className="text-xs font-mono uppercase tracking-widest text-akyra-red mb-3">
                Will be removed from DB
              </p>
              <div className="space-y-1">
                {importState.preview.diff.removed.map(name => (
                  <div key={name} className="flex items-center gap-2">
                    <Trash2 className="w-3 h-3 text-akyra-red shrink-0" />
                    <span className="text-sm text-white">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Added items list */}
          {importState.preview.diff.added.length > 0 && (
            <div className="bg-white/5 border border-white/20 rounded-xl p-4">
              <p className="text-xs font-mono uppercase tracking-widest text-white mb-3">
                Will be added
              </p>
              <div className="space-y-1">
                {importState.preview.diff.added.map(name => (
                  <div key={name} className="flex items-center gap-2">
                    <Plus className="w-3 h-3 text-white shrink-0" />
                    <span className="text-sm text-white">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setImportState({ stage: "idle" })}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleApply}
            >
              Apply Import
            </Button>
          </div>
        </div>
      )}

      {/* Applying */}
      {importState.stage === "applying" && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <LoadingSpinner size="md" />
          <p className="text-akyra-secondary text-sm font-mono">Applying changes...</p>
        </div>
      )}

      {/* Done */}
      {importState.stage === "done" && (
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/20 rounded-xl p-6 text-center">
            <p className="text-2xl font-black text-white mb-2">✓ Done</p>
            <p className="text-akyra-secondary text-sm font-mono">{importState.message}</p>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setImportState({ stage: "idle" })}
          >
            Import Another
          </Button>
        </div>
      )}
    </div>
  )
}
