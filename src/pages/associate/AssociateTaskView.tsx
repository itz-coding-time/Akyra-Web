import { useAssociateTasks } from "../../hooks"
import { TaskCard } from "../../components/TaskCard"
import { FlipChecklist } from "../../components/FlipChecklist"
import { PullList } from "../../components/PullList"
import { LoadingSpinner } from "../../components/LoadingSpinner"
import type { FloatMode } from "../../hooks"
import type { Associate } from "../../types"

interface AssociateTaskViewProps {
  associate: Associate
  station: string
  floatMode: FloatMode
  onChangeFloatMode: () => void
}

export function AssociateTaskView({
  associate,
  station,
  floatMode,
  onChangeFloatMode,
}: AssociateTaskViewProps) {
  const primaryArchetype = station === "Float"
    ? (floatMode === "pos" ? "POS" : "Kitchen")
    : station

  const {
    myTasks,
    archetypeTasks,
    tableItems,
    inventoryItems,
    isLoading,
    completeTask,
    toggleTableItem,
    updateAmountHave,
  } = useAssociateTasks(associate.store_id, primaryArchetype, associate.name)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-akyra-black flex items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-akyra-black">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-akyra-border">
        <div>
          <p className="font-bold text-white">{associate.name}</p>
          <p className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary">
            {station === "Float" ? `Float → ${floatMode}` : station}
          </p>
        </div>
        {station === "Float" && (
          <button
            onClick={onChangeFloatMode}
            className="text-xs font-mono uppercase tracking-widest text-akyra-secondary hover:text-white transition-colors"
          >
            Switch mode
          </button>
        )}
      </header>

      {/* Content */}
      <div className="px-6 py-6 space-y-8 pb-20 max-w-lg mx-auto">

        {/* My Tasks — pinned top */}
        {myTasks.length > 0 && (
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary mb-3">
              My Tasks · {myTasks.length}
            </p>
            <div className="space-y-2">
              {myTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isPersonal={true}
                  onComplete={completeTask}
                />
              ))}
            </div>
          </div>
        )}

        {/* Archetype Tasks */}
        {archetypeTasks.length > 0 && (
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary mb-3">
              {primaryArchetype} Tasks · {archetypeTasks.length}
            </p>
            <div className="space-y-2">
              {archetypeTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isPersonal={false}
                  onComplete={completeTask}
                />
              ))}
            </div>
          </div>
        )}

        {myTasks.length === 0 && archetypeTasks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-akyra-secondary text-sm">No tasks right now.</p>
            <p className="text-xs font-mono text-akyra-secondary mt-1">Check back in with your MOD.</p>
          </div>
        )}

        {/* Flip Checklist */}
        {tableItems.length > 0 && (
          <FlipChecklist
            items={tableItems}
            station={primaryArchetype}
            onToggle={toggleTableItem}
          />
        )}

        {/* Pull List */}
        {inventoryItems.length > 0 && (
          <PullList
            items={inventoryItems}
            category={primaryArchetype}
            onUpdateAmountHave={updateAmountHave}
          />
        )}
      </div>
    </div>
  )
}
