import { useAuth } from "../../context"
import { useAssociates, useStationBoard, usePacingBoard } from "../../hooks"
import { StationBoard } from "../../components/StationBoard"
import { PacingCard } from "../../components/PacingCard"
import { VerificationPanel } from "../../components/VerificationPanel"

export function OverviewPage() {
  const { state } = useAuth()
  const profile = state.profile
  const storeId = profile?.current_store_id

  const { associates, isLoading: assocLoading } = useAssociates(storeId)
  const { grouped, unclaimed, isLoading: boardLoading, isReassigning, reassign } = useStationBoard(storeId)
  const { pacingData, pendingTasks, isLoading: pacingLoading, isVerifying, verify, reject } = usePacingBoard(storeId)

  return (
    <div className="space-y-8">

      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-black">
          Welcome, {profile?.display_name ?? "Supervisor"}
        </h2>
        <p className="text-akyra-secondary text-sm mt-1">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4">
          <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary mb-1">Associates</p>
          <p className="text-2xl font-black">{assocLoading ? "—" : associates.length}</p>
        </div>
        <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4">
          <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary mb-1">Pending</p>
          <p className={`text-2xl font-black ${pendingTasks.length > 0 ? "text-akyra-red" : "text-white"}`}>
            {pacingLoading ? "—" : pendingTasks.length}
          </p>
        </div>
      </div>

      {/* Trust But Verify — pending tasks */}
      <VerificationPanel
        pendingTasks={pendingTasks}
        isVerifying={isVerifying}
        onVerify={verify}
        onReject={reject}
      />

      {/* Pacing cards */}
      {pacingData.length > 0 && (
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary mb-3">
            Associate Pacing
          </p>
          <div className="space-y-3">
            {pacingData.map((data) => (
              <PacingCard key={data.associateId} data={data} />
            ))}
          </div>
        </div>
      )}

      {/* Live station board */}
      <StationBoard
        grouped={grouped}
        unclaimed={unclaimed}
        isLoading={boardLoading}
        isReassigning={isReassigning}
        onReassign={reassign}
      />
    </div>
  )
}
