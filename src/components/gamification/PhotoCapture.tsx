import { useRef, useState } from "react"
import { Camera, X } from "lucide-react"
import { LoadingSpinner } from "../LoadingSpinner"
import { supabase } from "../../lib/supabase"

interface PhotoCaptureProps {
  storeId: string
  label: string
  onCapture: (url: string) => void
  onDismiss: () => void
}

export function PhotoCapture({ storeId, label, onCapture, onDismiss }: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function handleSubmit() {
    if (!file) return
    setIsUploading(true)

    const fileName = `verifications/${storeId}/${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage
      .from("equipment-photos")
      .upload(fileName, file)

    if (error || !data) {
      setIsUploading(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from("equipment-photos")
      .getPublicUrl(data.path)

    setIsUploading(false)
    onCapture(urlData.publicUrl)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onDismiss} />
      <div className="relative w-full max-w-lg bg-akyra-surface border-t border-akyra-border rounded-t-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-bold text-white">{label}</p>
          <button onClick={onDismiss} className="text-akyra-secondary hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {preview ? (
          <img src={preview} alt="Preview" className="w-full rounded-xl border border-akyra-border max-h-48 object-cover" />
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full h-32 rounded-xl border-2 border-dashed border-akyra-border flex flex-col items-center justify-center gap-2 hover:border-white/40 transition-colors"
          >
            <Camera className="w-8 h-8 text-akyra-secondary" />
            <span className="text-sm text-akyra-secondary">Take or upload photo</span>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {preview && (
          <div className="flex gap-3">
            <button
              onClick={() => { setPreview(null); setFile(null) }}
              className="flex-1 py-2.5 rounded-xl border border-akyra-border text-akyra-secondary font-semibold"
            >
              Retake
            </button>
            <button
              onClick={handleSubmit}
              disabled={isUploading}
              className="flex-1 py-2.5 rounded-xl bg-white text-black font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isUploading ? <><LoadingSpinner size="sm" /> Uploading...</> : "Submit"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
