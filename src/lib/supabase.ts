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
    },
  }
)
