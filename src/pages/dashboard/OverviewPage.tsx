import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { useAuth } from "../../context"
import { useAssociates, useStationBoard, usePacingBoard, useCodeCheck, useSupervisorTasks } from "../../hooks"
import { StationBoard } from "../../components/StationBoard"
import { PacingCard } from "../../components/PacingCard"
import { VerificationPanel } from "../../components/VerificationPanel"
import { TaskCard } from "../../components/TaskCard"
import { ShiftResetButton } from "../../components/ShiftResetButton"
import { CodeCheckPanel } from "../../components/CodeCheckPanel"
import { AssignTaskSheet } from "../../components/AssignTaskSheet"
import { CreateTaskFAB } from "../../components/CreateTaskFAB"
import { AssistancePanel } from "../../components/gamification/AssistancePanel"
import { SupervisorPingPanel } from "../../components/SupervisorPingPanel"
import type { Database } from "../../types/database.types"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

export function OverviewPage() {
  const { state, orgStations } = useAuth()
  const profile = state.profile
  const storeId = profile?.current_store_id

  const { associates, isLoading: assocLoading } = useAssociates(storeId)
  const { grouped, unclaimed, isLoading: boardLoading, isReassigning, reassign } = useStationBoard(storeId)
  const { pacingData, pendingTasks, isLoading: pacingLoading, isVerifying, verify, reject } = usePacingBoard(storeId)
  const {
    expiringItems,
    isActioning: codeActioning,
    verifyUsedThrough,
    submitWaste,
  } = useCodeCheck(storeId)
  const {
    modTasks,
    activeShifts,
    isCreating,
    completeModTask,
    assignTask,
    createTask,
  } = useSupervisorTasks(storeId, profile?.display_name ?? "")

  const supervisorAssociateId = associates.find(a => a.name === profile?.display_name)?.id

  const [myTasksOpen, setMyTasksOpen] = useState(true)
  const [assigningTask, setAssigningTask] = useState<Task | null>(null)

  return (
    <div className="space-y-8 pb-32">

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

        <div className="flex items-center gap-2">
          {storeId && supervisorAssociateId && (
            <SupervisorPingPanel
              storeId={storeId}
              supervisorAssociateId={supervisorAssociateId}
              activeAssociates={(grouped as any[]).flatMap(g => g.associates ?? []).map((a: any) => ({
                id: a.id,
                name: a.name,
                station: a.current_archetype,
              }))}
              orgStations={orgStations.map(s => s.name)}
            />
          )}
          {storeId && (
            <ShiftResetButton
              storeId={storeId}
              onComplete={() => {
                window.location.reload()
              }}
            />
          )}
        </div>
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

      {/* My Tasks (MOD) — collapsible */}
      <div>
        <button
          onClick={() => setMyTasksOpen(!myTasksOpen)}
          className="flex items-center gap-2 w-full mb-3"
        >
          <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
            My Tasks (MOD)
          </p>
          {modTasks.length > 0 && (
            <span className="text-[9px] font-mono bg-akyra-red text-white px-1.5 py-0.5 rounded-full">
              {modTasks.length}
            </span>
          )}
          <span className="ml-auto text-akyra-secondary">
            {myTasksOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {myTasksOpen && (
          <div className="space-y-2">
            {modTasks.length === 0 ? (
              <p className="text-xs text-akyra-secondary py-4 text-center">No MOD tasks right now.</p>
            ) : (
              modTasks.map(task => (
                <div key={task.id} className="relative">
                  <TaskCard
                    task={task}
                    isPersonal={true}
                    onComplete={completeModTask}
                  />
                  <button
                    onClick={() => setAssigningTask(task)}
                    className="absolute top-3 right-3 text-[10px] font-mono uppercase tracking-widest text-akyra-secondary hover:text-white transition-colors"
                  >
                    Assign →
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Trust But Verify — pending tasks */}
      <VerificationPanel
        pendingTasks={pendingTasks}
        isVerifying={isVerifying}
        onVerify={verify}
        onReject={reject}
      />

      {/* Code Check — expiring pull events */}
      {expiringItems.length > 0 && (
        <CodeCheckPanel
          expiringItems={expiringItems}
          isActioning={codeActioning}
          onVerifyUsedThrough={verifyUsedThrough}
          onSubmitWaste={submitWaste}
        />
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

      {/* Assistance Requests */}
      {storeId && supervisorAssociateId && (
        <AssistancePanel
          storeId={storeId}
          supervisorAssociateId={supervisorAssociateId}
        />
      )}

      {/* Live station board */}
      <StationBoard
        grouped={grouped}
        unclaimed={unclaimed}
        isLoading={boardLoading}
        isReassigning={isReassigning}
        onReassign={reassign}
      />

      {/* Assign Task Sheet */}
      {assigningTask && (
        <AssignTaskSheet
          task={assigningTask}
          activeShifts={activeShifts}
          onAssign={assignTask}
          onClose={() => setAssigningTask(null)}
        />
      )}

      {/* Create Task FAB */}
      <CreateTaskFAB
        isCreating={isCreating}
        onCreateTask={createTask}
      />
    </div>
  )
}
