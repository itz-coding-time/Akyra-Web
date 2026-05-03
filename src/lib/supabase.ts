import { createClient } from "@supabase/supabase-js"
import type { Database } from "../types/database.types"
import { env } from "./env"

export const supabase = createClient<Database>(
  env.supabaseUrl,
  env.supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  }
)

function clearOAuthParams() {
  if (typeof window === "undefined") return

  const url = new URL(window.location.href)
  url.searchParams.delete("code")
  url.searchParams.delete("error")
  url.searchParams.delete("error_code")
  url.searchParams.delete("error_description")
  url.hash = ""
  window.history.replaceState({}, document.title, url.toString())
}

export async function consumeOAuthRedirectSession(): Promise<boolean> {
  if (typeof window === "undefined") return false

  const url = new URL(window.location.href)
  const code = url.searchParams.get("code")

  if (code) {
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      clearOAuthParams()
      return !error
    } catch (err) {
      console.error("[Supabase] Failed to exchange code for session:", err)
      clearOAuthParams()
      return false
    }
  }

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""))
  const accessToken = hashParams.get("access_token")
  const refreshToken = hashParams.get("refresh_token")

  if (accessToken && refreshToken) {
    try {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      clearOAuthParams()
      return !error
    } catch (err) {
      console.error("[Supabase] Failed to set session from hash:", err)
      clearOAuthParams()
      return false
    }
  }

  return false
}
