import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "../lib/supabase"
import {
  fetchProfileByEeidAndOrg,
  signInWithEeidAndOrg,
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
  signIn: (eeid: string, password: string, welcomePhrase: string) => Promise<SignInResult>
  completeFirstLogin: (eeid: string, pin: string) => Promise<SignInResult>
  completeOnboarding: (
    eeid: string,
    pin: string,
    displayName: string,
    orgId: string,
    storeId: string
  ) => Promise<SignInResult>
  resolveSession: (session?: Session | null) => Promise<Profile | null>
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
    let mounted = true
    setState((s) => ({ ...s, status: "loading" }))

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        console.log("[AuthContext] onAuthStateChange event:", event, !!session?.user)

        if ((event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
          // Pass the session directly so resolveSession doesn't need to call
          // getSession() internally — avoids the race where it returns null
          // before the session has been persisted to storage.
          const profile = await resolveSession(session)
          
          if (!mounted) return

          if (profile) {
            console.log("[AuthContext] session resolved successfully")
          } else {
            // Profile missing — might be a "Claim Account" flow in progress. 
            // We stay in "loading" or "idle" rather than force "signed-out" if we have a session.
            console.log("[AuthContext] session present but no profile resolved yet")
          }
        } else if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !session)) {
          if (mounted) setState({ status: "signed-out", profile: null, licenseWarning: null, error: null })
        } else if (!session?.user) {
          if (mounted) setState({ status: "signed-out", profile: null, licenseWarning: null, error: null })
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [resolveSessionState])

  const signIn = useCallback(
    async (eeid: string, password: string, welcomePhrase: string): Promise<SignInResult> => {
      setState((s) => ({ ...s, status: "loading", error: null }))

      const profile = await fetchProfileByEeidAndOrg(eeid, welcomePhrase)

      if (!profile) {
        setState((s) => ({ ...s, status: "signed-out" }))
        return { kind: "new-user", eeid }
      }

      if (!profile.auth_uid) {
        setState((s) => ({ ...s, status: "signed-out" }))
        return { kind: "first-login", eeid }
      }

      // No password provided — caller needs to determine auth method
      if (!password) {
        setState((s) => ({ ...s, status: "signed-out" }))
        return { kind: "error", message: "auth-method-select" }
      }

      const signedIn = await signInWithEeidAndOrg(eeid, password, welcomePhrase)
      if (!signedIn) {
        setState((s) => ({ ...s, status: "signed-out", error: "Incorrect password" }))
        return { kind: "error", message: "Incorrect password" }
      }

      await resolveSessionState(signedIn)
      return { kind: "success", profile: signedIn, warning: null }
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

      // Step 1: Attempt sign in first (recovery path)
      const syntheticEmail = `${eeid}@akyra.internal`
      let authUserId: string | null = null

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password: pin,
      })

      if (!signInError && signInData.user) {
        authUserId = signInData.user.id
      } else {
        // Step 2: Create auth user if sign-in failed
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: syntheticEmail,
          password: pin,
        })

        if (signUpError) {
          if (signUpError.message.includes("already registered")) {
            // Race condition or previously created but wrong password?
            const { data: retrySignInData, error: retrySignInError } = await supabase.auth.signInWithPassword({
              email: syntheticEmail,
              password: pin,
            })
            if (retrySignInError || !retrySignInData.user) {
              setState((s) => ({ ...s, status: "signed-out", error: "Auth account already exists but password mismatch." }))
              return { kind: "error", message: "Account already exists but could not sign in. Try logging in." }
            }
            authUserId = retrySignInData.user.id
          } else {
            setState((s) => ({ ...s, status: "signed-out", error: "Auth setup failed" }))
            return { kind: "error", message: "Could not create your account. Try again." }
          }
        } else {
          authUserId = signUpData.user?.id ?? null
        }
      }

      if (!authUserId) {
        setState((s) => ({ ...s, status: "signed-out", error: "No Auth UID returned" }))
        return { kind: "error", message: "Account setup failed. Please try again." }
      }

      // Step 3: Create profile row using the auth user's UUID
      const created = await createProfileFromOnboarding(
        eeid,
        displayName,
        orgId,
        storeId,
        authUserId
      )
      if (!created) {
        setState((s) => ({ ...s, status: "signed-out", error: "Could not create profile" }))
        return { kind: "error", message: "Auth created but profile setup failed. Contact your admin." }
      }

      // Step 4: Resolve session
      await resolveSessionState(created)
      return { kind: "success", profile: created, warning: null }
    },
    [resolveSessionState]
  )

  const resolveSession = useCallback(async (passedSession?: Session | null) => {
    // When called from onAuthStateChange, the session is passed directly to avoid
    // a race where getSession() returns null before the session is persisted.
    // When called on page refresh (no session available), we fetch it ourselves.
    const session = passedSession ?? (await supabase.auth.getSession()).data.session
    if (!session?.user) return null

    // Try to find profile by auth_uid first
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("auth_uid", session.user.id)
      .maybeSingle()

    if (profile) {
      await resolveSessionState(profile)
      return profile
    }

    // Try to find profile by google_email (for db_admin Google OAuth flow)
    if (session.user.email) {
      const { data: profileByEmail } = await supabase
        .from("profiles")
        .select("*")
        .eq("google_email", session.user.email)
        .maybeSingle()

      if (profileByEmail) {
        // Link auth_uid if not already linked
        if (!profileByEmail.auth_uid) {
          await supabase
            .from("profiles")
            .update({ auth_uid: session.user.id })
            .eq("id", profileByEmail.id)
        }
        const resolvedProfile = {
          ...profileByEmail,
          auth_uid: profileByEmail.auth_uid ?? session.user.id,
        }
        await resolveSessionState(resolvedProfile)
        return resolvedProfile
      }
    }

    // No profile found — sign out
    await supabase.auth.signOut()
    setState({ status: "signed-out", profile: null, licenseWarning: null, error: null })
    return null
  }, [resolveSessionState])

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
      resolveSession,
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
