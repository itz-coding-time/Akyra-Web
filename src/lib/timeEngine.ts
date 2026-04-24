// TimeEngine — port of Android TimeUtils.kt
// Handles overnight shifts correctly (e.g. 22:00–06:30 crosses midnight)

function parseTimeToMins(timeStr: string): number {
  const parts = timeStr.split(":")
  if (parts.length !== 2) throw new Error(`Invalid time format: ${timeStr}`)
  return parseInt(parts[0]) * 60 + parseInt(parts[1])
}

/**
 * Returns a decimal 0.0–1.0 representing how far through the shift we are.
 * Handles midnight-crossing shifts correctly.
 */
export function calculateShiftProgress(
  startTimeStr: string,
  endTimeStr: string,
  nowMs: number = Date.now()
): number {
  try {
    const startMins = parseTimeToMins(startTimeStr)
    const originalEndMins = parseTimeToMins(endTimeStr)
    let endMins = originalEndMins

    const now = new Date(nowMs)
    let currentMins = now.getHours() * 60 + now.getMinutes()

    const crossesMidnight = originalEndMins <= startMins

    if (crossesMidnight) {
      endMins += 24 * 60
      if (currentMins <= originalEndMins) {
        currentMins += 24 * 60
      } else if (currentMins >= startMins) {
        // within the pre-midnight portion, no adjustment needed
      } else {
        // between end+1h and start — not on shift
        return currentMins < startMins && currentMins > originalEndMins + 60 ? 0 : 1
      }
    }

    if (currentMins < startMins) return 0
    if (currentMins > endMins) return 1

    const totalDuration = endMins - startMins
    const elapsed = currentMins - startMins

    return Math.min(Math.max(elapsed / totalDuration, 0), 1)
  } catch {
    return 0
  }
}

/**
 * Returns true if the associate is currently on the clock.
 * Handles midnight-crossing shifts correctly.
 */
export function isAssociateOnClock(
  startTimeStr: string,
  endTimeStr: string,
  nowMs: number = Date.now()
): boolean {
  try {
    const startMins = parseTimeToMins(startTimeStr)
    const originalEndMins = parseTimeToMins(endTimeStr)
    let endMins = originalEndMins

    const now = new Date(nowMs)
    let currentMins = now.getHours() * 60 + now.getMinutes()

    const crossesMidnight = originalEndMins <= startMins
    if (crossesMidnight) {
      endMins += 24 * 60
      if (currentMins <= originalEndMins) {
        currentMins += 24 * 60
      }
    }

    return currentMins >= startMins && currentMins <= endMins
  } catch {
    return true // Default to on-clock if parsing fails
  }
}

/**
 * Formats elapsed time as a human-readable string e.g. "3h 20m"
 */
export function formatElapsedTime(startTimeStr: string, nowMs: number = Date.now()): string {
  try {
    const startMins = parseTimeToMins(startTimeStr)
    const now = new Date(nowMs)
    let currentMins = now.getHours() * 60 + now.getMinutes()

    if (currentMins < startMins) currentMins += 24 * 60

    const elapsed = currentMins - startMins
    if (elapsed < 0) return "0m"

    const hours = Math.floor(elapsed / 60)
    const mins = elapsed % 60

    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
  } catch {
    return "—"
  }
}
