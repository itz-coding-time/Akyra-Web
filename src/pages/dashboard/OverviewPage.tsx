import { useAuth } from "../../context"
import { useAssociates, useStationBoard, usePacingBoard } from "../../hooks"
import { StationBoard } from "../../components/StationBoard"
import { PacingCard } from "../../components/PacingCard"
import { VerificationPanel } from "../../components/VerificationPanel"
import { TaskCard } from "../../components/TaskCard"
import { ShiftResetButton } from "../../components/ShiftResetButton"

export function OverviewPage() {
  const { state } = useAuth()
  const profile = state.profile
  const storeId = profile?.current_store_id

  const { associates, isLoading: assocLoading } = useAssociates(storeId)
  const { grouped, unclaimed, isLoading: boardLoading, isReassigning, reassign } = useStationBoard(storeId)
  const { pacingData, pendingTasks, orphanedTasks, isLoading: pacingLoading, isVerifying, verify, reject, clearOrphan } = usePacingBoard(storeId)

  return (
    <div className="space-y-8">

      {/* Greeting */}
      <div className="flex items-start justify-between">
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

        {storeId && (
          <ShiftResetButton
            storeId={storeId}
            onComplete={() => {
              // Refetch all data — reload the page is simplest
              window.location.reload()
            }}
          />
        )}
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

      {/* Escalated Tasks — orphaned from expired sessions */}
      {orphanedTasks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
              Escalated Tasks
            </p>
            <span className="text-[9px] font-mono bg-akyra-red text-white px-1.5 py-0.5 rounded-full animate-pulse">
              {orphanedTasks.length}
            </span>
          </div>
          <div className="space-y-2">
            {orphanedTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                isPersonal={false}
                onComplete={() => {}}
                onClearOrphan={clearOrphan}
              />
            ))}
          </div>
        </div>
      )}

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
