import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { handleGoogleCallback } from "../lib"
import { useAuth } from "../context"
import { AkyraLogo } from "../components/AkyraLogo"
import { LoadingSpinner } from "../components/LoadingSpinner"
import { supabase } from "../lib/supabase"

const DB_ADMIN_EMAIL = "therealbrancase@gmail.com"

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const { resolveSession } = useAuth()

  useEffect(() => {
    async function handleCallback() {
      const isDbAdmin = sessionStorage.getItem("dbadmin_flow") === "true"
      const eeid = sessionStorage.getItem("pending_google_eeid")

      sessionStorage.removeItem("dbadmin_flow")
      sessionStorage.removeItem("pending_google_eeid")

      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        navigate("/")
        return
      }

      if (isDbAdmin) {
        // DB Admin whitelist check — wrong account silently redirects to /
        if (session.user.email !== DB_ADMIN_EMAIL) {
          await supabase.auth.signOut()
          navigate("/")
          return
        }
        // DB Admin authenticated — resolve session and enter dashboard
        await resolveSession()
        navigate("/app/dashboard")
        return
      }

      // Regular Google auth flow
      if (!eeid) {
        navigate("/app/login")
        return
      }

      const result = await handleGoogleCallback(eeid)
      if (result.kind === "success") {
        await resolveSession()
        navigate("/app/dashboard")
      } else {
        navigate("/app/login")
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
