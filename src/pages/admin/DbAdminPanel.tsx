import { useEffect, useState } from "react"
import {
  fetchAllOrgs,
  fetchStoresForOrg,
  fetchProfilesForStore,
  createDistrict,
  updateProfileRole,
  getRoleDisplayName,
  fetchRegionsForOrg,
  createRegion,
  createStore,
  deleteProfileAndRosterEntry,
  deleteOrganization,
  fetchDistrictsForRegion,
  type OrgSummary,
  type StoreSummary,
  type RegionSummary,
} from "../../lib"
import { NewOrgFlow } from "./NewOrgFlow"
import { StoreSetupWizard } from "./StoreSetupWizard"
import { OrgIdentityEditor } from "./OrgIdentityEditor"
import { StationManager } from "./StationManager"
import { RoleDisplayNameEditor } from "./RoleDisplayNameEditor"
import { ReportAliasManager } from "./ReportAliasManager"
import { LoadingSpinner } from "../../components/LoadingSpinner"
import { PasswordResetModal } from "../../components/PasswordResetModal"
import { AkyraLogo } from "../../components/AkyraLogo"
import { useAuth } from "../../context"
import { useNavigate } from "react-router-dom"
import { ChevronRight, Building2, Plus, Trash2, Map, MapPin, Store } from "lucide-react"
import type { Profile } from "../../types"

const ROLE_OPTIONS = [
  { role: "crew",              rank: 1, label: "Crew" },
  { role: "supervisor",        rank: 2, label: "Supervisor" },
  { role: "assistant_manager", rank: 3, label: "Assistant Manager" },
  { role: "store_manager",     rank: 4, label: "Store Manager" },
  { role: "district_admin",    rank: 5, label: "District Admin" },
  { role: "regional_admin",    rank: 6, label: "Regional Admin" },
  { role: "org_admin",         rank: 7, label: "Org Admin" },
  { role: "db_admin",          rank: 8, label: "Platform Admin" },
]

interface DistrictSummary {
  id: string
  name: string
  orgId: string
  districtManagerId: string | null
  storeCount: number
}

type AdminView =
  | { level: "orgs" }
  | { level: "regions"; org: OrgSummary }
  | { level: "districts"; org: OrgSummary; region: RegionSummary }
  | { level: "stores"; org: OrgSummary; region: RegionSummary; district: DistrictSummary }
  | { level: "profiles"; org: OrgSummary; region: RegionSummary; district: DistrictSummary; store: StoreSummary }

export function DbAdminPanel() {
  const { signOut, orgBranding } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState<AdminView>({ level: "orgs" })
  const [orgs, setOrgs] = useState<OrgSummary[]>([])
  const [regions, setRegions] = useState<RegionSummary[]>([])
  const [districts, setDistricts] = useState<DistrictSummary[]>([])
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showNewOrg, setShowNewOrg] = useState(false)
  const [setupStore, setSetupStore] = useState<{ id: string; name: string } | null>(null)
  const [editingOrg, setEditingOrg] = useState<{ id: string; name: string } | null>(null)
  const [managingStations, setManagingStations] = useState<{ id: string; name: string } | null>(null)
  const [editingRoles, setEditingRoles] = useState<{ id: string; name: string } | null>(null)
  const [reportStore, setReportStore] = useState<{ id: string; name: string } | null>(null)
  const [resettingProfile, setResettingProfile] = useState<{ authUid: string; name: string } | null>(null)

  const [showAddRegion, setShowAddRegion] = useState(false)
  const [newRegionName, setNewRegionName] = useState("")
  const [isCreatingRegion, setIsCreatingRegion] = useState(false)

  const [showAddDistrict, setShowAddDistrict] = useState(false)
  const [newDistrictName, setNewDistrictName] = useState("")
  const [isCreatingDistrict, setIsCreatingDistrict] = useState(false)

  const [showAddStore, setShowAddStore] = useState(false)
  const [newStoreNumber, setNewStoreNumber] = useState("")
  const [newStoreTimezone] = useState("America/New_York")
  const [isCreatingStore, setIsCreatingStore] = useState(false)
  const [storeError, setStoreError] = useState<string | null>(null)

  const [isDeletingProfile, setIsDeletingProfile] = useState(false)
  const [isDeletingOrg, setIsDeletingOrg] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    if (view.level === "orgs") {
      fetchAllOrgs().then(data => { setOrgs(data); setIsLoading(false) })
    } else if (view.level === "regions") {
      fetchRegionsForOrg(view.org.id).then(data => { setRegions(data); setIsLoading(false) })
    } else if (view.level === "districts") {
      fetchDistrictsForRegion(view.region.id).then(data => { setDistricts(data); setIsLoading(false) })
    } else if (view.level === "stores") {
      fetchStoresForOrg(view.org.id).then(data => {
        setStores(data.filter((s: any) => s.districtId === view.district.id))
        setIsLoading(false)
      })
    } else if (view.level === "profiles") {
      fetchProfilesForStore(view.store.id).then(data => { setProfiles(data); setIsLoading(false) })
    }
  }, [view])

  async function handleCreateRegion() {
    if (!newRegionName.trim() || view.level !== "regions") return
    setIsCreatingRegion(true)
    const id = await createRegion(view.org.id, newRegionName.trim())
    if (id) {
      setRegions(await fetchRegionsForOrg(view.org.id))
      setNewRegionName("")
      setShowAddRegion(false)
    }
    setIsCreatingRegion(false)
  }

  async function handleCreateDistrict() {
    if (!newDistrictName.trim() || view.level !== "districts") return
    setIsCreatingDistrict(true)
    const id = await createDistrict(view.org.id, newDistrictName.trim(), view.region.id)
    if (id) {
      setDistricts(await fetchDistrictsForRegion(view.region.id))
      setNewDistrictName("")
      setShowAddDistrict(false)
    }
    setIsCreatingDistrict(false)
  }

  async function handleCreateStore() {
    if (view.level !== "stores" || !newStoreNumber.trim()) return
    setIsCreatingStore(true)
    setStoreError(null)
    const id = await createStore(view.org.id, newStoreNumber.trim(), newStoreTimezone, view.district.id)
    if (id) {
      const allStores = await fetchStoresForOrg(view.org.id)
      setStores(allStores.filter((s: any) => s.districtId === view.district.id))
      setNewStoreNumber("")
      setShowAddStore(false)
    } else {
      setStoreError("Failed to create store. Check for duplicate number.")
    }
    setIsCreatingStore(false)
  }

  async function handleDeleteOrg(orgId: string, orgName: string) {
    if (!window.confirm(`PERMANENTLY DELETE ORGANIZATION "${orgName}"? This cannot be undone.`)) return
    setIsDeletingOrg(orgId)
    const success = await deleteOrganization(orgId)
    if (success) {
      setOrgs(prev => prev.filter(o => o.id !== orgId))
    }
    setIsDeletingOrg(null)
  }

  async function handleRoleUpdate(role: string, rank: number) {
    if (!editingProfile) return
    setIsUpdating(true)
    const success = await updateProfileRole(editingProfile.id, role, rank)
    if (success) {
      setProfiles(prev => prev.map(p =>
        p.id === editingProfile.id ? { ...p, role, role_rank: rank } : p
      ))
      setEditingProfile(null)
    }
    setIsUpdating(false)
  }

  async function handleDeleteProfile(profile: Profile) {
    if (!window.confirm(`Delete ${profile.display_name} and their roster entry?`)) return
    setIsDeletingProfile(true)
    const success = await deleteProfileAndRosterEntry(profile)
    if (success) {
      setProfiles(prev => prev.filter(p => p.id !== profile.id))
      setEditingProfile(null)
    }
    setIsDeletingProfile(false)
  }

  async function handleSignOut() {
    await signOut()
    navigate("/app/login")
  }

  return (
    <div className="min-h-screen bg-akyra-black text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-akyra-border">
        <div className="flex items-center gap-3">
          <AkyraLogo className="w-7 h-7" />
          <div>
            <span className="font-bold">AKYRA</span>
            <p className="text-[10px] font-mono uppercase tracking-widest text-akyra-red">Platform Admin</p>
          </div>
        </div>
        <button onClick={handleSignOut} className="text-xs font-mono text-akyra-secondary hover:text-akyra-red transition-colors">SIGN OUT</button>
      </header>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-akyra-border overflow-x-auto text-[10px] font-mono uppercase tracking-widest">
        <button onClick={() => setView({ level: "orgs" })} className={view.level === "orgs" ? "text-white" : "text-akyra-secondary"}>Orgs</button>
        
        {view.level !== "orgs" && (
          <>
            <ChevronRight className="w-3 h-3 text-akyra-secondary" />
            <button onClick={() => setView({ level: "regions", org: view.org })} className={view.level === "regions" ? "text-white" : "text-akyra-secondary"}>{view.org.name}</button>
          </>
        )}

        {(view.level === "districts" || view.level === "stores" || view.level === "profiles") && (
          <>
            <ChevronRight className="w-3 h-3 text-akyra-secondary" />
            <button onClick={() => setView({ level: "districts", org: view.org, region: view.region })} className={view.level === "districts" ? "text-white" : "text-akyra-secondary"}>{view.region.name}</button>
          </>
        )}

        {(view.level === "stores" || view.level === "profiles") && (
          <>
            <ChevronRight className="w-3 h-3 text-akyra-secondary" />
            <button onClick={() => setView({ level: "stores", org: view.org, region: view.region, district: view.district })} className={view.level === "stores" ? "text-white" : "text-akyra-secondary"}>{view.district.name}</button>
          </>
        )}

        {view.level === "profiles" && (
          <>
            <ChevronRight className="w-3 h-3 text-akyra-secondary" />
            <span className="text-white">Store {view.store.storeNumber}</span>
          </>
        )}
      </div>

      <div className="px-6 py-8 max-w-3xl mx-auto space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
        ) : (
          <>
            {/* 1. Organizations */}
            {view.level === "orgs" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black">Organizations</h2>
                  <button onClick={() => setShowNewOrg(true)} className="flex items-center gap-2 text-xs font-mono border border-akyra-border px-3 py-1.5 rounded-lg hover:border-white transition-all">+ NEW ORG</button>
                </div>
                {orgs.map(org => (
                  <div key={org.id} className="bg-akyra-surface border border-akyra-border rounded-2xl p-5 flex items-center justify-between hover:border-white/40 transition-all cursor-pointer group" onClick={() => setView({ level: "regions", org })}>
                    <div className="flex items-center gap-4">
                      <Building2 className="w-6 h-6 text-akyra-secondary" />
                      <div>
                        <p className="font-bold text-lg">{org.brandName ?? org.name}</p>
                        <p className="text-xs font-mono text-akyra-secondary uppercase">{org.storeCount} stores · {org.associateCount} associates</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={e => { e.stopPropagation(); setEditingOrg({ id: org.id, name: org.name }) }} className="text-[9px] font-mono border border-akyra-border px-2 py-1 rounded hover:bg-white hover:text-black">IDENTITY</button>
                      <button onClick={e => { e.stopPropagation(); setManagingStations({ id: org.id, name: org.name }) }} className="text-[9px] font-mono border border-akyra-border px-2 py-1 rounded hover:bg-white hover:text-black">STATIONS</button>
                      <button onClick={e => { e.stopPropagation(); setEditingRoles({ id: org.id, name: org.name }) }} className="text-[9px] font-mono border border-akyra-border px-2 py-1 rounded hover:bg-white hover:text-black">ROLES</button>
                      <button onClick={e => { e.stopPropagation(); handleDeleteOrg(org.id, org.name) }} disabled={isDeletingOrg === org.id} className="p-2 text-akyra-secondary hover:text-akyra-red transition-colors">
                        {isDeletingOrg === org.id ? <LoadingSpinner size="sm" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                      <ChevronRight className="w-5 h-5 text-akyra-secondary group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 2. Regions */}
            {view.level === "regions" && (
              <div className="space-y-4">
                <h2 className="text-lg font-black">{view.org.name} — Regions</h2>
                {regions.map(region => (
                  <div key={region.id} className="bg-akyra-surface border border-akyra-border rounded-xl p-4 flex items-center justify-between hover:border-white/40 transition-all cursor-pointer group" onClick={() => setView({ level: "districts", org: view.org, region })}>
                    <div className="flex items-center gap-3">
                      <Map className="w-5 h-5 text-akyra-secondary" />
                      <div>
                        <p className="font-bold">{region.name}</p>
                        <p className="text-[10px] font-mono text-akyra-secondary uppercase">{region.districtCount} districts · {region.storeCount} stores</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-akyra-secondary group-hover:translate-x-1 transition-transform" />
                  </div>
                ))}
                
                {showAddRegion ? (
                  <div className="bg-akyra-surface border border-white/20 rounded-xl p-4 space-y-3">
                    <input value={newRegionName} onChange={e => setNewRegionName(e.target.value)} placeholder="Region Name" className="w-full bg-black border border-akyra-border rounded-lg px-4 py-2 text-sm focus:outline-none" autoFocus />
                    <div className="flex gap-2">
                      <button onClick={() => setShowAddRegion(false)} className="flex-1 py-2 text-xs font-mono text-akyra-secondary">CANCEL</button>
                      <button 
                        onClick={handleCreateRegion} 
                        disabled={isCreatingRegion}
                        className="flex-1 py-2 bg-white text-black text-xs font-black rounded-lg disabled:opacity-50"
                      >
                        {isCreatingRegion ? "CREATING..." : "CREATE REGION"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddRegion(true)} className="w-full py-4 border border-dashed border-akyra-border rounded-xl text-akyra-secondary hover:text-white hover:border-white transition-all flex items-center justify-center gap-2 text-xs font-mono">
                    <Plus className="w-4 h-4" /> ADD REGION
                  </button>
                )}
              </div>
            )}

            {/* 3. Districts */}
            {view.level === "districts" && (
              <div className="space-y-4">
                <h2 className="text-lg font-black">{view.region.name} — Districts</h2>
                {districts.map(district => (
                  <div key={district.id} className="bg-akyra-surface border border-akyra-border rounded-xl p-4 flex items-center justify-between hover:border-white/40 transition-all cursor-pointer group" onClick={() => setView({ level: "stores", org: view.org, region: view.region, district })}>
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-akyra-secondary" />
                      <div>
                        <p className="font-bold">{district.name}</p>
                        <p className="text-[10px] font-mono text-akyra-secondary uppercase">{district.storeCount} stores</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-akyra-secondary group-hover:translate-x-1 transition-transform" />
                  </div>
                ))}

                {showAddDistrict ? (
                  <div className="bg-akyra-surface border border-white/20 rounded-xl p-4 space-y-3">
                    <input value={newDistrictName} onChange={e => setNewDistrictName(e.target.value)} placeholder="District Name" className="w-full bg-black border border-akyra-border rounded-lg px-4 py-2 text-sm focus:outline-none" autoFocus />
                    <div className="flex gap-2">
                      <button onClick={() => setShowAddDistrict(false)} className="flex-1 py-2 text-xs font-mono text-akyra-secondary">CANCEL</button>
                      <button 
                        onClick={handleCreateDistrict} 
                        disabled={isCreatingDistrict}
                        className="flex-1 py-2 bg-white text-black text-xs font-black rounded-lg disabled:opacity-50"
                      >
                        {isCreatingDistrict ? "CREATING..." : "CREATE DISTRICT"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddDistrict(true)} className="w-full py-4 border border-dashed border-akyra-border rounded-xl text-akyra-secondary hover:text-white hover:border-white transition-all flex items-center justify-center gap-2 text-xs font-mono">
                    <Plus className="w-4 h-4" /> ADD DISTRICT
                  </button>
                )}
              </div>
            )}

            {/* 4. Stores */}
            {view.level === "stores" && (
              <div className="space-y-4">
                <h2 className="text-lg font-black">{view.district.name} — Stores</h2>
                {stores.map(store => (
                  <div key={store.id} className="bg-akyra-surface border border-akyra-border rounded-xl p-4 flex items-center justify-between hover:border-white/40 transition-all cursor-pointer group" onClick={() => setView({ level: "profiles", org: view.org, region: view.region, district: view.district, store })}>
                    <div className="flex items-center gap-3">
                      <Store className="w-5 h-5 text-akyra-secondary" />
                      <div>
                        <p className="font-bold">Store {store.storeNumber}</p>
                        <p className="text-[10px] font-mono text-akyra-secondary uppercase">{store.associateCount} associates · {store.profileCount} registered</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={e => { e.stopPropagation(); setSetupStore({ id: store.id, name: `Store ${store.storeNumber}` }) }} className="text-[9px] font-mono border border-akyra-border px-2 py-1 rounded hover:bg-white hover:text-black">SETUP</button>
                      <button onClick={e => { e.stopPropagation(); setReportStore({ id: store.id, name: `Store ${store.storeNumber}` }) }} className="text-[9px] font-mono border border-akyra-border px-2 py-1 rounded hover:bg-white hover:text-black">REPORT</button>
                      <ChevronRight className="w-5 h-5 text-akyra-secondary group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}

                {showAddStore ? (
                  <div className="bg-akyra-surface border border-white/20 rounded-xl p-4 space-y-3">
                    <input value={newStoreNumber} onChange={e => setNewStoreNumber(e.target.value)} placeholder="Store Number" className="w-full bg-black border border-akyra-border rounded-lg px-4 py-2 text-sm focus:outline-none" autoFocus />
                    {storeError && <p className="text-[10px] font-mono text-akyra-red uppercase">{storeError}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => setShowAddStore(false)} className="flex-1 py-2 text-xs font-mono text-akyra-secondary">CANCEL</button>
                      <button 
                        onClick={handleCreateStore} 
                        disabled={isCreatingStore}
                        className="flex-1 py-2 bg-white text-black text-xs font-black rounded-lg disabled:opacity-50"
                      >
                        {isCreatingStore ? "CREATING..." : "CREATE STORE"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddStore(true)} className="w-full py-4 border border-dashed border-akyra-border rounded-xl text-akyra-secondary hover:text-white hover:border-white transition-all flex items-center justify-center gap-2 text-xs font-mono">
                    <Plus className="w-4 h-4" /> ADD STORE
                  </button>
                )}
              </div>
            )}

            {/* 5. Profiles */}
            {view.level === "profiles" && (
              <div className="space-y-4">
                <h2 className="text-lg font-black">Store {view.store.storeNumber} — Profiles</h2>
                {profiles.map(profile => (
                  <div key={profile.id} className="bg-akyra-surface border border-akyra-border rounded-xl p-4 flex items-center justify-between hover:border-white/40 transition-all cursor-pointer group" onClick={() => setEditingProfile(editingProfile?.id === profile.id ? null : profile)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-akyra-black border border-akyra-border flex items-center justify-center font-bold text-akyra-secondary group-hover:text-white transition-colors">{profile.display_name.charAt(0)}</div>
                      <div>
                        <p className="font-bold">{profile.display_name}</p>
                        <p className="text-[10px] font-mono text-akyra-secondary uppercase">{profile.eeid} · {getRoleDisplayName(profile.role, orgBranding)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {profile.auth_uid && (
                        <button onClick={e => { e.stopPropagation(); setResettingProfile({ authUid: profile.auth_uid!, name: profile.display_name }) }} className="text-[9px] font-mono border border-akyra-border px-2 py-1 rounded hover:border-akyra-red hover:text-akyra-red transition-colors">RESET PW</button>
                      )}
                      <ChevronRight className={`w-5 h-5 text-akyra-secondary transition-transform ${editingProfile?.id === profile.id ? "rotate-90" : ""}`} />
                    </div>
                  </div>
                ))}
                
                {editingProfile && (
                  <div className="bg-akyra-black border border-akyra-border rounded-xl p-4 space-y-4">
                    <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">Set Role for {editingProfile.display_name}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {ROLE_OPTIONS.map(opt => (
                        <button key={opt.role} onClick={() => handleRoleUpdate(opt.role, opt.rank)} disabled={isUpdating || editingProfile.role === opt.role} className={`py-2 px-3 text-[10px] font-mono border rounded transition-all ${editingProfile.role === opt.role ? "border-white bg-white text-black" : "border-akyra-border text-akyra-secondary hover:border-white hover:text-white"}`}>
                          {opt.label.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <button 
                      onClick={() => handleDeleteProfile(editingProfile)} 
                      disabled={isDeletingProfile}
                      className="w-full py-2 flex items-center justify-center gap-2 text-xs font-mono text-akyra-red hover:bg-akyra-red/10 rounded transition-colors disabled:opacity-50"
                    >
                      {isDeletingProfile ? "DELETING..." : <><Trash2 className="w-4 h-4" /> DELETE ACCOUNT</>}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals/Flows */}
      {showNewOrg && <NewOrgFlow onComplete={() => { setShowNewOrg(false); fetchAllOrgs().then(setOrgs) }} onCancel={() => setShowNewOrg(false)} />}
      {setupStore && <StoreSetupWizard storeId={setupStore.id} storeName={setupStore.name} orgStations={[]} onDone={() => setSetupStore(null)} />}
      {editingOrg && <OrgIdentityEditor orgId={editingOrg.id} orgName={editingOrg.name} onDone={() => { setEditingOrg(null); fetchAllOrgs().then(setOrgs) }} />}
      {managingStations && <StationManager orgId={managingStations.id} orgName={managingStations.name} onDone={() => setManagingStations(null)} />}
      {reportStore && <ReportAliasManager storeId={reportStore.id} storeName={reportStore.name} onDone={() => setReportStore(null)} />}
      {editingRoles && <RoleDisplayNameEditor orgId={editingRoles.id} orgName={editingRoles.name} onDone={() => setEditingRoles(null)} />}
      {resettingProfile && <PasswordResetModal associateName={resettingProfile.name} authUid={resettingProfile.authUid} onDone={() => setResettingProfile(null)} onDismiss={() => setResettingProfile(null)} />}
    </div>
  )
}
