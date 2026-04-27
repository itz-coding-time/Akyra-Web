import { AkyraLogo } from "./AkyraLogo"

interface UpdateOverlayProps {
  newVersion: string
}

export function UpdateOverlay({ newVersion }: UpdateOverlayProps) {
  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center gap-6">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-[50%] h-[50%] bg-white/[0.015] blur-[150px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[40%] h-[40%] bg-[#E63946]/[0.04] blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 text-center space-y-4">
        <AkyraLogo className="w-12 h-12 mx-auto animate-pulse" />

        <div className="space-y-1">
          <p className="text-white font-black text-lg tracking-tight">
            Updating Akyra
          </p>
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/30">
            Version {newVersion}
          </p>
        </div>

        <p className="text-xs text-white/40 font-mono">
          Clearing cache — your sign-in is safe
        </p>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pt-2">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
