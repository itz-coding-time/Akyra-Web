import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useAuth } from "./context"
import {
  LoginPage,
  OnboardingPage,
  OverviewPage,
  AssociatesPage,
  SchedulePage,
  IncidentsPage,
  SettingsPage,
} from "./pages"
import { DashboardLayout, LoadingSpinner } from "./components"

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
              <DashboardLayout>
                <OverviewPage />
              </DashboardLayout>
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
                <IncidentsPage />
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
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
