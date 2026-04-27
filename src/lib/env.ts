export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
}

if (!env.supabaseUrl || !env.supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Check your .env.local file."
  )
}
