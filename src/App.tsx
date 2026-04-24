import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useAuth } from "./context"
import {
  LoginPage,
  OnboardingPage,
  OverviewPage,
  AssociatesPage,
  SchedulePage,
  SettingsPage,
  ImportPage,
  EquipmentIssuesPage,
} from "./pages"
import { DashboardLayout, LoadingSpinner } from "./components"
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
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function RoleRouter() {
  const { state } = useAuth()
  const profile = state.profile

  if (!profile) return null

  const isSupervisor =
    profile.role === "supervisor" ||
    profile.role === "store_manager" ||
    profile.role === "district_manager" ||
    profile.role === "org_admin"

  if (!isSupervisor) {
    // Crew associate — needs their associate row to get the full Associate object
    // For now render AssociateDashboard with a minimal associate shape
    // WA4 will refine this with a proper associate lookup hook
    return (
      <AssociateDashboard
        associate={{
          id: profile.id,
          store_id: profile.current_store_id ?? "",
          name: profile.display_name,
          role: profile.role,
          current_archetype: "Float",
          pin_code: null,
          scheduled_days: "",
          default_start_time: "22:00",
          default_end_time: "06:30",
          created_at: profile.created_at,
          profile_id: profile.id,
        }}
      />
    )
  }

  // Supervisor — existing dashboard
  return (
    <DashboardLayout>
      <OverviewPage />
    </DashboardLayout>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <RoleRouter />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/associates"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <AssociatesPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/schedule"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <SchedulePage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/incidents"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <EquipmentIssuesPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/settings"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <SettingsPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/import"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <ImportPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
