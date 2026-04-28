import { useState } from "react"
import { useAutoUpdate } from "./hooks"
import { UpdateOverlay } from "./components"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useAuth } from "./context"
import {
  LandingPage,
  AboutPage,
  PrivacyPage,
  LoginPage,
  DbAdminLoginPage,
  OnboardingPage,
  OverviewPage,
  AssociatesPage,
  SchedulePage,
  SettingsPage,
  ImportPage,
  EquipmentIssuesPage,
  StoreManagerPage,
  AssistantManagerPage,
  DbAdminPanel,
  AuthCallbackPage,
} from "./pages"
import { DashboardLayout, LoadingSpinner, PasskeyPrompt, EntryDisclaimer } from "./components"
import { AssociateDashboard } from "./pages/associate/AssociateDashboard"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { state } = useAuth()

  if (state.status === "idle" || state.status === "loading") {
    return (
      <div className="min-h-screen bg-akyra-black flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (state.status === "signed-out" || state.status === "error") {
    return <Navigate to="/app/login" replace />
  }

  return <>{children}</>
}

function RoleRouter() {
  const { state, dismissPasskeyPrompt } = useAuth()
  const profile = state.profile

  if (!profile) return null

  const passkeyPrompt = state.showPasskeyPrompt ? (
    <PasskeyPrompt
      displayName={profile.display_name}
      onDismiss={dismissPasskeyPrompt}
    />
  ) : null

  // DB Admin gets their own panel
  if (profile.role === "db_admin") {
    return <>{passkeyPrompt}<DbAdminPanel /></>
  }

  const isCrewOnly = profile.role === "crew"

  if (isCrewOnly) {
    return (
      <>
        {passkeyPrompt}
        <AssociateDashboard
          associate={{
            id: profile.id,
            store_id: profile.current_store_id ?? "",
            name: profile.display_name,
            role: profile.role,
            role_rank: 1,
            current_archetype: "Float",
            pin_code: null,
            scheduled_days: "",
            default_start_time: "22:00",
            default_end_time: "06:30",
            created_at: profile.created_at,
            profile_id: profile.id,
          }}
        />
      </>
    )
  }

  // Supervisor — existing dashboard
  return (
    <>
      {passkeyPrompt}
      <DashboardLayout>
        <OverviewPage />
      </DashboardLayout>
    </>
  )
}

function App() {
  const { isUpdating, newVersion } = useAutoUpdate()
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(() => {
    return localStorage.getItem("akyra_disclaimer_accepted") === "true"
  })

  if (isUpdating && newVersion) {
    return <UpdateOverlay newVersion={newVersion} />
  }

  if (!disclaimerAccepted) {
    return (
      <EntryDisclaimer onAccept={() => setDisclaimerAccepted(true)} />
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public landing surface */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        {/* App surface */}
        <Route path="/app/login" element={<LoginPage />} />
        <Route path="/app/login/dbad" element={<DbAdminLoginPage />} />
        <Route path="/app/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/app/onboarding" element={<OnboardingPage />} />
        <Route
          path="/app/dashboard"
          element={
            <ProtectedRoute>
              <RoleRouter />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/dashboard/associates"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <AssociatesPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/dashboard/schedule"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <SchedulePage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/dashboard/incidents"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <EquipmentIssuesPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/dashboard/settings"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <SettingsPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/dashboard/import"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <ImportPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/dashboard/store-manager"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <StoreManagerPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/dashboard/assistant-manager"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <AssistantManagerPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/admin"
          element={
            <ProtectedRoute>
              <DbAdminPanel />
            </ProtectedRoute>
          }
        />

        {/* Legacy redirects */}
        <Route path="/login" element={<Navigate to="/app/login" replace />} />
        <Route path="/dashboard/*" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/app" element={<Navigate to="/app/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
