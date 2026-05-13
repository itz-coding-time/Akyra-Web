import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { AkyraLogo } from "../components/AkyraLogo"
import { LoadingSpinner } from "../components/LoadingSpinner"
import { useAuth } from "../context"

const DB_ADMIN_EMAIL = import.meta.env.VITE_DB_ADMIN_EMAIL
const DB_ADMIN_OAUTH_STORAGE_KEY = "dbadmin_oauth_in_progress"
const DB_ADMIN_FLOW_STORAGE_KEY = "dbadmin_flow"

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? ""
}

export function DbAdminLoginPage() {
  const navigate = useNavigate()
  const { state } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Tracks whether we confirmed the incoming email is authorized.
  const emailAuthorized = useRef(false)

  function clearDbAdminOAuthState() {
    sessionStorage.removeItem(DB_ADMIN_OAUTH_STORAGE_KEY)
    sessionStorage.removeItem(DB_ADMIN_FLOW_STORAGE_KEY)
  }

  // Effect 1: handle OAuth redirect events without calling getSession while
  // the URL still contains a PKCE ?code= param.
  useEffect(() => {
    console.log("[DbAdminLogin] Effect 1 running")

    const params = new URLSearchParams(window.location.search)
    const code = params.get("code")
    const hasOAuthInProgress = sessionStorage.getItem(DB_ADMIN_OAUTH_STORAGE_KEY) === "true"

    console.log("[DbAdminLogin] mount - code:", code ? "present" : "none")
    console.log("[DbAdminLogin] DB_ADMIN_EMAIL configured:", !!DB_ADMIN_EMAIL)
    console.log("[DbAdminLogin] OAuth in progress:", hasOAuthInProgress)

    if (hasOAuthInProgress) {
      emailAuthorized.current = true
    }

    if (!code) return

    console.log("[DbAdminLogin] ?code= detected - registering onAuthStateChange listener")

    let handled = false

    function handleAuthorizedSession(email: string | null | undefined) {
      if (handled) return
      handled = true

      const signedInEmail = normalizeEmail(email)
      const configuredEmail = normalizeEmail(DB_ADMIN_EMAIL)

      console.log("[DbAdminLogin] session email:", signedInEmail)

      if (configuredEmail && signedInEmail === configuredEmail) {
        console.log("[DbAdminLogin] authorized email confirmed - letting AuthContext resolve profile")
        emailAuthorized.current = true
        return
      }

      console.warn("[DbAdminLogin] unauthorized email:", signedInEmail)
      clearDbAdminOAuthState()
      window.setTimeout(() => {
        void supabase.auth.signOut()
      }, 0)
      setError("Unauthorized Google account.")
      setIsChecking(false)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[DbAdminLogin] onAuthStateChange:", event, "-", session?.user?.email ?? "no email")

      if (event === "SIGNED_IN" && session?.user) {
        handleAuthorizedSession(session.user.email)
        subscription.unsubscribe()
      } else if (event === "SIGNED_OUT") {
        if (!handled) {
          console.warn("[DbAdminLogin] SIGNED_OUT before SIGNED_IN - showing login button")
          clearDbAdminOAuthState()
          setIsChecking(false)
        }
        subscription.unsubscribe()
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Effect 2: react to AuthContext state transitions. AuthContext owns session
  // resolution; this page only navigates or surfaces DB-admin-specific errors.
  useEffect(() => {
    console.log("[DbAdminLogin] Effect 2 running, status:", state.status)
    console.log("[DbAdminLogin] state changed -", state.status, "| role:", state.profile?.role ?? "none")

    if (state.status === "signed-in" || state.status === "signed-in-past-due") {
      if (state.profile?.role === "db_admin") {
        console.log("[DbAdminLogin] db_admin profile confirmed - navigating to dashboard")
        clearDbAdminOAuthState()
        navigate("/app/dashboard", { replace: true })
      } else if (state.profile) {
        console.warn("[DbAdminLogin] signed in but not db_admin:", state.profile.role)
        clearDbAdminOAuthState()
        setError("You don't have database admin access.")
        setIsChecking(false)
      }
    } else if (state.status === "signed-out") {
      if (emailAuthorized.current || sessionStorage.getItem(DB_ADMIN_OAUTH_STORAGE_KEY) === "true") {
        console.error("[DbAdminLogin] AuthContext signed out after DB admin OAuth - profile not found")
        setError("Admin profile not found. Contact your administrator.")
      }
      clearDbAdminOAuthState()
      setIsChecking(false)
    } else if (state.status === "error") {
      console.error("[DbAdminLogin] AuthContext error:", state.error)
      clearDbAdminOAuthState()
      setError(state.error ?? "Authentication error.")
      setIsChecking(false)
    }
  }, [state.status, state.profile, navigate, state.error])

  // Safety net: if auth never reaches a settled state, don't strand the page
  // on the spinner forever.
  useEffect(() => {
    if (!isChecking || (state.status !== "idle" && state.status !== "loading")) return

    const timeout = window.setTimeout(() => {
      clearDbAdminOAuthState()
      setError("Something went wrong. Please try again.")
      setIsChecking(false)
    }, 20000)

    return () => window.clearTimeout(timeout)
  }, [isChecking, state.status])

  async function handleGoogleSignIn() {
    console.log("[DbAdminLogin] handleGoogleSignIn called")
    sessionStorage.setItem(DB_ADMIN_OAUTH_STORAGE_KEY, "true")
    sessionStorage.setItem(DB_ADMIN_FLOW_STORAGE_KEY, "true")
    setIsLoading(true)
    setError(null)

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/app/login/dbad`,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    })

    if (oauthError) {
      clearDbAdminOAuthState()
      setError("Sign in failed. Please try again.")
      setIsLoading(false)
    }
  }

  if (isChecking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-[50%] h-[50%] bg-white/[0.015] blur-[150px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-xs space-y-8 text-center">
        <AkyraLogo className="w-10 h-10 mx-auto opacity-60" />

        {error && (
          <p className="text-[#E63946] text-sm font-mono">{error}</p>
        )}

        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl border border-white/15 bg-white/[0.03] hover:bg-white/[0.06] transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <LoadingSpinner size="sm" />
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              <span className="text-sm font-semibold text-white">
                Continue with Google
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
