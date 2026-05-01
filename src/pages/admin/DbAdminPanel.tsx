import { useEffect, useState } from "react"
import {
  fetchAllOrgs,
  fetchStoresForOrg,
  fetchProfilesForStore,
  fetchDistrictsForOrg,
  createDistrict,
  updateProfileRole,
  getRoleDisplayName,
  fetchRegionsForOrg,
  createRegion,
  createStore,
  deleteProfileAndRosterEntry,
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
import { ChevronRight, Building2, Users, Plus, Trash2 } from "lucide-react"
import { Store } from "lucide-react"
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
  | { level: "districts"; org: OrgSummary }
  | { level: "stores"; org: OrgSummary; district?: DistrictSummary }
  | { level: "profiles"; org: OrgSummary; store: StoreSummary }

export function DbAdminPanel() {
  const { signOut, orgBranding } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState<AdminView>({ level: "orgs" })
  const [orgs, setOrgs] = useState<OrgSummary[]>([])
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
  const [districts, setDistricts] = useState<DistrictSummary[]>([])
  const [showAddDistrict, setShowAddDistrict] = useState(false)
  const [newDistrictName, setNewDistrictName] = useState("")
  const [isCreatingDistrict, setIsCreatingDistrict] = useState(false)
  const [resettingProfile, setResettingProfile] = useState<{ authUid: string; name: string } | null>(null)
  const [managingRegions, setManagingRegions] = useState<{ id: string; name: string } | null>(null)
  const [regions, setRegions] = useState<RegionSummary[]>([])
  const [newRegionName, setNewRegionName] = useState("")
  const [showAddRegion, setShowAddRegion] = useState(false)
  const [isCreatingRegion, setIsCreatingRegion] = useState(false)
  const [showAddStore, setShowAddStore] = useState(false)
  const [newStoreNumber, setNewStoreNumber] = useState("")
  const [newStoreTimezone, setNewStoreTimezone] = useState("America/New_York")
  const [isCreatingStore, setIsCreatingStore] = useState(false)
  const [storeError, setStoreError] = useState<string | null>(null)
  const [isDeletingProfile, setIsDeletingProfile] = useState(false)

  useEffect(() => {
    setIsLoading(true)
    if (view.level === "orgs") {
      fetchAllOrgs().then(data => { setOrgs(data); setIsLoading(false) })
    } else if (view.level === "districts") {
      fetchDistrictsForOrg(view.org.id).then(data => {
        setDistricts(data)
        setIsLoading(false)
      })
    } else if (view.level === "stores") {
      fetchStoresForOrg(view.org.id).then(data => {
        const filtered = (view as any).district
          ? data.filter(s => (s as any).districtId === (view as any).district.id)
          : data
        setStores(filtered)
        setIsLoading(false)
      })
    } else if (view.level === "profiles") {
      fetchProfilesForStore(view.store.id).then(data => {
        setProfiles(data)
        setIsLoading(false)
      })
    }
  }, [view])

  async function handleCreateDistrict() {
    if (!newDistrictName.trim() || view.level !== "districts") return
    setIsCreatingDistrict(true)
    const id = await createDistrict(view.org.id, newDistrictName.trim())
    if (id) {
      const updated = await fetchDistrictsForOrg(view.org.id)
      setDistricts(updated)
      setNewDistrictName("")
      setShowAddDistrict(false)
    }
    setIsCreatingDistrict(false)
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

  async function handleCreateStore() {
    if (view.level !== "stores" || !newStoreNumber.trim()) return
    setIsCreatingStore(true)
    setStoreError(null)

    const id = await createStore(view.org.id, newStoreNumber.trim(), newStoreTimezone)

    if (id) {
      const updated = await fetchStoresForOrg(view.org.id)
      const filtered = view.district
        ? updated.filter(s => (s as any).districtId === view.district?.id)
        : updated
      setStores(filtered)
      setNewStoreNumber("")
      setNewStoreTimezone("America/New_York")
      setShowAddStore(false)
    } else {
      setStoreError("Store could not be created. Check DB permissions or duplicate store number.")
    }

    setIsCreatingStore(false)
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
    <div className="min-h-screen bg-akyra-black">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-akyra-border">
        <div className="flex items-center gap-3">
          <AkyraLogo className="w-7 h-7" />
          <div>
            <span className="font-bold text-white">AKYRA</span>
            <p className="text-[10px] font-mono uppercase tracking-widest text-akyra-red">
              DB Admin
            </p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="text-xs font-mono uppercase tracking-widest text-akyra-secondary hover:text-akyra-red transition-colors"
        >
          Sign Out
        </button>
      </header>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-akyra-border overflow-x-auto">
        <button
          onClick={() => setView({ level: "orgs" })}
          className={`text-xs font-mono shrink-0 ${view.level === "orgs" ? "text-white" : "text-akyra-secondary hover:text-white"}`}
        >
          Organizations
        </button>

        {view.level !== "orgs" && (
          <>
            <ChevronRight className="w-3 h-3 text-akyra-secondary shrink-0" />
            <button
              onClick={() => setView({ level: "districts", org: view.org })}
              className={`text-xs font-mono shrink-0 ${view.level === "districts" ? "text-white" : "text-akyra-secondary hover:text-white"}`}
            >
              {view.org.name}
            </button>
          </>
        )}

        {(view.level === "stores" || view.level === "profiles") && (
          <>
            <ChevronRight className="w-3 h-3 text-akyra-secondary shrink-0" />
            <button
              onClick={() => view.level === "profiles" && setView({ level: "stores", org: view.org })}
              className={`text-xs font-mono shrink-0 ${view.level === "stores" ? "text-white" : "text-akyra-secondary hover:text-white"}`}
            >
              {(view as any).district?.name ?? "All Stores"}
            </button>
          </>
        )}

        {view.level === "profiles" && (
          <>
            <ChevronRight className="w-3 h-3 text-akyra-secondary shrink-0" />
            <span className="text-xs font-mono text-white shrink-0">
              Store {view.store.storeNumber}
            </span>
          </>
        )}

        {view.level === "orgs" && (
          <button
            onClick={() => setShowNewOrg(true)}
            className="ml-auto flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white border border-akyra-border rounded-lg px-3 py-2 hover:border-white/40 transition-colors shrink-0"
          >
            + New Org
          </button>
        )}
      </div>

      <div className="px-6 py-6 max-w-2xl mx-auto space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <>
            {/* Orgs list */}
            {view.level === "orgs" && orgs.map(org => (
              <div
                key={org.id}
                className="w-full bg-akyra-surface border border-akyra-border rounded-xl p-4 flex items-center justify-between hover:border-white/40 transition-colors cursor-pointer"
                onClick={() => setView({ level: "districts", org })}
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-akyra-secondary" />
                  <div className="text-left">
                    <p className="font-semibold text-white">{org.brandName ?? org.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs font-mono text-akyra-secondary">
                        {org.storeCount} stores
                      </span>
                      <span className="text-xs font-mono text-akyra-secondary">
                        {org.associateCount} associates
                      </span>
                      {org.welcomePhrase && (
                        <span className="text-xs font-mono text-white/70">
                          Code {org.welcomePhrase}
                        </span>
                      )}
                      {org.licenseStatus && (
                        <span className={`text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                          org.licenseStatus === "active"
                            ? "border-white/20 text-white"
                            : "border-akyra-red/40 text-akyra-red"
                        }`}>
                          {org.licenseStatus}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      setEditingOrg({ id: org.id, name: org.name })
                    }}
                    className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary hover:text-white border border-akyra-border rounded px-2 py-1 transition-colors"
                  >
                    Identity
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      setManagingStations({ id: org.id, name: org.name })
                    }}
                    className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary hover:text-white border border-akyra-border rounded px-2 py-1 transition-colors"
                  >
                    Stations
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      setEditingRoles({ id: org.id, name: org.name })
                    }}
                    className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary hover:text-white border border-akyra-border rounded px-2 py-1 transition-colors"
                  >
                    Roles
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      setManagingRegions({ id: org.id, name: org.name })
                      fetchRegionsForOrg(org.id).then(setRegions)
                    }}
                    className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary hover:text-white border border-akyra-border rounded px-2 py-1 transition-colors"
                  >
                    Regions
                  </button>
                  <ChevronRight className="w-4 h-4 text-akyra-secondary" />
                </div>
              </div>
            ))}

            {/* Districts list */}
            {view.level === "districts" && (
              <div className="space-y-3">
                {/* All Stores shortcut */}
                <button
                  onClick={() => setView({ level: "stores", org: view.org })}
                  className="w-full bg-akyra-surface border border-white/10 rounded-xl p-4 flex items-center justify-between hover:border-white/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Store className="w-5 h-5 text-akyra-secondary" />
                    <div className="text-left">
                      <p className="font-semibold text-white">All Stores</p>
                      <p className="text-xs font-mono text-akyra-secondary">
                        View all stores regardless of district
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-akyra-secondary" />
                </button>

                {/* District list */}
                {districts.map(district => (
                  <button
                    key={district.id}
                    onClick={() => setView({ level: "stores", org: view.org, district })}
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

                {/* Add district inline form or button */}
                {showAddDistrict ? (
                  <div className="bg-akyra-surface border border-white/20 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
                      New District
                    </p>
                    <input
                      value={newDistrictName}
                      onChange={e => setNewDistrictName(e.target.value)}
                      placeholder="e.g. Western Maryland"
                      autoFocus
                      className="w-full bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowAddDistrict(false); setNewDistrictName("") }}
                        className="flex-1 py-2 rounded-lg border border-akyra-border text-akyra-secondary text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateDistrict}
                        disabled={!newDistrictName.trim() || isCreatingDistrict}
                        className="flex-1 py-2 rounded-lg bg-white text-black text-sm font-bold disabled:opacity-50"
                      >
                        {isCreatingDistrict ? "Creating..." : "Create"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddDistrict(true)}
                    className="w-full py-3 rounded-xl border border-dashed border-akyra-border text-akyra-secondary hover:border-white/40 hover:text-white transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add District
                  </button>
                )}
              </div>
            )}

            {/* Stores list */}
            {view.level === "stores" && (
              <>
                {stores.map(store => (
                  <div
                    key={store.id}
                    className="w-full bg-akyra-surface border border-akyra-border rounded-xl p-4 flex items-center justify-between hover:border-white/40 transition-colors cursor-pointer"
                    onClick={() => setView({ level: "profiles", org: view.org, store })}
                  >
                    <div className="flex items-center gap-3">
                      <Store className="w-5 h-5 text-akyra-secondary" />
                      <div className="text-left">
                        <p className="font-semibold text-white">Store {store.storeNumber}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs font-mono text-akyra-secondary">
                            {store.associateCount} associates
                          </span>
                          <span className="text-xs font-mono text-akyra-secondary">
                            {store.profileCount} registered
                          </span>
                          <span className={`text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                            store.billingStatus === "active"
                              ? "border-white/20 text-white"
                              : "border-akyra-red/40 text-akyra-red"
                          }`}>
                            {store.billingStatus}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          setSetupStore({ id: store.id, name: `Store ${store.storeNumber}` })
                        }}
                        className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary hover:text-white transition-colors border border-akyra-border rounded px-2 py-1"
                      >
                        Setup
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          setReportStore({ id: store.id, name: `Store ${store.storeNumber}` })
                        }}
                        className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary hover:text-white transition-colors border border-akyra-border rounded px-2 py-1"
                      >
                        Report
                      </button>
                      <ChevronRight className="w-4 h-4 text-akyra-secondary" />
                    </div>
                  </div>
                ))}

                {showAddStore ? (
                  <div className="bg-akyra-surface border border-white/20 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
                      New Store
                    </p>
                    <input
                      value={newStoreNumber}
                      onChange={e => setNewStoreNumber(e.target.value)}
                      placeholder="Store number"
                      autoFocus
                      className="w-full bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white"
                    />
                    <select
                      value={newStoreTimezone}
                      onChange={e => setNewStoreTimezone(e.target.value)}
                      className="w-full bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white"
                    >
                      {["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix", "America/Anchorage", "Pacific/Honolulu"].map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                    {storeError && <p className="text-xs font-mono text-akyra-red">{storeError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowAddStore(false); setNewStoreNumber(""); setStoreError(null) }}
                        className="flex-1 py-2 rounded-lg border border-akyra-border text-akyra-secondary text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateStore}
                        disabled={!newStoreNumber.trim() || isCreatingStore}
                        className="flex-1 py-2 rounded-lg bg-white text-black text-sm font-bold disabled:opacity-50"
                      >
                        {isCreatingStore ? "Creating..." : "Create"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddStore(true)}
                    className="w-full py-3 rounded-xl border border-dashed border-akyra-border text-akyra-secondary hover:border-white/40 hover:text-white transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Store
                  </button>
                )}
              </>
            )}

            {/* Profiles list */}
            {view.level === "profiles" && profiles.map(profile => (
              <div key={profile.id}>
                <button
                  onClick={() => setEditingProfile(
                    editingProfile?.id === profile.id ? null : profile
                  )}
                  className="w-full bg-akyra-surface border border-akyra-border rounded-xl p-4 flex items-center justify-between hover:border-white/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-akyra-border flex items-center justify-center">
                      <span className="text-sm font-bold text-white">
                        {profile.display_name.charAt(0)}
                      </span>
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-white">{profile.display_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono text-akyra-secondary">
                          {profile.eeid}
                        </span>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary">
                          {getRoleDisplayName(profile.role, orgBranding)}
                        </span>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          profile.auth_uid ? "bg-white" : "bg-akyra-red"
                        }`} />
                      </div>
                    </div>
                  </div>
                  {profile.auth_uid && (
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setResettingProfile({
                          authUid: profile.auth_uid!,
                          name: profile.display_name,
                        })
                      }}
                      className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary hover:text-akyra-red border border-akyra-border rounded px-2 py-1 transition-colors"
                    >
                      Reset PW
                    </button>
                  )}
                  <ChevronRight className={`w-4 h-4 text-akyra-secondary transition-transform ${
                    editingProfile?.id === profile.id ? "rotate-90" : ""
                  }`} />
                </button>

                {/* Role editor */}
                {editingProfile?.id === profile.id && (
                  <div className="mt-1 bg-akyra-black border border-akyra-border rounded-xl overflow-hidden">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-akyra-secondary px-4 py-2 border-b border-akyra-border">
                      Set Role
                    </p>
                    {ROLE_OPTIONS.map(opt => (
                      <button
                        key={opt.role}
                        onClick={() => handleRoleUpdate(opt.role, opt.rank)}
                        disabled={isUpdating || profile.role === opt.role}
                        className={`w-full text-left px-4 py-3 text-sm transition-colors border-b border-akyra-border last:border-0 ${
                          profile.role === opt.role
                            ? "text-white bg-white/5"
                            : "text-akyra-secondary hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{opt.label}</span>
                          {profile.role === opt.role && (
                            <span className="text-[10px] font-mono text-akyra-secondary">current</span>
                          )}
                          {isUpdating && editingProfile?.id === profile.id && (
                            <LoadingSpinner size="sm" />
                          )}
                        </div>
                      </button>
                    ))}
                    <button
                      onClick={() => handleDeleteProfile(profile)}
                      disabled={isDeletingProfile}
                      className="w-full text-left px-4 py-3 text-sm text-akyra-red hover:bg-akyra-red/10 transition-colors flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete profile and roster entry
                      </span>
                      {isDeletingProfile && <LoadingSpinner size="sm" />}
                    </button>
                  </div>
                )}
              </div>
            ))}

            {view.level === "profiles" && profiles.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-10 h-10 text-akyra-border mx-auto mb-3" />
                <p className="text-akyra-secondary text-sm">No registered profiles for this store.</p>
              </div>
            )}
          </>
        )}
      </div>
      {showNewOrg && (
        <NewOrgFlow
          onComplete={() => {
            setShowNewOrg(false)
            fetchAllOrgs().then(setOrgs)
          }}
          onCancel={() => setShowNewOrg(false)}
        />
      )}
      {setupStore && view.level === "stores" && (
        <StoreSetupWizard
          storeId={setupStore.id}
          storeName={setupStore.name}
          orgStations={[]}
          onDone={() => setSetupStore(null)}
        />
      )}
      {editingOrg && (
        <OrgIdentityEditor
          orgId={editingOrg.id}
          orgName={editingOrg.name}
          onDone={() => {
            setEditingOrg(null)
            fetchAllOrgs().then(setOrgs)
          }}
        />
      )}
      {managingStations && (
        <StationManager
          orgId={managingStations.id}
          orgName={managingStations.name}
          onDone={() => setManagingStations(null)}
        />
      )}
      {reportStore && view.level === "stores" && (
        <ReportAliasManager
          storeId={reportStore.id}
          storeName={reportStore.name}
          onDone={() => setReportStore(null)}
        />
      )}
      {editingRoles && (
        <RoleDisplayNameEditor
          orgId={editingRoles.id}
          orgName={editingRoles.name}
          onDone={() => setEditingRoles(null)}
        />
      )}
      {resettingProfile && (
        <PasswordResetModal
          associateName={resettingProfile.name}
          authUid={resettingProfile.authUid}
          onDone={() => setResettingProfile(null)}
          onDismiss={() => setResettingProfile(null)}
        />
      )}
      {managingRegions && (
        <div className="fixed inset-0 z-50 bg-black overflow-y-auto">
          <div className="max-w-lg mx-auto px-6 py-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-white">Regions</h2>
                <p className="text-xs font-mono text-akyra-secondary">{managingRegions.name}</p>
              </div>
              <button
                onClick={() => { setManagingRegions(null); setShowAddRegion(false); setNewRegionName("") }}
                className="text-akyra-secondary hover:text-white transition-colors text-xs font-mono uppercase tracking-widest"
              >
                Done
              </button>
            </div>

            <div className="space-y-3">
              {regions.length === 0 && !showAddRegion && (
                <p className="text-sm text-akyra-secondary">No regions yet.</p>
              )}
              {regions.map(region => (
                <div
                  key={region.id}
                  className="bg-akyra-surface border border-akyra-border rounded-xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-akyra-secondary" />
                    <div>
                      <p className="font-semibold text-white text-sm">{region.name}</p>
                      <p className="text-xs font-mono text-akyra-secondary">
                        {region.districtCount} districts · {region.storeCount} stores
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {showAddRegion ? (
                <div className="bg-akyra-surface border border-white/20 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-mono uppercase tracking-widest text-akyra-secondary">
                    New Region
                  </p>
                  <input
                    value={newRegionName}
                    onChange={e => setNewRegionName(e.target.value)}
                    placeholder="e.g. Mid-Atlantic"
                    autoFocus
                    className="w-full bg-akyra-black border border-akyra-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowAddRegion(false); setNewRegionName("") }}
                      className="flex-1 py-2 rounded-lg border border-akyra-border text-akyra-secondary text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!newRegionName.trim()) return
                        setIsCreatingRegion(true)
                        const id = await createRegion(managingRegions.id, newRegionName.trim())
                        if (id) {
                          const updated = await fetchRegionsForOrg(managingRegions.id)
                          setRegions(updated)
                          setNewRegionName("")
                          setShowAddRegion(false)
                        }
                        setIsCreatingRegion(false)
                      }}
                      disabled={!newRegionName.trim() || isCreatingRegion}
                      className="flex-1 py-2 rounded-lg bg-white text-black text-sm font-bold disabled:opacity-50"
                    >
                      {isCreatingRegion ? "Creating..." : "Create"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddRegion(true)}
                  className="w-full py-3 rounded-xl border border-dashed border-akyra-border text-akyra-secondary hover:border-white/40 hover:text-white transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Region
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
