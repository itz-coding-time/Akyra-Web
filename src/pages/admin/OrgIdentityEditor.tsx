import { useState, useRef, useEffect } from "react"
import { X, Upload } from "lucide-react"
import { LoadingSpinner } from "../../components/LoadingSpinner"
import { fetchOrgBranding, updateOrgBranding, uploadOrgLogo } from "../../lib"

interface OrgIdentityEditorProps {
  orgId: string
  orgName: string
  onDone: () => void
}

const DEFAULT_TERMINOLOGY = {
  associate: "Associate",
  supervisor: "Supervisor",
  station: "Station",
  shift: "Shift",
  mod: "MOD",
}

const TERMINOLOGY_LABELS: Record<string, string> = {
  associate: "Crew member label",
  supervisor: "Supervisor label",
  station: "Station/archetype label",
  shift: "Shift label",
  mod: "Manager on duty label",
}

export function OrgIdentityEditor({ orgId, orgName, onDone }: OrgIdentityEditorProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)

  // Editable state
  const [brandName, setBrandName] = useState("")
  const [brandColor, setBrandColor] = useState("#E63946")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [terminology, setTerminology] = useState(DEFAULT_TERMINOLOGY)

  useEffect(() => {
    fetchOrgBranding(orgId).then(data => {
      if (data) {
        setBrandName(data.brandName ?? orgName)
        setBrandColor(data.brandColor)
        setLogoUrl(data.logoUrl)
        setTerminology({ ...DEFAULT_TERMINOLOGY, ...data.terminology })
      }
      setIsLoading(false)
    })
  }, [orgId, orgName])

  async function handleLogoUpload(file: File) {
    setIsUploadingLogo(true)
    const url = await uploadOrgLogo(orgId, file)
    if (url) setLogoUrl(url)
    setIsUploadingLogo(false)
  }

  async function handleSave() {
    setIsSaving(true)
    const success = await updateOrgBranding(orgId, {
      brandName,
      brandColor,
      logoUrl: logoUrl ?? undefined,
      terminology,
    })
    setIsSaving(false)
    if (success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
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

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Org Identity</h2>
            <p className="text-xs font-mono text-akyra-secondary">{orgName}</p>
          </div>
          <button onClick={onDone} className="text-akyra-secondary hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Branding */}
        <div className="space-y-4">
          <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
            Branding
          </p>

          <div className="space-y-2">
            <label className="text-xs text-akyra-secondary">Display Name</label>
            <input
              value={brandName}
              onChange={e => setBrandName(e.target.value)}
              className="w-full bg-akyra-black border border-akyra-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-akyra-secondary">Brand Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={brandColor}
                onChange={e => setBrandColor(e.target.value)}
                className="w-12 h-12 rounded-lg border border-akyra-border bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={brandColor}
                onChange={e => setBrandColor(e.target.value)}
                className="flex-1 bg-akyra-black border border-akyra-border rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-akyra-secondary">Logo</label>
            <div className="flex items-center gap-3">
              {logoUrl && (
                <img src={logoUrl} alt="Logo" className="w-12 h-12 rounded-lg object-cover border border-akyra-border" />
              )}
              <button
                onClick={() => logoRef.current?.click()}
                disabled={isUploadingLogo}
                className="flex items-center gap-2 text-sm text-akyra-secondary hover:text-white border border-akyra-border rounded-lg px-3 py-2 transition-colors"
              >
                {isUploadingLogo ? <LoadingSpinner size="sm" /> : <Upload className="w-3.5 h-3.5" />}
                {logoUrl ? "Replace Logo" : "Upload Logo"}
              </button>
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleLogoUpload(f)
                }}
              />
            </div>
          </div>
        </div>

        {/* Terminology */}
        <div className="space-y-4">
          <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
            Terminology
          </p>
          <p className="text-xs text-akyra-secondary">
            Rename labels to match your org's language. These appear throughout the app.
          </p>

          {Object.entries(terminology).map(([key, value]) => (
            <div key={key} className="space-y-1">
              <label className="text-xs text-akyra-secondary">
                {TERMINOLOGY_LABELS[key] ?? key}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-white/20 w-24 shrink-0">
                  Default: {DEFAULT_TERMINOLOGY[key as keyof typeof DEFAULT_TERMINOLOGY]}
                </span>
                <input
                  value={value}
                  onChange={e => setTerminology(p => ({ ...p, [key]: e.target.value }) as typeof DEFAULT_TERMINOLOGY)}
                  placeholder={DEFAULT_TERMINOLOGY[key as keyof typeof DEFAULT_TERMINOLOGY]}
                  className="flex-1 bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white"
                />
              </div>
            </div>
          ))}
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
            "Save Changes"
          )}
        </button>
      </div>
    </div>
  )
}
