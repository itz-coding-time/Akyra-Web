import { useAuth } from "../../context"

export function OverviewPage() {
  const { state } = useAuth()
  const profile = state.profile

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black">
          Welcome, {profile?.display_name ?? "Associate"}
        </h2>
        <p className="text-akyra-secondary text-sm mt-1">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {["Associates", "Schedule", "Incidents", "Tasks"].map((label) => (
          <div
            key={label}
            className="bg-akyra-surface border border-akyra-border rounded-xl p-4"
          >
            <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary mb-1">
              {label}
            </p>
            <p className="text-2xl font-black text-white">—</p>
          </div>
        ))}
      </div>

      <p className="text-center text-xs font-mono text-akyra-secondary">
        Feature screens coming in W8+
      </p>
    </div>
  )
}
