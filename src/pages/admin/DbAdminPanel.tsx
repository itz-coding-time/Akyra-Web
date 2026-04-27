import { useEffect, useState } from "react"
import {
  fetchAllOrgs,
  fetchStoresForOrg,
  fetchProfilesForStore,
  updateProfileRole,
  getRoleDisplayName,
  type OrgSummary,
  type StoreSummary,
} from "../../lib"
import { NewOrgFlow } from "./NewOrgFlow"
import { StoreSetupWizard } from "./StoreSetupWizard"
import { OrgIdentityEditor } from "./OrgIdentityEditor"
import { StationManager } from "./StationManager"
import { RoleDisplayNameEditor } from "./RoleDisplayNameEditor"
import { ReportAliasManager } from "./ReportAliasManager"
import { LoadingSpinner } from "../../components/LoadingSpinner"
import { AkyraLogo } from "../../components/AkyraLogo"
import { useAuth } from "../../context"
import { useNavigate } from "react-router-dom"
import { ChevronRight, Building2, Users } from "lucide-react"
import { Store } from "lucide-react"
import type { Profile } from "../../types"

const ROLE_OPTIONS = [
  { role: "crew",              rank: 1, label: "Crew" },
  { role: "supervisor",        rank: 2, label: "Supervisor" },
  { role: "assistant_manager", rank: 3, label: "Assistant Manager" },
  { role: "store_manager",     rank: 4, label: "Store Manager" },
  { role: "district_admin",    rank: 5, label: "District Admin" },
  { role: "org_admin",         rank: 6, label: "Org Admin" },
  { role: "db_admin",          rank: 7, label: "DB Admin" },
]

type AdminView =
  | { level: "orgs" }
  | { level: "stores"; org: OrgSummary }
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

  useEffect(() => {
    setIsLoading(true)
    if (view.level === "orgs") {
      fetchAllOrgs().then(data => { setOrgs(data); setIsLoading(false) })
    } else if (view.level === "stores") {
      fetchStoresForOrg(view.org.id).then(data => { setStores(data); setIsLoading(false) })
    } else if (view.level === "profiles") {
      fetchProfilesForStore(view.store.id).then(data => { setProfiles(data); setIsLoading(false) })
    }
  }, [view])

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
      <div className="flex items-center gap-2 px-6 py-3 border-b border-akyra-border justify-between">
        <button
          onClick={() => setView({ level: "orgs" })}
          className={`text-xs font-mono ${view.level === "orgs" ? "text-white" : "text-akyra-secondary hover:text-white"} transition-colors`}
        >
          Organizations
        </button>
        {view.level !== "orgs" && (
          <>
            <ChevronRight className="w-3 h-3 text-akyra-secondary" />
            <button
              onClick={() => view.level === "profiles" && setView({ level: "stores", org: view.org })}
              className={`text-xs font-mono ${view.level === "stores" ? "text-white" : "text-akyra-secondary hover:text-white"} transition-colors`}
            >
              {view.org.name}
            </button>
          </>
        )}
        {view.level === "profiles" && (
          <>
            <ChevronRight className="w-3 h-3 text-akyra-secondary" />
            <span className="text-xs font-mono text-white">
              Store {view.store.storeNumber}
            </span>
          </>
        )}
        {view.level === "orgs" && (
          <button
            onClick={() => setShowNewOrg(true)}
            className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white border border-akyra-border rounded-lg px-3 py-2 hover:border-white/40 transition-colors"
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
                onClick={() => setView({ level: "stores", org })}
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
                  <ChevronRight className="w-4 h-4 text-akyra-secondary" />
                </div>
              </div>
            ))}

            {/* Stores list */}
            {view.level === "stores" && stores.map(store => (
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
    </div>
  )
}
