import { useAuth } from "../../context"
import { useAssociates } from "../../hooks"
import { AssociateCard } from "../../components/AssociateCard"
import { LoadingSpinner } from "../../components/LoadingSpinner"
import { Users } from "lucide-react"

export function AssociatesPage() {
  const { state } = useAuth()
  const storeId = state.profile?.current_store_id
  const { associates, isLoading, error, refetch } = useAssociates(storeId)

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <LoadingSpinner size="md" />
        <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
          Loading associates...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p className="text-akyra-red text-sm font-mono">{error}</p>
        <button
          onClick={refetch}
          className="text-xs font-mono uppercase tracking-widest text-akyra-secondary hover:text-white transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (associates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <Users className="w-10 h-10 text-akyra-border" />
        <p className="text-akyra-secondary text-sm">No associates found for this store.</p>
        <p className="text-xs font-mono text-akyra-secondary">
          Run the importer to populate associates.
        </p>
      </div>
    )
  }

  // Group by archetype
  const grouped = associates.reduce<Record<string, typeof associates>>(
    (acc, a) => {
      const key = a.current_archetype
      if (!acc[key]) acc[key] = []
      acc[key].push(a)
      return acc
    },
    {}
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black">Associates</h2>
        <span className="text-xs font-mono text-akyra-secondary">
          {associates.length} total
        </span>
      </div>

      {/* Registration legend */}
      <div className="flex items-center gap-4 px-1">
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-akyra-secondary uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-white inline-block" />
          Registered
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-akyra-secondary uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
          Pending
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-akyra-secondary uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-akyra-red inline-block" />
          Unregistered
        </span>
      </div>

      {Object.entries(grouped).map(([archetype, group]) => (
        <div key={archetype}>
          <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary mb-3">
            {archetype} · {group.length}
          </p>
          <div className="space-y-2">
            {group.map((associate) => (
              <AssociateCard key={associate.id} associate={associate} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
