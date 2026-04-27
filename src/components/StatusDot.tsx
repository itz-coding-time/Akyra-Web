import { cn } from "../lib/utils"

interface StatusDotProps {
  status: "active" | "inactive" | "warning" | "error"
  className?: string
}

export function StatusDot({ status, className }: StatusDotProps) {
  const colors = {
    active: "bg-white animate-pulse",
    inactive: "bg-white/20",
    warning: "bg-yellow-500 animate-pulse",
    error: "bg-akyra-red animate-pulse-red",
  }

  return (
    <div
      className={cn(
        "w-2 h-2 rounded-full",
        colors[status],
        className
      )}
    />
  )
}
