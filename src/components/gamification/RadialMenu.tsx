import { useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle,
  BookOpen,
  Wrench,
  Flame,
  HelpCircle,
} from "lucide-react"

export interface RadialAction {
  direction: "up" | "down" | "left" | "right" | "up-left" | "left-hold"
  label: string
  icon: React.ReactNode
  color: string
  available: boolean
}

type SelectDirection = RadialAction["direction"]

interface RadialMenuProps {
  taskName: string
  position: { x: number; y: number }
  hasBurnCard: boolean
  onSelect: (direction: SelectDirection) => void
  onDismiss: () => void
}

export function RadialMenu({
  taskName,
  position,
  hasBurnCard,
  onSelect,
  onDismiss,
}: RadialMenuProps) {
  const [upTapCount, setUpTapCount] = useState(0)
  const upTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [leftHolding, setLeftHolding] = useState(false)
  const leftHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleLeftStart() {
    setLeftHolding(false)
    leftHoldTimer.current = setTimeout(() => {
      setLeftHolding(true)
      onSelect("left-hold")
    }, 1500)
  }

  function handleLeftEnd() {
    if (leftHoldTimer.current) clearTimeout(leftHoldTimer.current)
    if (!leftHolding) {
      onSelect("left")
      onDismiss()
    }
    setLeftHolding(false)
  }

  const actions: RadialAction[] = [
    {
      direction: "up",
      label: upTapCount === 1 ? "DANGER" : "Assistance",
      icon: upTapCount === 1
        ? <AlertTriangle className="w-5 h-5" />
        : <HelpCircle className="w-5 h-5" />,
      color: upTapCount === 1 ? "bg-[#E63946] text-white" : "bg-white/10 text-white",
      available: true,
    },
    {
      direction: "left",
      label: leftHolding ? "OFFER" : "Complete",
      icon: <CheckCircle className="w-5 h-5" />,
      color: "bg-white/10 text-white",
      available: true,
    },
    {
      direction: "right",
      label: "SOP",
      icon: <BookOpen className="w-5 h-5" />,
      color: "bg-white/10 text-white",
      available: true,
    },
    {
      direction: "down",
      label: "Report",
      icon: <Wrench className="w-5 h-5" />,
      color: "bg-white/10 text-white",
      available: true,
    },
    {
      direction: "up-left",
      label: "Burn",
      icon: <Flame className="w-5 h-5" />,
      color: hasBurnCard ? "bg-[#E63946]/20 text-[#E63946] border border-[#E63946]/40" : "bg-white/5 text-white/20",
      available: hasBurnCard,
    },
  ]

  function handleActionTap(action: RadialAction) {
    if (!action.available) return

    if (action.direction === "up") {
      if (upTapCount === 0) {
        setUpTapCount(1)
        upTapTimer.current = setTimeout(() => {
          // First tap expires — treat as assistance
          onSelect("up")
          onDismiss()
        }, 1500)
      } else if (upTapCount === 1) {
        if (upTapTimer.current) clearTimeout(upTapTimer.current)
        // Double tap — danger
        onSelect("up")
        onDismiss()
      }
      return
    }

    onSelect(action.direction)
    onDismiss()
  }

  // Backdrop tap dismisses
  useEffect(() => {
    const handler = (_e: TouchEvent | MouseEvent) => {
      onDismiss()
    }
    document.addEventListener("touchstart", handler, { passive: true })
    document.addEventListener("mousedown", handler)
    return () => {
      document.removeEventListener("touchstart", handler)
      document.removeEventListener("mousedown", handler)
    }
  }, [onDismiss])

  const RADIUS = 72
  const positions: Record<RadialAction["direction"], { x: number; y: number }> = {
    "up":        { x: 0,        y: -RADIUS },
    "left":      { x: -RADIUS,  y: 0 },
    "right":     { x: RADIUS,   y: 0 },
    "down":      { x: 0,        y: RADIUS },
    "up-left":   { x: -RADIUS * 0.7, y: -RADIUS * 0.7 },
    "left-hold": { x: -RADIUS,  y: 0 },
  }

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ touchAction: "none" }}
      onClick={onDismiss}
    >
      {/* Backdrop blur */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Task name label */}
      <div
        className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
        style={{ left: position.x, top: position.y - 90 }}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-xs font-mono text-white/60 text-center max-w-[160px] truncate">
          {taskName}
        </p>
        {upTapCount === 1 && (
          <p className="text-[10px] font-mono text-[#E63946] text-center mt-1 animate-pulse">
            Tap again for DANGER
          </p>
        )}
      </div>

      {/* Center dot */}
      <div
        className="absolute w-3 h-3 rounded-full bg-white/40 transform -translate-x-1/2 -translate-y-1/2 z-10"
        style={{ left: position.x, top: position.y }}
      />

      {/* Action buttons */}
      {actions.map(action => {
        const pos = positions[action.direction]
        const isLeft = action.direction === "left"
        return (
          <button
            key={action.direction}
            className={`absolute w-14 h-14 rounded-full flex flex-col items-center justify-center gap-1 transform -translate-x-1/2 -translate-y-1/2 z-10 transition-all ${action.color} ${
              !action.available ? "opacity-30 cursor-not-allowed" : "active:scale-90"
            }`}
            style={{
              left: position.x + pos.x,
              top: position.y + pos.y,
            }}
            onClick={e => {
              e.stopPropagation()
              if (!isLeft) handleActionTap(action)
            }}
            onTouchStart={isLeft ? e => { e.stopPropagation(); handleLeftStart() } : undefined}
            onTouchEnd={isLeft ? e => { e.stopPropagation(); handleLeftEnd() } : undefined}
          >
            {action.icon}
            <span className="text-[8px] font-mono uppercase tracking-wider leading-none">
              {action.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
