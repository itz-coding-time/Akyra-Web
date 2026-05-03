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
      detectSessionInUrl: true,
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
  const hasCode = url.searchParams.has("code") || window.location.hash.includes("access_token=")

  if (hasCode) {
    console.log("[Supabase] detectSessionInUrl is true. Waiting for Supabase to handle the session...")
    // We don't call exchangeCodeForSession manually anymore to avoid lock contention.
    // Supabase will handle it and emit an onAuthStateChange event.
    
    // Just clear the URL params after a short delay so Supabase has time to read them
    setTimeout(clearOAuthParams, 1000)
    return true
  }

  return false
}
