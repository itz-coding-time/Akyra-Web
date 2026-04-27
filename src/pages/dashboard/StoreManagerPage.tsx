import { useEffect, useState } from "react"
import { useAuth } from "../../context"
import {
  fetchChallengedTasksForStoreManager,
  resolveChallenge,
  fetchTimeSuggestions,
  reviewTimeSuggestion,
} from "../../lib"
import { LoadingSpinner } from "../../components/LoadingSpinner"
import { CheckCircle, XCircle, Clock } from "lucide-react"

export function StoreManagerPage() {
  const { state } = useAuth()
  const storeId = state.profile?.current_store_id
  const [challenges, setChallenges] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [resolving, setResolving] = useState<string | null>(null)

  // Store manager's associate ID — populated when auth wires it in a future stage
  const smAssociateId: string | null = null

  useEffect(() => {
    if (!storeId) return
    setIsLoading(true)
    Promise.all([
      fetchChallengedTasksForStoreManager(storeId),
      fetchTimeSuggestions(storeId),
    ]).then(([c, s]) => {
      setChallenges(c)
      setSuggestions(s)
      setIsLoading(false)
    })
  }, [storeId])

  async function handleChallengeVerdict(verificationId: string, verdict: "complete" | "incomplete") {
    if (!smAssociateId) return
    setResolving(verificationId)
    await resolveChallenge(verificationId, smAssociateId, verdict)
    setChallenges(prev => prev.filter(c => c.id !== verificationId))
    setResolving(null)
  }

  async function handleSuggestion(suggestion: any, apply: boolean) {
    if (!smAssociateId) return
    await reviewTimeSuggestion(
      suggestion.id,
      smAssociateId,
      apply,
      apply ? suggestion.task_id : undefined,
      apply ? suggestion.suggested_minutes : undefined
    )
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id))
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-black">Store Manager</h2>

      {/* Challenged Tasks */}
      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary mb-3">
          Challenged Tasks · {challenges.length}
        </p>

        {challenges.length === 0 ? (
          <p className="text-sm text-akyra-secondary font-mono">No challenges pending.</p>
        ) : (
          <div className="space-y-3">
            {challenges.map(c => (
              <div key={c.id} className="bg-akyra-surface border border-akyra-border rounded-xl p-4 space-y-3">
                <div>
                  <p className="font-semibold text-white">{c.tasks?.task_name}</p>
                  <p className="text-xs text-akyra-secondary font-mono">
                    {c.associates?.name} · Challenged supervisor review
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {c.associate_photo_url && (
                    <div>
                      <p className="text-[10px] font-mono text-akyra-secondary mb-1">Associate</p>
                      <img src={c.associate_photo_url} alt="" className="w-full rounded-lg border border-akyra-border" />
                    </div>
                  )}
                  {c.supervisor_photo_url && (
                    <div>
                      <p className="text-[10px] font-mono text-akyra-secondary mb-1">Supervisor</p>
                      <img src={c.supervisor_photo_url} alt="" className="w-full rounded-lg border border-akyra-border" />
                    </div>
                  )}
                </div>

                {c.rejection_reason && (
                  <p className="text-xs text-akyra-secondary">
                    Supervisor note: <span className="text-white">{c.rejection_reason}</span>
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleChallengeVerdict(c.id, "incomplete")}
                    disabled={resolving === c.id}
                    className="flex-1 py-2.5 rounded-xl border border-[#E63946]/40 text-[#E63946] text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Not Complete
                  </button>
                  <button
                    onClick={() => handleChallengeVerdict(c.id, "complete")}
                    disabled={resolving === c.id}
                    className="flex-1 py-2.5 rounded-xl border border-white/20 text-white text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Complete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Time Suggestions */}
      {suggestions.length > 0 && (
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary mb-3">
            Time Suggestions · {suggestions.length}
          </p>
          <div className="space-y-3">
            {suggestions.map(s => (
              <div key={s.id} className="bg-akyra-surface border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-akyra-secondary mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-white">{s.tasks?.task_name}</p>
                    <p className="text-xs text-akyra-secondary">
                      Task completed significantly faster than expected.
                    </p>
                    <p className="text-xs text-white/60 mt-1">
                      Current: {s.current_expected_minutes}min →
                      Suggested: <span className="text-white font-bold">{s.suggested_minutes}min</span>
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleSuggestion(s, false)}
                    className="flex-1 py-2 rounded-lg border border-akyra-border text-akyra-secondary text-xs font-mono"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleSuggestion(s, true)}
                    className="flex-1 py-2 rounded-lg border border-white/20 text-white text-xs font-mono"
                  >
                    Apply
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
