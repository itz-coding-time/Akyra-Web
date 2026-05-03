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

let consumeSessionPromise: Promise<boolean> | null = null

export async function consumeOAuthRedirectSession(): Promise<boolean> {
  if (typeof window === "undefined") return false

  // If a consumption is already in progress, return the existing promise
  if (consumeSessionPromise) return consumeSessionPromise

  consumeSessionPromise = (async () => {
    const url = new URL(window.location.href)
    const code = url.searchParams.get("code")

    if (code) {
      try {
        console.log("[Supabase] Consuming OAuth code...")
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) throw error
        console.log("[Supabase] OAuth code exchange successful.")
        clearOAuthParams()
        return true
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
        console.log("[Supabase] Consuming session from hash...")
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (error) throw error
        console.log("[Supabase] Hash session establishment successful.")
        clearOAuthParams()
        return true
      } catch (err) {
        console.error("[Supabase] Failed to set session from hash:", err)
        clearOAuthParams()
        return false
      }
    }

    return false
  })()

  try {
    return await consumeSessionPromise
  } finally {
    // Reset the promise after completion (or failure)
    // so subsequent page loads can re-trigger if needed
    consumeSessionPromise = null
  }
}
