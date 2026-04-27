import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { LoadingSpinner } from "../../components/LoadingSpinner"
import { fetchOrgBranding, updateOrgBranding } from "../../lib"

interface RoleDisplayNameEditorProps {
  orgId: string
  orgName: string
  onDone: () => void
}

const ROLE_META: Array<{
  key: string
  rank: number
  defaultLabel: string
  description: string
}> = [
  { key: "crew",              rank: 1, defaultLabel: "Crew",              description: "Front line associates — the people doing the work" },
  { key: "supervisor",        rank: 2, defaultLabel: "Supervisor",        description: "Shift leads and MODs — people managing the floor" },
  { key: "assistant_manager", rank: 3, defaultLabel: "Assistant Manager", description: "Senior ops — supports the store manager" },
  { key: "store_manager",     rank: 4, defaultLabel: "Store Manager",     description: "Full store ownership — settles disputes, final say" },
  { key: "district_admin",    rank: 5, defaultLabel: "District Admin",    description: "Multi-store visibility across a district" },
  { key: "org_admin",         rank: 6, defaultLabel: "Org Admin",         description: "Full org access — manages all stores" },
  { key: "db_admin",          rank: 7, defaultLabel: "Platform Admin",    description: "Akyra platform access — cross-org management" },
]

export function RoleDisplayNameEditor({ orgId, orgName, onDone }: RoleDisplayNameEditorProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [roleNames, setRoleNames] = useState<Record<string, string>>({})
  const [existingTerminology, setExistingTerminology] = useState<Record<string, unknown>>({})

  useEffect(() => {
    fetchOrgBranding(orgId).then(branding => {
      if (branding) {
        setRoleNames({ ...branding.terminology.roles })
        // Preserve existing top-level terminology keys
        setExistingTerminology(branding.terminology as unknown as Record<string, unknown>)
      }
      setIsLoading(false)
    })
  }, [orgId])

  async function handleSave() {
    setIsSaving(true)

    const updatedTerminology = {
      ...existingTerminology,
      roles: roleNames,
    }

    const success = await updateOrgBranding(orgId, {
      terminology: updatedTerminology as unknown as Record<string, string>,
    })

    setIsSaving(false)
    if (success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  function handleReset(key: string) {
    const meta = ROLE_META.find(r => r.key === key)
    if (meta) {
      setRoleNames(prev => ({ ...prev, [key]: meta.defaultLabel }))
    }
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-y-auto">
      <div className="max-w-lg mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Role Names</h2>
            <p className="text-xs font-mono text-akyra-secondary">{orgName}</p>
          </div>
          <button onClick={onDone} className="text-akyra-secondary hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-xs text-akyra-secondary leading-relaxed">
          Rename each role tier to match your org's language. The permission levels never change — only what you call them. Associates see their role name throughout the app.
        </p>

        {/* Role editor */}
        <div className="space-y-3">
          {ROLE_META.map(role => {
            const currentValue = roleNames[role.key] ?? role.defaultLabel
            const isChanged = currentValue !== role.defaultLabel

            return (
              <div
                key={role.key}
                className={`bg-akyra-surface border rounded-xl p-4 space-y-2 transition-colors ${
                  isChanged ? "border-white/30" : "border-akyra-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-white/20 border border-white/10 rounded px-1.5 py-0.5">
                      Rank {role.rank}
                    </span>
                    <span className="text-[10px] font-mono text-akyra-secondary">
                      {role.key}
                    </span>
                    {isChanged && (
                      <span className="text-[9px] font-mono text-white/40 border border-white/10 rounded px-1.5 py-0.5">
                        modified
                      </span>
                    )}
                  </div>
                  {isChanged && (
                    <button
                      onClick={() => handleReset(role.key)}
                      className="text-[10px] font-mono text-akyra-secondary hover:text-white transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </div>

                <input
                  value={currentValue}
                  onChange={e => setRoleNames(prev => ({ ...prev, [role.key]: e.target.value }))}
                  placeholder={role.defaultLabel}
                  className="w-full bg-akyra-black border border-akyra-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white transition-colors"
                />

                <p className="text-[10px] text-akyra-secondary leading-relaxed">
                  {role.description}
                </p>
              </div>
            )
          })}
        </div>

        {/* Preview */}
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-white/30 mb-3">
            Preview
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ROLE_META.slice(0, 4).map(role => (
              <div key={role.key} className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-akyra-secondary" />
                <span className="text-xs text-white/60">
                  {roleNames[role.key] ?? role.defaultLabel}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-3 rounded-xl bg-white text-black font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <><LoadingSpinner size="sm" /> Saving...</>
          ) : saved ? (
            "✓ Saved"
          ) : (
            "Save Role Names"
          )}
        </button>
      </div>
    </div>
  )
}
