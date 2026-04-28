import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { handleGoogleCallback } from "../lib"
import { useAuth } from "../context"
import { AkyraLogo } from "../components/AkyraLogo"
import { LoadingSpinner } from "../components/LoadingSpinner"

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const { resolveSession } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function handleCallback() {
      // Retrieve the EEID that was stored before Google redirect
      const eeid = sessionStorage.getItem("pending_google_eeid")

      if (!eeid) {
        setError("Session expired. Please try signing in again.")
        setTimeout(() => navigate("/app/login"), 2000)
        return
      }

      const result = await handleGoogleCallback(eeid)

      // Clear the pending EEID
      sessionStorage.removeItem("pending_google_eeid")

      if (result.kind === "success") {
        await resolveSession()
        navigate("/app/dashboard")
      } else if (result.kind === "not_linked") {
        navigate(`/app/login?eeid=${eeid}&google=unlinked`)
      } else {
        setError(result.message)
        setTimeout(() => navigate("/app/login"), 2500)
      }
    }

    handleCallback()
  }, [navigate, resolveSession])

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6">
      <AkyraLogo className="w-12 h-12 animate-pulse" />
      {error ? (
        <div className="text-center space-y-2">
          <p className="text-akyra-red text-sm font-mono">{error}</p>
          <p className="text-white/30 text-xs font-mono">Redirecting...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner size="md" />
          <p className="text-white/40 text-xs font-mono uppercase tracking-widest">
            Signing in...
          </p>
        </div>
      )}
    </div>
  )
}
