import { type ReactNode } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { AkyraLogo } from "./AkyraLogo"
import { PastDueBanner } from "./PastDueBanner"
import { useAuth } from "../context"
import { Users, ClipboardList, Wrench, Settings, LayoutGrid, Upload } from "lucide-react"

interface DashboardLayoutProps {
  children: ReactNode
}

const navItems = [
  { to: "/dashboard", icon: LayoutGrid, label: "Overview", end: true },
  { to: "/dashboard/associates", icon: Users, label: "Associates" },
  { to: "/dashboard/schedule", icon: ClipboardList, label: "Schedule" },
  { to: "/dashboard/incidents", icon: Wrench, label: "Equipment" },
  { to: "/dashboard/settings", icon: Settings, label: "Settings" },
  { to: "/dashboard/import", icon: Upload, label: "Import" },
]

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { state, signOut } = useAuth()
  const navigate = useNavigate()

  const profile = state.profile
  const storeId = profile?.current_store_id

  async function handleSignOut() {
    await signOut()
    navigate("/login")
  }

  return (
    <div className="min-h-screen bg-akyra-black flex flex-col">

      {/* Past-due banner */}
      {state.licenseWarning && (
        <PastDueBanner message={state.licenseWarning} />
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-akyra-border shrink-0">
        <div className="flex items-center gap-3">
          <AkyraLogo className="w-7 h-7" />
          <div>
            <span className="font-bold tracking-tight text-white">AKYRA</span>
            {storeId && (
              <p className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary">
                Store Active
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {profile && (
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold">{profile.display_name}</p>
              <p className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary">
                {profile.role}
              </p>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="text-xs font-mono uppercase tracking-widest text-akyra-secondary hover:text-akyra-red transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20 px-6 py-6 max-w-2xl mx-auto w-full">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 bg-akyra-black border-t border-akyra-border z-50">
        <div className="flex items-center justify-around max-w-2xl mx-auto px-2">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-1 py-3 px-4 transition-colors ${
                  isActive
                    ? "text-white"
                    : "text-akyra-secondary hover:text-white"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-5 h-5 ${isActive ? "stroke-white" : ""}`} />
                  <span className="text-[9px] font-mono uppercase tracking-widest">
                    {label}
                  </span>
                  {isActive && (
                    <div className="absolute bottom-0 w-6 h-0.5 bg-akyra-red rounded-full" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
