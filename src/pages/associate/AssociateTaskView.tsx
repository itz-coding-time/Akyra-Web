import { useState } from "react"
import { useAssociateTasks, useEquipmentIssues } from "../../hooks"
import { TaskCard } from "../../components/TaskCard"
import { FlipChecklist } from "../../components/FlipChecklist"
import { PullList } from "../../components/PullList"
import { LoadingSpinner } from "../../components/LoadingSpinner"
import { Wrench } from "lucide-react"
import type { FloatMode } from "../../hooks"
import type { Associate } from "../../types"

const CATEGORIES = [
  "Refrigeration",
  "Cooking Equipment",
  "Coffee Machine",
  "POS / Register",
  "HVAC",
  "Plumbing",
  "Electrical",
  "Food Safety",
  "Other",
]

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

  const { submitIssue, isSubmitting } = useEquipmentIssues(associate.store_id)

  const [showIssueForm, setShowIssueForm] = useState(false)
  const [issueCategory, setIssueCategory] = useState("")
  const [issueDescription, setIssueDescription] = useState("")

  async function handleIssueSubmit() {
    if (!issueCategory || !issueDescription) return
    const success = await submitIssue(associate.id, issueCategory, issueDescription)
    if (success) {
      setShowIssueForm(false)
      setIssueCategory("")
      setIssueDescription("")
    }
  }

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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowIssueForm(!showIssueForm)}
            className="flex items-center gap-1 text-xs font-mono text-akyra-secondary hover:text-white transition-colors"
          >
            <Wrench className="w-3.5 h-3.5" />
            Report
          </button>
          {station === "Float" && (
            <button
              onClick={onChangeFloatMode}
              className="text-xs font-mono uppercase tracking-widest text-akyra-secondary hover:text-white transition-colors"
            >
              Switch mode
            </button>
          )}
        </div>
      </header>

      {/* Report Issue form */}
      {showIssueForm && (
        <div className="px-6 pt-4">
          <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4 space-y-3">
            <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
              Report Equipment Issue
            </p>

            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setIssueCategory(cat)}
                  className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                    issueCategory === cat
                      ? "border-white bg-white/10 text-white"
                      : "border-akyra-border text-akyra-secondary hover:border-white/40"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <textarea
              placeholder="Describe the issue..."
              value={issueDescription}
              onChange={e => setIssueDescription(e.target.value)}
              rows={3}
              className="w-full bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-akyra-secondary focus:outline-none focus:border-white/40 resize-none"
            />

            <div className="flex gap-2">
              <button
                onClick={() => { setShowIssueForm(false); setIssueCategory(""); setIssueDescription("") }}
                className="flex-1 py-2 rounded-lg border border-akyra-border text-xs font-mono text-akyra-secondary hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleIssueSubmit}
                disabled={!issueCategory || !issueDescription || isSubmitting}
                className={`flex-1 py-2 rounded-lg text-xs font-mono transition-all ${
                  issueCategory && issueDescription && !isSubmitting
                    ? "bg-white text-black hover:bg-white/90"
                    : "bg-akyra-surface text-akyra-secondary cursor-not-allowed"
                }`}
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

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

        {/* Pull Lists — grouped by category */}
        {["Bread", "Prep"].map(category => {
          const categoryItems = inventoryItems.filter(i => i.category === category)
          if (categoryItems.length === 0) return null
          return (
            <PullList
              key={category}
              items={categoryItems}
              category={category}
              onUpdateAmountHave={updateAmountHave}
            />
          )
        })}
      </div>
    </div>
  )
}
