import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AkyraLogo } from "../components/AkyraLogo"
import { LoadingSpinner } from "../components/LoadingSpinner"
import { supabase } from "../lib/supabase"

const DB_ADMIN_EMAIL = "therealbrancase@gmail.com"

export function DbAdminLoginPage() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if already signed in as db_admin
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email === DB_ADMIN_EMAIL) {
        navigate("/app/dashboard")
      }
    })
  }, [navigate])

  async function handleGoogleSignIn() {
    setIsLoading(true)
    setError(null)

    // Store markers so callback knows this is the db_admin flow
    sessionStorage.setItem("pending_google_eeid", "000001")
    sessionStorage.setItem("dbadmin_flow", "true")

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/app/auth/callback`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    })
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-[50%] h-[50%] bg-white/[0.015] blur-[150px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-xs space-y-8 text-center">
        <AkyraLogo className="w-10 h-10 mx-auto" />

        {error ? (
          <div className="space-y-4">
            <p className="text-akyra-red text-sm font-mono">{error}</p>
            <button
              onClick={() => navigate("/")}
              className="text-xs font-mono text-white/30 hover:text-white transition-colors"
            >
              ← Back
            </button>
          </div>
        ) : (
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
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
                <span className="text-sm font-semibold text-white">Continue with Google</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
