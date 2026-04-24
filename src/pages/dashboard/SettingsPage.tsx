import { useAuth } from "../../context"
import { useNavigate } from "react-router-dom"
import { usePwaInstall } from "../../hooks"
import { Button } from "../../components/ui/button"
import { Download } from "lucide-react"

export function SettingsPage() {
  const { state, signOut } = useAuth()
  const navigate = useNavigate()
  const profile = state.profile
  const { canInstall, isInstalled, promptInstall } = usePwaInstall()

  async function handleSignOut() {
    await signOut()
    navigate("/login")
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
