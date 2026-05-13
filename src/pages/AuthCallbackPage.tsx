import { useEffect } from "react"
import type { Session } from "@supabase/supabase-js"
import { useNavigate } from "react-router-dom"
import { handleGoogleCallback } from "../lib"
import { useAuth } from "../context"
import { AkyraLogo } from "../components/AkyraLogo"
import { LoadingSpinner } from "../components/LoadingSpinner"
import { consumeOAuthRedirectSession, supabase } from "../lib/supabase"

const DB_ADMIN_OAUTH_STORAGE_KEY = "dbadmin_oauth_in_progress"
const DB_ADMIN_FLOW_STORAGE_KEY = "dbadmin_flow"

function waitForOAuthSession(): Promise<Session | null> {
  return new Promise((resolve) => {
    let settled = false
    let unsubscribe: (() => void) | null = null
    let timeout: number

    const finish = (session: Session | null) => {
      if (settled) return
      settled = true
      unsubscribe?.()
      window.clearTimeout(timeout)
      resolve(session)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        finish(session)
      } else if (event === "SIGNED_OUT") {
        finish(null)
      }
    })
    unsubscribe = () => subscription.unsubscribe()

    timeout = window.setTimeout(() => finish(null), 10000)
  })
}

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const { resolveSession } = useAuth()

  useEffect(() => {
    async function handleCallback() {
      const isDbAdmin =
        sessionStorage.getItem(DB_ADMIN_FLOW_STORAGE_KEY) === "true" ||
        sessionStorage.getItem(DB_ADMIN_OAUTH_STORAGE_KEY) === "true"

      if (isDbAdmin) {
        navigate("/app/login/dbad", { replace: true })
        return
      }

      const eeid = sessionStorage.getItem("pending_google_eeid")
      sessionStorage.removeItem("pending_google_eeid")

      const url = new URL(window.location.href)
      const hasOAuthCode = url.searchParams.has("code") || window.location.hash.includes("access_token=")
      let session: Session | null = null

      if (hasOAuthCode) {
        await consumeOAuthRedirectSession()
        session = await waitForOAuthSession()

        if (!session) {
          const retryUrl = new URL(window.location.href)
          const codeCleared =
            !retryUrl.searchParams.has("code") &&
            !window.location.hash.includes("access_token=")

          if (codeCleared) {
            const { data } = await supabase.auth.getSession()
            session = data.session
          }
        }
      } else {
        const { data } = await supabase.auth.getSession()
        session = data.session
      }

      if (!session) {
        navigate("/app/login", { replace: true })
        return
      }

      if (!eeid) {
        navigate("/app/login", { replace: true })
        return
      }

      const result = await handleGoogleCallback(eeid, session)

      if (result.kind === "success") {
        await resolveSession(session)
        navigate("/app/dashboard", { replace: true })
      } else {
        navigate("/app/login", { replace: true })
      }
    }

    void handleCallback()
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
