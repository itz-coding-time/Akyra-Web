export type PacingStatus = 'NO_TASKS' | 'BEHIND' | 'TRAILING' | 'ON_PACE' | 'AHEAD'

export interface PacingResult {
  status: PacingStatus
  taskPct: number
  timePct: number
  delta: number
}

export function calculatePacingTier(
  completedTasks: number,
  totalTasks: number,
  timeElapsedPct: number
): PacingResult {
  if (totalTasks === 0) {
    return { status: 'NO_TASKS', taskPct: 0, timePct: timeElapsedPct, delta: 0 }
  }

  const taskPct = completedTasks / totalTasks
  const delta = taskPct - timeElapsedPct

  let status: PacingStatus
  if (delta > 0.20) {
    status = 'AHEAD'
  } else if (delta >= 0) {
    status = 'ON_PACE'
  } else if (delta >= -0.20) {
    status = 'TRAILING'
  } else {
    status = 'BEHIND'
  }

  return { status, taskPct, timePct: timeElapsedPct, delta }
}

export function getPacingColor(status: PacingStatus): string {
  switch (status) {
    case 'AHEAD':    return 'text-white'
    case 'ON_PACE':  return 'text-white'
    case 'TRAILING': return 'text-yellow-400'
    case 'BEHIND':   return 'text-akyra-red'
    case 'NO_TASKS': return 'text-akyra-secondary'
  }
}

export function getPacingBorderColor(status: PacingStatus): string {
  switch (status) {
    case 'AHEAD':    return 'border-white/40'
    case 'ON_PACE':  return 'border-white/20'
    case 'TRAILING': return 'border-yellow-400/40'
    case 'BEHIND':   return 'border-akyra-red/60'
    case 'NO_TASKS': return 'border-akyra-border'
  }
}

export function getPacingLabel(status: PacingStatus, delta: number): string {
  const pct = Math.abs(Math.round(delta * 100))
  switch (status) {
    case 'AHEAD':    return `+${pct}% ahead`
    case 'ON_PACE':  return 'On pace'
    case 'TRAILING': return `-${pct}% trailing`
    case 'BEHIND':   return `-${pct}% behind`
    case 'NO_TASKS': return 'No tasks'
  }
}
