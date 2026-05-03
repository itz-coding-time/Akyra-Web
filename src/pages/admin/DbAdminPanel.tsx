import { useEffect, useState, useRef } from "react"
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
  deleteOrganization,
  fetchDistrictsForRegion,
  fetchProfilesForOrg,
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
import { ChevronRight, Building2, Users, Plus, Trash2, Calendar, AlertTriangle } from "lucide-react"
import { OrgRadialMenu, type OrgRadialActionDirection } from "../../components/OrgRadialMenu"
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
  | { level: "regions"; org: OrgSummary }
  | { level: "org_associates"; org: OrgSummary }
  | { level: "districts"; org: OrgSummary; region: RegionSummary }
  | { level: "stores"; org: OrgSummary; region: RegionSummary; district: DistrictSummary }
  | { level: "profiles"; org: OrgSummary; region: RegionSummary; district: DistrictSummary; store: StoreSummary }

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
  const [activeOrgMenu, setActiveOrgMenu] = useState<{ org: OrgSummary; position: { x: number; y: number } } | null>(null)
  const [showWelcomeCode, setShowWelcomeCode] = useState<{ name: string; phrase: string } | null>(null)
  const [showDangerModal, setShowDangerModal] = useState<OrgSummary | null>(null)
  const [showLicenseModal, setShowLicenseModal] = useState<OrgSummary | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongPress = useRef(false)

  useEffect(() => {
    setIsLoading(true)
    console.log("[DbAdminPanel] view change:", view.level)
    if (view.level === "orgs") {
      fetchAllOrgs().then(data => { 
        console.log("[DbAdminPanel] fetchAllOrgs success:", data.length)
        setOrgs(data); 
        setIsLoading(false) 
      }).catch(err => {
        console.error("[DbAdminPanel] fetchAllOrgs failed:", err)
        setIsLoading(false)
      })
    } else if (view.level === "org_associates") {
      fetchProfilesForOrg(view.org.id).then(data => {
        console.log("[DbAdminPanel] fetchProfilesForOrg success:", data.length)
        setProfiles(data)
        setIsLoading(false)
      }).catch(err => {
        console.error("[DbAdminPanel] fetchProfilesForOrg failed:", err)
        setIsLoading(false)
      })
    } else if (view.level === "regions") {
      fetchRegionsForOrg(view.org.id).then(data => { 
        console.log("[DbAdminPanel] fetchRegionsForOrg success:", data.length)
        setRegions(data); 
        setIsLoading(false) 
      }).catch(err => {
        console.error("[DbAdminPanel] fetchRegionsForOrg failed:", err)
        setIsLoading(false)
      })
    } else if (view.level === "districts") {
      fetchDistrictsForRegion(view.region.id).then(data => {
        console.log("[DbAdminPanel] fetchDistrictsForRegion success:", data.length)
        setDistricts(data)
        setIsLoading(false)
      }).catch(err => {
        console.error("[DbAdminPanel] fetchDistrictsForRegion failed:", err)
        setIsLoading(false)
      })
    } else if (view.level === "stores") {
      fetchStoresForOrg(view.org.id).then(data => {
        console.log("[DbAdminPanel] fetchStoresForOrg success:", data.length)
        const filtered = view.district
          ? data.filter(s => (s as any).districtId === view.district.id)
          : data
        setStores(filtered)
        setIsLoading(false)
      }).catch(err => {
        console.error("[DbAdminPanel] fetchStoresForOrg failed:", err)
        setIsLoading(false)
      })
    } else if (view.level === "profiles") {
      fetchProfilesForStore(view.store.id).then(data => {
        console.log("[DbAdminPanel] fetchProfilesForStore success:", data.length)
        setProfiles(data)
        setIsLoading(false)
      }).catch(err => {
        console.error("[DbAdminPanel] fetchProfilesForStore failed:", err)
        setIsLoading(false)
      })
    }
  }, [view])

  
  function handleOrgTouchStart(e: React.TouchEvent | React.MouseEvent, org: OrgSummary) {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    isLongPress.current = false
    let clientX, clientY;
    if ("touches" in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = (e as React.MouseEvent).clientX
      clientY = (e as React.MouseEvent).clientY
    }

    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true
      setActiveOrgMenu({ org, position: { x: clientX, y: clientY } })
      longPressTimer.current = null
    }, 500)
  }

  function handleOrgTouchEnd(org: OrgSummary) {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (!isLongPress.current && !activeOrgMenu) {
      setView({ level: "regions", org })
    }
  }

  function handleOrgMenuSelect(direction: OrgRadialActionDirection, org: OrgSummary) {
    if (direction === "up") {
      setShowWelcomeCode({
        name: org.name,
        phrase: org.welcomePhrase ?? "No welcome code configured"
      })
    } else if (direction === "down") {
      setView({ level: "org_associates", org })
    } else if (direction === "right") {
      setShowLicenseModal(org)
    } else if (direction === "left-hold" || direction === "left") {
      setShowDangerModal(org)
    }
  }

  async function confirmNuclearDelete(org: OrgSummary) {
    setShowDangerModal(null)
    setTimeout(async () => {
      const confirmed = window.confirm(`Are you sure you want to delete this org? Any data not backed up will be lost.`)
      if (!confirmed) return
      
      const typed = window.prompt(`If you are sure, type 'delete', and then tap OK!`)
      if (typed === "delete") {
        setIsLoading(true)
        const success = await deleteOrganization(org.id)
        if (success) {
          setOrgs(prev => prev.filter(o => o.id !== org.id))
          if (view.level !== "orgs" && (view as any).org?.id === org.id) {
            setView({ level: "orgs" })
          }
        } else {
          alert("Failed to delete organization.")
        }
        setIsLoading(false)
      } else {
        alert("Deletion cancelled.")
      }
    }, 100)
  }

  async function handleCreateDistrict() {
    if (!newDistrictName.trim() || view.level !== "districts") return
    setIsCreatingDistrict(true)
    const id = await createDistrict(view.org.id, view.region.id, newDistrictName.trim())
    if (id) {
      const updated = await fetchDistrictsForRegion(view.region.id)
      setDistricts(updated)
      setNewDistrictName("")
      setShowAddDistrict(false)
    }
    setIsCreatingDistrict(false)
  }

  async function handleDeleteOrg(org: OrgSummary) {
    if (!window.confirm(`WARNING! Are you sure you want to PERMANENTLY DELETE ${org.name} and all its data?`)) return
    setIsLoading(true)
    const success = await deleteOrganization(org.id)
    if (success) {
      setOrgs(prev => prev.filter(o => o.id !== org.id))
    } else {
      alert("Failed to delete organization.")
    }
    setIsLoading(false)
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
              onClick={() => setView({ level: "regions", org: view.org })}
              className={`text-xs font-mono shrink-0 ${view.level === "regions" ? "text-white" : "text-akyra-secondary hover:text-white"}`}
            >
              {view.org.name}
            </button>
          </>
        )}

        {(view.level === "org_associates") && (
          <>
            <ChevronRight className="w-3 h-3 text-akyra-secondary shrink-0" />
            <span className="text-xs font-mono text-white shrink-0">
              All Associates
            </span>
          </>
        )}

        {(view.level === "districts" || view.level === "stores" || view.level === "profiles") && (
          <>
            <ChevronRight className="w-3 h-3 text-akyra-secondary shrink-0" />
            <button
              onClick={() => setView({ level: "districts", org: view.org, region: (view as any).region })}
              className={`text-xs font-mono shrink-0 ${view.level === "districts" ? "text-white" : "text-akyra-secondary hover:text-white"}`}
            >
              {(view as any).region.name}
            </button>
          </>
        )}

        {(view.level === "stores" || view.level === "profiles") && (
          <>
            <ChevronRight className="w-3 h-3 text-akyra-secondary shrink-0" />
            <button
              onClick={() => setView({ level: "stores", org: view.org, region: (view as any).region, district: (view as any).district })}
              className={`text-xs font-mono shrink-0 ${view.level === "stores" ? "text-white" : "text-akyra-secondary hover:text-white"}`}
            >
              {(view as any).district.name}
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
                className="w-full bg-akyra-surface border border-akyra-border rounded-xl p-4 flex items-center justify-between hover:border-white/40 transition-colors cursor-pointer relative select-none"
                onMouseDown={e => handleOrgTouchStart(e, org)}
                onMouseUp={() => handleOrgTouchEnd(org)}
                onMouseLeave={() => {
                  if (longPressTimer.current) clearTimeout(longPressTimer.current)
                }}
                onTouchStart={e => handleOrgTouchStart(e, org)}
                onTouchEnd={() => handleOrgTouchEnd(org)}
                onTouchCancel={() => {
                  if (longPressTimer.current) clearTimeout(longPressTimer.current)
                }}
              >
                <div className="flex items-center gap-3 pointer-events-none">
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
                        <span className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border border-white/20 text-white bg-white/5">
                          Code: {org.welcomePhrase}
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
                <div className="flex items-center gap-3 pointer-events-none">
                  <ChevronRight className="w-4 h-4 text-akyra-secondary" />
                </div>
              </div>
            ))}

            {/* Org Associates list */}
            {view.level === "org_associates" && profiles.map(profile => (
              <div key={profile.id} className="w-full bg-akyra-surface border border-akyra-border rounded-xl p-4 flex items-center justify-between">
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
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {view.level === "org_associates" && profiles.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-10 h-10 text-akyra-border mx-auto mb-3" />
                <p className="text-akyra-secondary text-sm">No associates found for this organization.</p>
              </div>
            )}

            {/* Regions list */}
            {view.level === "regions" && (
              <div className="space-y-3">
                {regions.map(region => (
                  <button
                    key={region.id}
                    onClick={() => setView({ level: "districts", org: view.org, region })}
                    className="w-full bg-akyra-surface border border-akyra-border rounded-xl p-4 flex items-center justify-between hover:border-white/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-akyra-secondary" />
                      <div className="text-left">
                        <p className="font-semibold text-white">{region.name}</p>
                        <p className="text-xs font-mono text-akyra-secondary">
                          {region.districtCount} districts · {region.storeCount} stores
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-akyra-secondary" />
                  </button>
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
                          const id = await createRegion(view.org.id, newRegionName.trim())
                          if (id) {
                            const updated = await fetchRegionsForOrg(view.org.id)
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
            )}

            {/* Districts list */}
            {view.level === "districts" && (
              <div className="space-y-3">
                {/* All Stores shortcut */}
                <button
                  onClick={() => setView({ level: "stores", org: view.org, region: view.region, district: undefined as any })}
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

      {activeOrgMenu && (
        <OrgRadialMenu
          orgName={activeOrgMenu.org.name}
          position={activeOrgMenu.position}
          onSelect={(dir) => handleOrgMenuSelect(dir, activeOrgMenu.org)}
          onDismiss={() => setActiveOrgMenu(null)}
        />
      )}

      {showWelcomeCode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-akyra-black/90 backdrop-blur-sm p-6" onClick={() => setShowWelcomeCode(null)}>
          <div className="text-center" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-mono text-akyra-secondary mb-4 uppercase tracking-widest">{showWelcomeCode.name}</p>
            <p className="text-4xl font-mono text-white tracking-widest px-8 py-4 border border-white/20 rounded-xl bg-white/5 shadow-[0_0_40px_rgba(255,255,255,0.1)]">
              {showWelcomeCode.phrase}
            </p>
            <p className="text-xs font-mono text-akyra-secondary mt-8 animate-pulse">Tap anywhere to dismiss</p>
          </div>
        </div>
      )}

      {showDangerModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-akyra-black/80 backdrop-blur-sm p-6">
          <div className="w-full max-w-sm bg-akyra-black border border-akyra-red/40 rounded-2xl p-6 shadow-[0_0_60px_rgba(230,57,70,0.15)]">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="w-12 h-12 text-akyra-red" />
            </div>
            <h2 className="text-xl font-bold text-white text-center mb-2">NUCLEAR CASCADE</h2>
            <p className="text-sm text-akyra-secondary text-center mb-6">
              You are about to permanently delete <strong>{showDangerModal.name}</strong>. This will cascade through all regions, districts, stores, profiles, and associated data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDangerModal(null)}
                className="flex-1 py-3 rounded-xl border border-akyra-border text-akyra-secondary font-mono text-sm uppercase tracking-widest hover:bg-white/5 transition-colors"
              >
                Abort
              </button>
              <button
                onClick={() => confirmNuclearDelete(showDangerModal)}
                className="flex-1 py-3 rounded-xl bg-akyra-red text-white font-mono text-sm uppercase tracking-widest hover:bg-akyra-red/80 transition-colors shadow-[0_0_20px_rgba(230,57,70,0.3)]"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {showLicenseModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-akyra-black/80 backdrop-blur-sm p-6" onClick={() => setShowLicenseModal(null)}>
          <div className="w-full max-w-sm bg-akyra-surface border border-akyra-border rounded-2xl p-6" onClick={e => e.stopPropagation()}>
             <div className="flex items-center gap-3 mb-4">
               <Calendar className="w-6 h-6 text-akyra-secondary" />
               <h2 className="text-lg font-bold text-white">Set License</h2>
             </div>
             <p className="text-sm text-akyra-secondary mb-4">Set expiration date for {showLicenseModal.name}</p>
             <input type="date" className="w-full bg-akyra-black border border-akyra-border rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-white mb-6" />
             <div className="flex gap-3">
               <button onClick={() => setShowLicenseModal(null)} className="flex-1 py-3 rounded-xl border border-akyra-border text-akyra-secondary text-sm">Cancel</button>
               <button onClick={() => setShowLicenseModal(null)} className="flex-1 py-3 rounded-xl bg-white text-black font-bold text-sm">Save</button>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}
