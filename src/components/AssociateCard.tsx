import { Badge } from "./ui/badge"
import { useAuth } from "../context"
import { getRoleDisplayName } from "../lib"

interface AssociateCardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  associate: any
}

const archetypeColors: Record<string, string> = {
  Float: "border-white/20 text-white",
  Starter: "border-blue-500/40 text-blue-400",
  "Finisher A": "border-purple-500/40 text-purple-400",
  "Finisher B": "border-purple-500/40 text-purple-400",
  MOD: "border-akyra-red/40 text-akyra-red",
}

function getRegistrationStatus(associate: any): "registered" | "pending" | "unregistered" {
  const profile = associate.profiles
  if (!profile) return "unregistered"
  if (!profile.auth_uid) return "pending"
  return "registered"
}

const statusDot: Record<"registered" | "pending" | "unregistered", string> = {
  registered: "bg-white",
  pending: "bg-yellow-400",
  unregistered: "bg-akyra-red",
}

export function AssociateCard({ associate }: AssociateCardProps) {
  const { orgBranding } = useAuth()
  const archetypeStyle = archetypeColors[associate.current_archetype] ?? "border-white/20 text-white"
  const regStatus = getRegistrationStatus(associate)

  return (
    <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4 flex items-center justify-between gap-4 active:scale-[0.98] transition-transform">
      <div className="flex items-center gap-3">
        {/* Avatar initial with registration dot */}
        <div className="relative w-10 h-10 shrink-0">
          <div className="w-10 h-10 rounded-full bg-akyra-border flex items-center justify-center">
            <span className="text-sm font-bold text-white">
              {associate.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <span
            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-akyra-surface ${statusDot[regStatus]}`}
          />
        </div>

        <div>
          <p className="font-semibold text-white">{associate.name}</p>
          <p className="text-xs text-akyra-secondary font-mono uppercase tracking-widest">
            {getRoleDisplayName(associate.role, orgBranding)}
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
