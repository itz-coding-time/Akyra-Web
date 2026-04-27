import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import { supabase } from "../lib/supabase"
import {
  fetchProfileByEeid,
  fetchLicenseForProfile,
  signInWithEeidAndPin,
  registerAuthForProfile,
  createProfileFromOnboarding,
  isLicenseUsable,
  signOut as supabaseSignOut,
  expireActiveShift,
  fetchOrgBranding,
  fetchOrgStations,
  hasPasskeyEnrolled,
  isPasskeySupported,
} from "../lib/repository"
import type { AuthState, Profile, SignInResult, OrgBranding, OrgStation } from "../types"

interface AuthContextValue {
  state: AuthState
  orgBranding: OrgBranding | null
  orgStations: OrgStation[]
  signIn: (eeid: string, pin: string) => Promise<SignInResult>
  completeFirstLogin: (eeid: string, pin: string) => Promise<SignInResult>
  completeOnboarding: (
    eeid: string,
    pin: string,
    displayName: string,
    orgId: string,
    storeId: string
  ) => Promise<SignInResult>
  signOut: () => Promise<void>
  dismissPasskeyPrompt: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: "idle",
    profile: null,
    licenseWarning: null,
    error: null,
  })
  const [orgBranding, setOrgBranding] = useState<OrgBranding | null>(null)
  const [orgStations, setOrgStations] = useState<OrgStation[]>([])

  const resolveSessionState = useCallback(async (profile: Profile) => {
    const license = await fetchLicenseForProfile(profile)

    if (license && !isLicenseUsable(license)) {
      await supabaseSignOut()
      setState({
        status: "error",
        profile: null,
        licenseWarning: null,
        error: "Your organization's access has been suspended. Contact your admin.",
      })
      return
    }

    const warning =
      license?.status === "past_due"
        ? "Your organization's subscription is past due. Access will end soon if not resolved."
        : null

    // Check passkey enrollment
    const dismissed = sessionStorage.getItem("passkey_prompt_dismissed") === "true"
    const passkeySupported = isPasskeySupported()
    const enrolled = passkeySupported ? await hasPasskeyEnrolled() : false

    setState({
      status: warning ? "signed-in-past-due" : "signed-in",
      profile,
      licenseWarning: warning,
      error: null,
      showPasskeyPrompt: passkeySupported && !enrolled && !dismissed,
    })

    if (profile.org_id) {
      const [branding, stations] = await Promise.all([
        fetchOrgBranding(profile.org_id),
        fetchOrgStations(profile.org_id),
      ])
      setOrgBranding(branding)
      setOrgStations(stations)
    }
  }, [])

  // Restore session on mount
  useEffect(() => {
    setState((s) => ({ ...s, status: "loading" }))

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        setState({ status: "signed-out", profile: null, licenseWarning: null, error: null })
        return
      }

      // Resolve profile from auth user
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("auth_uid", session.user.id)
        .maybeSingle()

      if (!profile) {
        setState({ status: "signed-out", profile: null, licenseWarning: null, error: null })
        return
      }

      await resolveSessionState(profile)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED" && !session) {
          setState({ status: "signed-out", profile: null, licenseWarning: null, error: null })
        } else if (!session?.user) {
          setState({ status: "signed-out", profile: null, licenseWarning: null, error: null })
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [resolveSessionState])

  const signIn = useCallback(
    async (eeid: string, pin: string): Promise<SignInResult> => {
      setState((s) => ({ ...s, status: "loading", error: null }))

      let profile = null
      try {
        profile = await fetchProfileByEeid(eeid)
      } catch (e) {
        console.error("fetchProfileByEeid threw:", e)
      }

      if (!profile) {
        if (!/^\d+$/.test(eeid)) {
          setState((s) => ({ ...s, status: "signed-out", error: "Invalid EEID format" }))
          return { kind: "error", message: "EEID must be numeric" }
        }
        setState((s) => ({ ...s, status: "signed-out" }))
        return { kind: "new-user", eeid }
      }

      if (!profile.auth_uid) {
        setState((s) => ({ ...s, status: "signed-out" }))
        return { kind: "first-login", eeid }
      }

      const signedIn = await signInWithEeidAndPin(eeid, pin)
      if (!signedIn) {
        setState((s) => ({ ...s, status: "signed-out", error: "Invalid PIN" }))
        return { kind: "error", message: "Invalid PIN" }
      }

      await resolveSessionState(signedIn)
      const license = await fetchLicenseForProfile(signedIn)
      const warning = license?.status === "past_due"
        ? "Your organization's subscription is past due."
        : null

      return { kind: "success", profile: signedIn, warning }
    },
    [resolveSessionState]
  )

  const completeFirstLogin = useCallback(
    async (eeid: string, pin: string): Promise<SignInResult> => {
      setState((s) => ({ ...s, status: "loading" }))

      const registered = await registerAuthForProfile(eeid, pin)
      if (!registered) {
        setState((s) => ({ ...s, status: "signed-out", error: "Registration failed" }))
        return { kind: "error", message: "Could not complete first-time setup" }
      }

      const signedIn = await signInWithEeidAndPin(eeid, pin)
      if (!signedIn) {
        setState((s) => ({ ...s, status: "signed-out" }))
        return { kind: "error", message: "Registered but sign-in failed. Try logging in." }
      }

      await resolveSessionState(signedIn)
      return { kind: "success", profile: signedIn, warning: null }
    },
    [resolveSessionState]
  )

  const completeOnboarding = useCallback(
    async (
      eeid: string,
      pin: string,
      displayName: string,
      orgId: string,
      storeId: string
    ): Promise<SignInResult> => {
      setState((s) => ({ ...s, status: "loading" }))

      // Step 1: Create auth user first — profile.id must reference auth.users.id
      const syntheticEmail = `${eeid}@akyra.internal`
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: syntheticEmail,
        password: pin,
      })
      if (signUpError || !signUpData.user) {
        setState((s) => ({ ...s, status: "signed-out", error: "Auth setup failed" }))
        return { kind: "error", message: "Could not create your account. Try again." }
      }

      // Step 2: Create profile row using the auth user's UUID
      const created = await createProfileFromOnboarding(
        eeid,
        displayName,
        orgId,
        storeId,
        signUpData.user.id
      )
      if (!created) {
        setState((s) => ({ ...s, status: "signed-out", error: "Could not create profile" }))
        return { kind: "error", message: "Auth created but profile setup failed. Contact your admin." }
      }

      // Step 3: signUp may have already established a session; resolve it
      await resolveSessionState(created)
      return { kind: "success", profile: created, warning: null }
    },
    [resolveSessionState]
  )

  const dismissPasskeyPrompt = useCallback(() => {
    setState(prev => ({ ...prev, showPasskeyPrompt: false }))
    sessionStorage.setItem("passkey_prompt_dismissed", "true")
  }, [])

  const signOut = useCallback(async () => {
    // Expire active shift if one exists
    if (state.profile) {
      const associate = await supabase
        .from("associates")
        .select("id")
        .eq("store_id", state.profile.current_store_id ?? "")
        .ilike("name", `%${state.profile.display_name.split(" ")[0]}%`)
        .maybeSingle()

      if (associate.data?.id) {
        await expireActiveShift(associate.data.id)
      }
    }

    sessionStorage.removeItem("akyra_station")
    sessionStorage.removeItem("akyra_float_mode")
    await supabaseSignOut()
    setOrgBranding(null)
    setOrgStations([])
    setState({ status: "signed-out", profile: null, licenseWarning: null, error: null })
  }, [state.profile])

  return (
    <AuthContext.Provider value={{
      state,
      orgBranding,
      orgStations,
      signIn,
      completeFirstLogin,
      completeOnboarding,
      signOut,
      dismissPasskeyPrompt,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
