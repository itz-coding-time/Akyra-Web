import type { Associate } from "../types"
import { Badge } from "./ui/badge"

interface AssociateCardProps {
  associate: Associate
}

const archetypeColors: Record<string, string> = {
  Float: "border-white/20 text-white",
  Starter: "border-blue-500/40 text-blue-400",
  "Finisher A": "border-purple-500/40 text-purple-400",
  "Finisher B": "border-purple-500/40 text-purple-400",
  MOD: "border-akyra-red/40 text-akyra-red",
}

export function AssociateCard({ associate }: AssociateCardProps) {
  const archetypeStyle = archetypeColors[associate.current_archetype] ?? "border-white/20 text-white"

  return (
    <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4 flex items-center justify-between gap-4 active:scale-[0.98] transition-transform">
      <div className="flex items-center gap-3">
        {/* Avatar initial */}
        <div className="w-10 h-10 rounded-full bg-akyra-border flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-white">
            {associate.name.charAt(0).toUpperCase()}
          </span>
        </div>

        <div>
          <p className="font-semibold text-white">{associate.name}</p>
          <p className="text-xs text-akyra-secondary font-mono uppercase tracking-widest">
            {associate.role}
          </p>
        </div>
      </div>

      <Badge
        variant="outline"
        className={`text-[10px] font-mono uppercase tracking-widest shrink-0 ${archetypeStyle}`}
      >
        {associate.current_archetype}
      </Badge>
    </div>
  )
}
