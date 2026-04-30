import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { handleGoogleCallback } from "../lib"
import { useAuth } from "../context"
import { AkyraLogo } from "../components/AkyraLogo"
import { LoadingSpinner } from "../components/LoadingSpinner"
import { supabase } from "../lib/supabase"

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const { resolveSession } = useAuth()

  useEffect(() => {
    async function handleCallback() {
      // Check if this is a dbad flow — if so, do nothing
      // The DbAdminLoginPage handles its own auth state
      const isDbAdmin = sessionStorage.getItem("dbadmin_flow") === "true"
      if (isDbAdmin) {
        sessionStorage.removeItem("dbadmin_flow")
        // DbAdminLoginPage's onAuthStateChange will handle this
        return
      }

      const eeid = sessionStorage.getItem("pending_google_eeid")
      sessionStorage.removeItem("pending_google_eeid")

      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        navigate("/app/login", { replace: true })
        return
      }

      if (!eeid) {
        navigate("/app/login", { replace: true })
        return
      }

      const result = await handleGoogleCallback(eeid)

      if (result.kind === "success") {
        await resolveSession()
        navigate("/app/dashboard", { replace: true })
      } else {
        navigate("/app/login", { replace: true })
      }
    }

    handleCallback()
  }, [navigate, resolveSession])

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6">
      <AkyraLogo className="w-12 h-12 animate-pulse" />
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size="md" />
        <p className="text-white/40 text-xs font-mono uppercase tracking-widest">
          Signing in...
        </p>
      </div>
    </div>
  )
}
