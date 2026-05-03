import { useState } from "react"
import { Shield, X } from "lucide-react"
import {
  lookupRespawnPin,
  authorizeRespawn,
  arrowsToPin,
  fetchAssociatesByStore,
} from "../lib"
import { LoadingSpinner } from "./LoadingSpinner"

interface RespawnAuthorizationPanelProps {
  supervisorAssociateId: string
  storeId: string
  onDismiss: () => void
}

type AuthPhase =
  | "enter-stratagem"
  | "confirm-identity"
  | "roster-picker"    // fallback if profile not found
  | "confirm-you"
  | "reinforcing"
  | "done"
  | "error"

import { Arrow } from "../lib"

const ARROW_MAP: Record<string, Arrow> = {
  "↑": "up",
  "↓": "down",
  "←": "left",
  "→": "right",
}

export function RespawnAuthorizationPanel({
  supervisorAssociateId,
  storeId,
  onDismiss,
}: RespawnAuthorizationPanelProps) {
  const [phase, setPhase] = useState<AuthPhase>("enter-stratagem")
  const [enteredArrows, setEnteredArrows] = useState<string[]>([])
  const [associateInfo, setAssociateInfo] = useState<any>(null)
  const [rosterAssociates, setRosterAssociates] = useState<any[]>([])
  const [selectedAssociate, setSelectedAssociate] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleArrowTap(arrow: string) {
    if (enteredArrows.length >= 4) return
    setEnteredArrows(prev => [...prev, arrow])
  }

  function handleClear() {
    setEnteredArrows([])
    setError(null)
  }

  async function handleLookup() {
    if (enteredArrows.length !== 4) return
    setIsLoading(true)
    setError(null)

    const arrows = enteredArrows.map(a => ARROW_MAP[a])
    const pin = arrowsToPin(arrows)
    const result = await lookupRespawnPin(storeId, pin)
    setIsLoading(false)

    if (!result) {
      setError("Stratagem not recognized or expired. Ask them to generate a new one.")
      setEnteredArrows([])
      return
    }

    setAssociateInfo(result)
    setPhase("confirm-identity")
  }

  async function handleLoadRoster() {
    setIsLoading(true)
    const associates = await fetchAssociatesByStore(storeId)
    setRosterAssociates(associates)
    setIsLoading(false)
    setPhase("roster-picker")
  }

  async function handleAuthorize() {
    setPhase("confirm-you")
  }

  async function handleBiometricConfirm() {
    setIsLoading(true)

    const arrows = enteredArrows.map(a => ARROW_MAP[a])
    const pin = arrowsToPin(arrows)
    const success = await authorizeRespawn(storeId, associateInfo?.associateId || "", supervisorAssociateId, pin)

    setIsLoading(false)

    if (success) {
      setPhase("reinforcing")
      setTimeout(() => setPhase("done"), 2000)
    } else {
      setError("Authorization failed. The stratagem may have expired.")
      setPhase("error")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onDismiss} />
      <div className="relative w-full max-w-lg bg-[#0a0a0a] border-t border-white/10 rounded-t-2xl p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-white/40" />
            <p className="font-bold text-white text-sm">
              {phase === "enter-stratagem" && "Reinforcement Incoming"}
              {phase === "confirm-identity" && "Who Needs Reinforcement?"}
              {phase === "roster-picker" && "Select Associate"}
              {phase === "confirm-you" && "Confirm You Are You"}
              {phase === "reinforcing" && "Reinforcing"}
              {phase === "done" && "Reinforcement Complete"}
              {phase === "error" && "Authorization Failed"}
            </p>
          </div>
          <button onClick={onDismiss} className="text-white/20 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── ENTER STRATAGEM ── */}
        {phase === "enter-stratagem" && (
          <div className="space-y-5">
            <p className="text-sm text-white/40">
              One associate needs to be called back in. Enter their Stratagem.
            </p>

            {/* Arrow display */}
            <div className="flex items-center justify-center gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all ${
                    enteredArrows[i]
                      ? "border-white/40 bg-white/10"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <span className="text-2xl text-white">
                    {enteredArrows[i] ?? ""}
                  </span>
                </div>
              ))}
            </div>

            {/* Arrow buttons */}
            <div className="grid grid-cols-4 gap-2">
              {Object.keys(ARROW_MAP).map(arrow => (
                <button
                  key={arrow}
                  onClick={() => handleArrowTap(arrow)}
                  disabled={enteredArrows.length >= 4}
                  className="h-12 rounded-xl border border-white/20 bg-white/[0.04] text-white text-xl font-bold hover:bg-white/10 hover:border-white/40 transition-all disabled:opacity-30 active:scale-95"
                >
                  {arrow}
                </button>
              ))}
            </div>

            {error && (
              <p className="text-[#E63946] text-xs font-mono text-center">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleClear}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm"
              >
                Clear
              </button>
              <button
                onClick={handleLookup}
                disabled={enteredArrows.length !== 4 || isLoading}
                className="flex-1 py-2.5 rounded-xl bg-white text-black font-bold text-sm disabled:opacity-30 flex items-center justify-center gap-2"
              >
                {isLoading ? <><LoadingSpinner size="sm" /> Looking up...</> : "Confirm →"}
              </button>
            </div>
          </div>
        )}

        {/* ── CONFIRM IDENTITY ── */}
        {phase === "confirm-identity" && associateInfo && (
          <div className="space-y-4">
            <p className="text-sm text-white/40">
              Is this the person standing in front of you?
            </p>

            <div className="bg-white/[0.04] border border-white/15 rounded-2xl p-5 text-center space-y-1">
              <p className="text-2xl font-black text-white">{associateInfo.associateName}</p>
              <p className="text-sm font-mono text-white/30">
                EEID {associateInfo.associateEeid} · {associateInfo.associateRole}
              </p>
            </div>

            <p className="text-[10px] font-mono text-white/20 text-center">
              Make sure this person is physically standing in front of you.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPhase("enter-stratagem")
                  setEnteredArrows([])
                }}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm"
              >
                Wrong person
              </button>
              <button
                onClick={handleAuthorize}
                className="flex-1 py-2.5 rounded-xl bg-white text-black font-bold text-sm"
              >
                That's them →
              </button>
            </div>

            <button
              onClick={handleLoadRoster}
              disabled={isLoading}
              className="w-full text-[10px] font-mono text-white/15 hover:text-white/30 transition-colors"
            >
              Can't find their account? Pick from roster →
            </button>
          </div>
        )}

        {/* ── ROSTER PICKER (fallback) ── */}
        {phase === "roster-picker" && (
          <div className="space-y-3">
            <p className="text-sm text-white/40">
              Select the associate standing in front of you.
            </p>

            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {rosterAssociates.map(a => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAssociate(a)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between ${
                    selectedAssociate?.id === a.id
                      ? "border-white/40 bg-white/10 text-white"
                      : "border-white/10 text-white/40 hover:text-white hover:border-white/20"
                  }`}
                >
                  <span className="text-sm font-semibold">{a.name}</span>
                  <span className="text-[10px] font-mono opacity-50">{a.role}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                if (selectedAssociate) {
                  setAssociateInfo({
                    associateName: selectedAssociate.name,
                    associateEeid: selectedAssociate.eeid ?? "—",
                    associateRole: selectedAssociate.role,
                  })
                  setPhase("confirm-you")
                }
              }}
              disabled={!selectedAssociate}
              className="w-full py-3 rounded-xl bg-white text-black font-bold text-sm disabled:opacity-30"
            >
              Confirm Selection →
            </button>
          </div>
        )}

        {/* ── CONFIRM YOU ARE YOU ── */}
        {phase === "confirm-you" && (
          <div className="space-y-5 text-center">
            <div className="space-y-1">
              <p className="text-sm text-white/40">
                Your biometric is required to authorize this reinforcement.
              </p>
              {associateInfo && (
                <p className="text-[10px] font-mono text-white/20">
                  Reinforcing: {associateInfo.associateName}
                </p>
              )}
            </div>

            <div className="w-16 h-16 rounded-full bg-white/[0.05] border border-white/15 flex items-center justify-center mx-auto">
              <Shield className="w-7 h-7 text-white/40" />
            </div>

            {error && <p className="text-[#E63946] text-sm font-mono">{error}</p>}

            <button
              onClick={handleBiometricConfirm}
              disabled={isLoading}
              className="w-full py-4 rounded-2xl bg-white text-black font-black text-lg disabled:opacity-30 flex items-center justify-center gap-2"
            >
              {isLoading
                ? <><LoadingSpinner size="sm" /> Confirming...</>
                : <><Shield className="w-5 h-5" /> Authenticate</>
              }
            </button>
          </div>
        )}

        {/* ── REINFORCING ── */}
        {phase === "reinforcing" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <LoadingSpinner size="md" />
            <div>
              <p className="text-white font-black text-xl animate-pulse">REINFORCING!</p>
              <p className="text-xs font-mono text-white/30 mt-1">
                Authorization sent. Standby for drop.
              </p>
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {phase === "done" && (
          <div className="text-center space-y-4 py-4">
            <p className="text-2xl text-green-400">✓</p>
            <p className="text-white font-bold">Reinforcement authorized.</p>
            <p className="text-sm text-white/40">
              They're resetting their credentials now.
            </p>
            <button
              onClick={onDismiss}
              className="w-full py-3 rounded-xl border border-white/15 text-white text-sm"
            >
              Done
            </button>
          </div>
        )}

        {/* ── ERROR ── */}
        {phase === "error" && (
          <div className="text-center space-y-4 py-4">
            <p className="text-[#E63946] font-bold">Authorization Failed</p>
            <p className="text-sm text-white/40">{error}</p>
            <button
              onClick={() => { setPhase("enter-stratagem"); setEnteredArrows([]) }}
              className="w-full py-3 rounded-xl border border-white/15 text-white text-sm"
            >
              Try Again
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
