import { useState } from "react"
import { X, RefreshCw, Eye, EyeOff } from "lucide-react"
import { LoadingSpinner } from "./LoadingSpinner"
import { resetAssociatePassword, generateTempPassword } from "../lib"

interface PasswordResetModalProps {
  associateName: string
  authUid: string
  onDone: () => void
  onDismiss: () => void
}

export function PasswordResetModal({
  associateName,
  authUid,
  onDone,
  onDismiss,
}: PasswordResetModalProps) {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleGenerate() {
    setPassword(generateTempPassword())
    setShowPassword(true)
  }

  async function handleReset() {
    if (!password || password.length < 8) return
    setIsResetting(true)
    setError(null)

    const success = await resetAssociatePassword(authUid, password)
    setIsResetting(false)

    if (success) {
      setDone(true)
    } else {
      setError("Reset failed. The associate may not have a registered account yet.")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onDismiss} />
      <div className="relative w-full max-w-lg bg-akyra-surface border-t border-akyra-border rounded-t-2xl p-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-white">Reset Password</p>
            <p className="text-xs text-akyra-secondary font-mono">{associateName}</p>
          </div>
          <button onClick={onDismiss} className="text-akyra-secondary hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="space-y-4 text-center">
            <p className="text-white font-semibold">✓ Password reset</p>
            <div className="bg-akyra-black border border-akyra-border rounded-xl p-4">
              <p className="text-[10px] font-mono text-akyra-secondary mb-1">
                Temporary password — share with associate:
              </p>
              <p className="text-2xl font-black font-mono text-white tracking-widest">
                {password}
              </p>
            </div>
            <p className="text-xs text-akyra-secondary">
              Tell them to change it after signing in.
            </p>
            <button
              onClick={onDone}
              className="w-full py-3 rounded-xl bg-white text-black font-bold"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-akyra-secondary">
              Generate a temporary password or enter one manually. Share it with the associate verbally.
            </p>

            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="New password (min 8 chars)"
                    className="w-full bg-akyra-black border border-akyra-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white pr-10"
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-akyra-secondary hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={handleGenerate}
                  className="flex items-center gap-2 border border-akyra-border rounded-xl px-3 text-akyra-secondary hover:text-white hover:border-white/40 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {error && <p className="text-akyra-red text-sm font-mono">{error}</p>}

            <button
              onClick={handleReset}
              disabled={password.length < 8 || isResetting}
              className="w-full py-3 rounded-xl bg-white text-black font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isResetting ? <><LoadingSpinner size="sm" /> Resetting...</> : "Reset Password"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
