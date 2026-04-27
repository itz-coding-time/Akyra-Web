import { useEffect, useState } from "react"
import { useAuth } from "../../context"
import { useNavigate } from "react-router-dom"
import { usePwaInstall } from "../../hooks"
import { Button } from "../../components/ui/button"
import { Download, Fingerprint } from "lucide-react"
import {
  hasPasskeyEnrolled,
  removePasskeys,
  isPasskeySupported,
  registerPasskey,
} from "../../lib"

export function SettingsPage() {
  const { state, signOut } = useAuth()
  const navigate = useNavigate()
  const profile = state.profile
  const { canInstall, isInstalled, promptInstall } = usePwaInstall()

  const [passkeyEnrolled, setPasskeyEnrolled] = useState(false)

  useEffect(() => {
    if (isPasskeySupported()) {
      hasPasskeyEnrolled().then(setPasskeyEnrolled)
    }
  }, [])

  async function handleSignOut() {
    await signOut()
    navigate("/app/login")
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black">Settings</h2>

      {profile && (
        <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4 space-y-2">
          <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">Profile</p>
          <p className="font-semibold">{profile.display_name}</p>
          <p className="text-sm text-akyra-secondary font-mono">{profile.eeid}</p>
          <p className="text-xs text-akyra-secondary uppercase tracking-widest">{profile.role}</p>
        </div>
      )}

      {isPasskeySupported() && (
        <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-akyra-secondary" />
            <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
              Passkey
            </p>
          </div>
          {passkeyEnrolled ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-white">Face ID / Fingerprint enabled</p>
              <button
                onClick={async () => {
                  await removePasskeys()
                  setPasskeyEnrolled(false)
                }}
                className="text-xs font-mono text-akyra-red hover:text-white transition-colors"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              onClick={async () => {
                if (!profile) return
                const res = await registerPasskey(profile.display_name)
                if (res.success) setPasskeyEnrolled(true)
              }}
              className="text-sm text-white hover:text-akyra-secondary transition-colors"
            >
              Enable Face ID / Fingerprint →
            </button>
          )}
        </div>
      )}

      {canInstall && (
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={promptInstall}
        >
          <Download className="w-4 h-4" />
          Install Akyra App
        </Button>
      )}

      {isInstalled && (
        <p className="text-center text-xs font-mono text-akyra-secondary">
          ✓ Akyra is installed
        </p>
      )}

      <Button variant="destructive" className="w-full" onClick={handleSignOut}>
        Sign Out
      </Button>
    </div>
  )
}
