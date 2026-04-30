import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { AkyraLogo } from "../components/AkyraLogo"
import { LoadingSpinner } from "../components/LoadingSpinner"
import { useAuth } from "../context"

const DB_ADMIN_EMAIL = import.meta.env.VITE_DB_ADMIN_EMAIL

export function DbAdminLoginPage() {
  const navigate = useNavigate()
  const { resolveSession } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkSession() {
      // Handle PKCE flow — Supabase returns ?code= in URL
      const params = new URLSearchParams(window.location.search)
      const code = params.get("code")
      console.log("[dbad] DB_ADMIN_EMAIL:", DB_ADMIN_EMAIL)
      console.log("[dbad] code param:", code)
      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
      }

      // Small delay to allow Supabase to parse hash fragment
      // if implicit flow was used instead of PKCE
      await new Promise(resolve => setTimeout(resolve, 200))

      const { data: { session } } = await supabase.auth.getSession()
      console.log("[dbad] session email:", session?.user?.email)

      if (!session) {
        // No session — show the login button
        setIsChecking(false)
        return
      }

      // Case-insensitive email comparison
      if (
        DB_ADMIN_EMAIL &&
        session.user.email?.toLowerCase() === DB_ADMIN_EMAIL.toLowerCase()
      ) {
        // Sync session with AuthContext BEFORE navigating
        // This ensures ProtectedRoute sees an authenticated state
        await resolveSession()
        navigate("/app/dashboard", { replace: true })
      } else {
        // Wrong Google account — sign out silently, return to home
        await supabase.auth.signOut()
        navigate("/", { replace: true })
      }
    }

    checkSession()
  }, [navigate, resolveSession])

  async function handleGoogleSignIn() {
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
      setError("Sign in failed. Please try again.")
      setIsLoading(false)
    }
    // No error — browser navigates to Google, then back to /app/login/dbad
    // The mount effect above detects the session on return
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
