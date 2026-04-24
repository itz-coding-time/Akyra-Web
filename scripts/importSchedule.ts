import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"
import Papa from "papaparse"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const STORE_ID = '00000000-0000-0000-0000-000000000002'

// UKG Primary Job → Akyra role mapping
const JOB_TO_ROLE: Record<string, string> = {
  MOD:     'store_manager',
  KAM:     'assistant_manager',
  HAM:     'assistant_manager',
  SPV:     'supervisor',
  SPVFLEX: 'supervisor',
  STMEM:   'crew',
  STMEMFT: 'crew',
}

interface UKGRow {
  Employee: string
  Primary_Job: string
  Day: string
  Time_Range: string
  Date: string
  Start_Time: string
  End_Time: string
  EEID: string
}

interface ShiftSegment {
  eeid: string
  name: string
  date: string
  startMins: number
  endMins: number
  crossesMidnight: boolean
}

interface MergedShift {
  eeid: string
  name: string
  date: string
  startTime: string
  endTime: string
}

// Convert "9:00 PM" or "9:00 AM" to minutes since midnight
function parseTimeToMins(timeStr: string): number {
  const cleaned = timeStr.trim()
  const [time, meridiem] = cleaned.split(' ')
  const [hoursStr, minsStr] = time.split(':')
  let hours = parseInt(hoursStr)
  const mins = parseInt(minsStr)
  if (meridiem === 'PM' && hours !== 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0
  return hours * 60 + mins
}

// Convert minutes since midnight back to "HH:MM" 24h format
function minsToTimeStr(mins: number): string {
  const normalized = ((mins % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(normalized / 60).toString().padStart(2, '0')
  const m = (normalized % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

// UKG Scrub: merge segments with <= 60 minute gaps
function mergeShiftSegments(segments: ShiftSegment[]): MergedShift[] {
  if (segments.length === 0) return []

  // Sort by start time
  const sorted = [...segments].sort((a, b) => a.startMins - b.startMins)
  const merged: MergedShift[] = []

  let current = sorted[0]
  let currentEnd = current.endMins + (current.crossesMidnight ? 24 * 60 : 0)

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]
    const nextStart = next.startMins
    const nextEnd = next.endMins + (next.crossesMidnight ? 24 * 60 : 0)

    const gap = nextStart - (currentEnd % (24 * 60))
    const adjustedGap = gap < -12 * 60 ? gap + 24 * 60 : gap // handle midnight wrap

    if (adjustedGap <= 60) {
      // Merge: extend current shift
      currentEnd = Math.max(currentEnd, nextEnd + (nextStart < current.startMins ? 24 * 60 : 0))
    } else {
      // Gap too large — push current and start new
      merged.push({
        eeid: current.eeid,
        name: current.name,
        date: current.date,
        startTime: minsToTimeStr(current.startMins),
        endTime: minsToTimeStr(currentEnd),
      })
      current = next
      currentEnd = nextEnd
    }
  }

  // Push the last segment
  merged.push({
    eeid: current.eeid,
    name: current.name,
    date: current.date,
    startTime: minsToTimeStr(current.startMins),
    endTime: minsToTimeStr(currentEnd),
  })

  return merged
}

// Cache of EEID → name from CSV parsing
const eeidToName: Map<string, string> = new Map()

async function getNameByEeid(eeid: string): Promise<string> {
  return eeidToName.get(eeid) ?? ''
}

async function getAssociateIdByEeid(eeid: string): Promise<string | null> {
  const { data } = await supabase
    .from('associates')
    .select('id')
    .eq('store_id', STORE_ID)
    .eq('name', await getNameByEeid(eeid))
    .maybeSingle()
  return data?.id ?? null
}

async function getAssociateIdByName(name: string): Promise<string | null> {
  const { data } = await supabase
    .from('associates')
    .select('id')
    .eq('store_id', STORE_ID)
    .ilike('name', `%${name.split(',')[0].trim()}%`)
    .maybeSingle()
  return data?.id ?? null
}

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error('Usage: npx tsx --env-file=.env.local scripts/importSchedule.ts <path-to-csv>')
    process.exit(1)
  }

  const csvContent = fs.readFileSync(path.resolve(csvPath), 'utf-8')

  const { data: rows } = Papa.parse<UKGRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().replace(/\s+/g, '_'),
  })

  console.log(`\n📅 Akyra Schedule Importer\n`)
  console.log(`Read ${rows.length} rows from CSV\n`)

  // Group by EEID + Date
  const grouped = new Map<string, ShiftSegment[]>()
  let skipped = 0
  let noEeid = 0

  for (const row of rows) {
    const eeid = row.EEID?.trim()
    const date = row.Date?.trim()
    const startStr = row.Start_Time?.trim()
    const endStr = row.End_Time?.trim()
    const name = row.Employee?.trim()

    // Skip Flex PTO Coverage and rows without times
    if (!startStr || !endStr || startStr.includes('Flex') || endStr.includes('Flex')) {
      skipped++
      continue
    }

    // Skip rows without EEID
    if (!eeid) {
      console.warn(`  ⚠ No EEID for ${name} on ${date} — skipping`)
      noEeid++
      continue
    }

    // Cache name
    eeidToName.set(eeid, name)

    const startMins = parseTimeToMins(startStr)
    const endMins = parseTimeToMins(endStr)
    const crossesMidnight = endMins < startMins

    const key = `${eeid}::${date}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push({ eeid, name, date, startMins, endMins, crossesMidnight })
  }

  console.log(`Skipped: ${skipped} (Flex PTO/no times)`)
  console.log(`No EEID: ${noEeid}`)
  console.log(`Unique EEID+Date combinations: ${grouped.size}\n`)

  // Merge segments per EEID+Date
  const allMerged: MergedShift[] = []
  for (const segments of grouped.values()) {
    const merged = mergeShiftSegments(segments)
    allMerged.push(...merged)
  }

  console.log(`After UKG Scrub merge: ${allMerged.length} shift entries\n`)
  console.log('Importing...')

  let success = 0
  let failed = 0

  for (const shift of allMerged) {
    // Look up associate by name (last name first in CSV)
    const associateId = await getAssociateIdByName(shift.name)

    if (!associateId) {
      console.warn(`  ⚠ No associate found for "${shift.name}" (EEID: ${shift.eeid}) — skipping`)
      failed++
      continue
    }

    const { error } = await supabase
      .from('schedule_entries')
      .upsert({
        store_id: STORE_ID,
        associate_id: associateId,
        shift_date: shift.date,
        start_time: shift.startTime,
        end_time: shift.endTime,
      }, {
        onConflict: 'store_id,associate_id,shift_date,start_time',
        ignoreDuplicates: false,
      })

    if (error) {
      console.error(`  ✗ ${shift.name} ${shift.date}: ${error.message}`)
      failed++
    } else {
      console.log(`  ✓ ${shift.name} | ${shift.date} | ${shift.startTime}–${shift.endTime}`)
      success++
    }
  }

  console.log(`\n✅ Import complete: ${success} inserted, ${failed} failed\n`)
}

main().catch(console.error)
