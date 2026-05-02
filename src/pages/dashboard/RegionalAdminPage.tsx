import { useEffect, useState } from "react"
import { useAuth } from "../../context"
import {
  fetchRegionsForOrg,
  fetchDistrictsForOrg,
  fetchStoresForOrg,
  fetchRegionalMetrics,
  fetchDistrictPredators,
  type RegionSummary,
} from "../../lib"
import { LoadingSpinner } from "../../components/LoadingSpinner"
import { TierBadge } from "../../components/TierBadge"
import {
  ChevronRight, ChevronLeft, Building2,
  Store, MapPin
} from "lucide-react"

type RegionalView =
  | { level: "overview" }
  | { level: "districts"; region: RegionSummary }
  | { level: "stores"; region: RegionSummary; districtId: string; districtName: string }

export function RegionalAdminPage() {
  const { state } = useAuth()
  const orgId = state.profile?.org_id ?? undefined
  const regionId = (state.profile as any)?.region_id as string | undefined
  const [view, setView] = useState<RegionalView>({ level: "overview" })
  const [isLoading, setIsLoading] = useState(true)

  const [regions, setRegions] = useState<RegionSummary[]>([])
  const [districts, setDistricts] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any>(null)
  const [myRegion, setMyRegion] = useState<RegionSummary | null>(null)
  const [districtPredators, setDistrictPredators] = useState<any[]>([])

  useEffect(() => {
    if (!orgId) return
    setIsLoading(true)

    Promise.all([
      fetchRegionsForOrg(orgId),
      regionId ? fetchRegionalMetrics(regionId) : Promise.resolve(null),
    ]).then(([r, m]) => {
      setRegions(r)
      setMetrics(m)
      if (regionId) {
        setMyRegion(r.find(reg => reg.id === regionId) ?? null)
      }
      setIsLoading(false)
    })
  }, [orgId, regionId])

  useEffect(() => {
    if (view.level === "districts" && orgId) {
      setIsLoading(true)
      fetchDistrictsForOrg(orgId).then(d => {
        setDistricts(d.filter((dist: any) => dist.regionId === view.region.id))
        setIsLoading(false)
      })
    } else if (view.level === "stores" && orgId) {
      setIsLoading(true)
      fetchStoresForOrg(orgId).then(s => {
        setStores(s)
        setIsLoading(false)
      })
      fetchDistrictPredators(view.districtId).then(setDistrictPredators)
    }
  }, [view, orgId])

  if (isLoading) {
    return <div className="flex justify-center py-12"><LoadingSpinner /></div>
  }

  const displayRegion = myRegion ?? regions[0]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        {view.level !== "overview" && (
          <button
            onClick={() => setView({ level: "overview" })}
            className="text-akyra-secondary hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div>
          <h2 className="text-2xl font-black text-white">
            {view.level === "overview" ? "Regional Overview" :
             view.level === "districts" ? view.region.name :
             view.districtName}
          </h2>
          <p className="text-xs font-mono text-akyra-secondary">
            {view.level === "overview" ? "T6 Regional Admin" :
             view.level === "districts" ? `${view.region.districtCount} districts · ${view.region.storeCount} stores` :
             "Stores"}
          </p>
        </div>
      </div>

      {/* Overview */}
      {view.level === "overview" && (
        <div className="space-y-6">

          {/* Regional metrics */}
          {metrics && (
            <div className="space-y-3">
              <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
                Region Performance — Last 30 Days
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4">
                  <p className="text-[10px] font-mono text-akyra-secondary uppercase tracking-widest mb-1">
                    Stores
                  </p>
                  <p className="text-3xl font-black text-white">{metrics.totalStores}</p>
                </div>
                <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4">
                  <p className="text-[10px] font-mono text-akyra-secondary uppercase tracking-widest mb-1">
                    Avg Completion
                  </p>
                  <p className="text-3xl font-black text-white">{metrics.avgCompletionPct}%</p>
                </div>
                <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4">
                  <p className="text-[10px] font-mono text-akyra-secondary uppercase tracking-widest mb-1">
                    Dead Codes
                  </p>
                  <p className="text-3xl font-black text-akyra-red">{metrics.totalDeadCodes}</p>
                </div>
                <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4">
                  <p className="text-[10px] font-mono text-akyra-secondary uppercase tracking-widest mb-1">
                    Tasks Orphaned
                  </p>
                  <p className="text-3xl font-black text-akyra-red">{metrics.totalTasksOrphaned}</p>
                </div>
              </div>
            </div>
          )}

          {/* Region */}
          <div className="space-y-3">
            <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
              Your Region
            </p>
            {displayRegion ? (
              <button
                onClick={() => setView({ level: "districts", region: displayRegion })}
                className="w-full bg-akyra-surface border border-akyra-border rounded-xl p-4 flex items-center justify-between hover:border-white/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-akyra-secondary" />
                  <div className="text-left">
                    <p className="font-semibold text-white">{displayRegion.name}</p>
                    <p className="text-xs font-mono text-akyra-secondary">
                      {displayRegion.districtCount} districts · {displayRegion.storeCount} stores
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-akyra-secondary" />
              </button>
            ) : (
              <p className="text-sm text-akyra-secondary">
                No region assigned. Contact your Org Admin.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Districts in region */}
      {view.level === "districts" && (
        <div className="space-y-3">
          {districts.length === 0 ? (
            <p className="text-sm text-akyra-secondary">
              No districts in this region yet.
            </p>
          ) : districts.map((district: any) => (
            <button
              key={district.id}
              onClick={() => setView({
                level: "stores",
                region: view.region,
                districtId: district.id,
                districtName: district.name,
              })}
              className="w-full bg-akyra-surface border border-akyra-border rounded-xl p-4 flex items-center justify-between hover:border-white/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-akyra-secondary" />
                <div className="text-left">
                  <p className="font-semibold text-white">{district.name}</p>
                  <p className="text-xs font-mono text-akyra-secondary">
                    {district.storeCount} stores
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-akyra-secondary" />
            </button>
          ))}
        </div>
      )}

      {/* Stores in district */}
      {view.level === "stores" && (
        <div className="space-y-3">
          {districtPredators.length > 0 && (
            <div className="space-y-2 mb-4">
              <p className="text-[10px] font-mono uppercase tracking-widest text-yellow-400/60">
                🔱 District Predators
              </p>
              {districtPredators.map(p => (
                <div key={p.associateId} className="flex items-center justify-between bg-yellow-500/[0.05] border border-yellow-500/20 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-semibold text-white">{p.associateName}</p>
                    <p className="text-xs font-mono text-white/30">Store {p.storeNumber}</p>
                  </div>
                  <div className="text-right">
                    <TierBadge tier="Predator" isPredator size="sm" />
                    <p className="text-[10px] font-mono text-white/20 mt-0.5">{p.pointsTotal} pts</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {stores.length === 0 ? (
            <p className="text-sm text-akyra-secondary">No stores in this district.</p>
          ) : stores.map(store => (
            <div
              key={store.id}
              className="bg-akyra-surface border border-akyra-border rounded-xl p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Store className="w-5 h-5 text-akyra-secondary" />
                  <div>
                    <p className="font-semibold text-white">Store {store.storeNumber}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs font-mono text-akyra-secondary">
                        {store.associateCount} associates
                      </span>
                      <span className="text-xs font-mono text-akyra-secondary">
                        {store.profileCount} registered
                      </span>
                    </div>
                  </div>
                </div>
                <span className={`text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border ${
                  store.billingStatus === "active"
                    ? "border-white/20 text-white/40"
                    : "border-akyra-red/40 text-akyra-red"
                }`}>
                  {store.billingStatus}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
