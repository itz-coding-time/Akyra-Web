export interface TierBadgeProps {
  tier: string
  isPredator?: boolean
  size?: "sm" | "md" | "lg"
  showPoints?: boolean
  points?: number
}

const TIER_CONFIG = {
  Predator: {
    emoji: "🔱",
    label: "Predator",
    border: "border-yellow-500/50",
    text: "text-yellow-400",
    bg: "bg-yellow-500/10",
  },
  Master: {
    emoji: "⚔️",
    label: "Master",
    border: "border-purple-500/40",
    text: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  Diamond: {
    emoji: "💠",
    label: "Diamond",
    border: "border-blue-400/40",
    text: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  Platinum: {
    emoji: "🏅",
    label: "Platinum",
    border: "border-white/10",
    text: "text-white/40",
    bg: "bg-white/[0.03]",
  },
}

export function TierBadge({
  tier,
  isPredator = false,
  size = "sm",
  showPoints = false,
  points = 0,
}: TierBadgeProps) {
  const config = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.Platinum
  const displayConfig = isPredator ? TIER_CONFIG.Predator : config

  const sizeClasses = {
    sm: "text-[9px] px-2 py-0.5",
    md: "text-[11px] px-3 py-1",
    lg: "text-sm px-4 py-1.5",
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className={`font-mono uppercase tracking-widest rounded border ${displayConfig.bg} ${displayConfig.border} ${displayConfig.text} ${sizeClasses[size]} flex items-center gap-1`}>
        <span>{displayConfig.emoji}</span>
        <span>{displayConfig.label}</span>
      </span>
      {showPoints && (
        <span className="text-[9px] font-mono text-white/30">
          {points} pts
        </span>
      )}
    </div>
  )
}
