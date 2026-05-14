import { useEffect, useRef, useState } from "react"
import { Key, Users, Calendar, Trash2 } from "lucide-react"

export type OrgRadialActionDirection = "up" | "down" | "left-hold" | "right" | "left"

export interface OrgRadialAction {
  direction: OrgRadialActionDirection
  label: string
  icon: React.ReactNode
  color: string
  available: boolean
}

interface OrgRadialMenuProps {
  orgName: string
  position: { x: number; y: number }
  onSelect: (direction: OrgRadialActionDirection) => void
  onDismiss: () => void
}

export function OrgRadialMenu({
  orgName,
  position,
  onSelect,
  onDismiss,
}: OrgRadialMenuProps) {
  const [leftHolding, setLeftHolding] = useState(false)
  const leftHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleLeftStart() {
    setLeftHolding(false)
    leftHoldTimer.current = setTimeout(() => {
      setLeftHolding(true)
      onSelect("left-hold")
      onDismiss()
    }, 1500)
  }

  function handleLeftEnd() {
    if (leftHoldTimer.current) clearTimeout(leftHoldTimer.current)
    if (!leftHolding) {
      // Just a short tap on left, nothing happens or we can dismiss
      onDismiss()
    }
    setLeftHolding(false)
  }

  const actions: OrgRadialAction[] = [
    {
      direction: "up",
      label: "Code",
      icon: <Key className="w-5 h-5" />,
      color: "bg-white/10 text-white",
      available: true,
    },
    {
      direction: "left",
      label: leftHolding ? "NUKE" : "Delete",
      icon: <Trash2 className="w-5 h-5" />,
      color: leftHolding ? "bg-[#E63946] text-white" : "bg-white/10 text-[#E63946]",
      available: true,
    },
    {
      direction: "right",
      label: "License",
      icon: <Calendar className="w-5 h-5" />,
      color: "bg-white/10 text-white",
      available: true,
    },
    {
      direction: "down",
      label: "Associates",
      icon: <Users className="w-5 h-5" />,
      color: "bg-white/10 text-white",
      available: true,
    },
  ]

  function handleActionTap(action: OrgRadialAction) {
    if (!action.available) return
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

    // Lock body scroll to prevent PWA pull-to-refresh
    const originalOverscroll = document.body.style.overscrollBehavior
    const originalOverflow = document.body.style.overflow
    const originalTouchAction = document.body.style.touchAction

    document.body.style.overscrollBehavior = "none"
    document.body.style.overflow = "hidden"
    document.body.style.touchAction = "none"

    return () => {
      document.removeEventListener("touchstart", handler)
      document.removeEventListener("mousedown", handler)

      // Restore body scroll
      document.body.style.overscrollBehavior = originalOverscroll
      document.body.style.overflow = originalOverflow
      document.body.style.touchAction = originalTouchAction
    }
  }, [onDismiss])

  const RADIUS = 72
  const positions: Record<OrgRadialAction["direction"], { x: number; y: number }> = {
    "up":        { x: 0,        y: -RADIUS },
    "left":      { x: -RADIUS,  y: 0 },
    "right":     { x: RADIUS,   y: 0 },
    "down":      { x: 0,        y: RADIUS },
    "left-hold": { x: -RADIUS,  y: 0 },
  }

  return (
    <div
      className="fixed inset-0 z-50 font-mono"
      style={{ touchAction: "none" }}
      onClick={onDismiss}
    >
      {/* Backdrop blur */}
      <div className="absolute inset-0 bg-akyra-black/80 backdrop-blur-sm" />

      {/* Task name label */}
      <div
        className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
        style={{ left: position.x, top: position.y - 90 }}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-xs text-white/60 text-center max-w-[160px] truncate">
          {orgName}
        </p>
      </div>

      {/* Center dot */}
      <div
        className="absolute w-3 h-3 rounded-full bg-akyra-secondary/40 transform -translate-x-1/2 -translate-y-1/2 z-10"
        style={{ left: position.x, top: position.y }}
      />

      {/* Action buttons */}
      {actions.map(action => {
        if (action.direction === "left-hold") return null; // rendered as 'left'
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
            onMouseDown={isLeft ? e => { e.stopPropagation(); handleLeftStart() } : undefined}
            onMouseUp={isLeft ? e => { e.stopPropagation(); handleLeftEnd() } : undefined}
            onMouseLeave={isLeft ? e => { e.stopPropagation(); handleLeftEnd() } : undefined}
            onTouchStart={e => {
              e.stopPropagation()
              if (isLeft) handleLeftStart()
            }}
            onTouchEnd={e => {
              e.stopPropagation()
              e.preventDefault()
              if (isLeft) {
                handleLeftEnd()
              } else {
                handleActionTap(action)
              }
            }}
            onTouchCancel={e => {
              e.stopPropagation()
              if (isLeft) handleLeftEnd()
            }}
          >
            {action.icon}
            <span className="text-[8px] uppercase tracking-wider leading-none">
              {action.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
