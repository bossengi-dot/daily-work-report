/** Asia/Seoul calendar helpers — machine clock may be UTC. */

const SEOUL = 'Asia/Seoul'

function seoulParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  }
}

/** YYYY-MM-DD in Asia/Seoul */
export function todaySeoul(date = new Date()): string {
  const p = seoulParts(date)
  return `${p.year}-${p.month}-${p.day}`
}

/** `YYYY-MM-DD HH:mm` stamp; date defaults to Seoul today */
export function nowStampSeoul(date?: string, at = new Date()): string {
  const p = seoulParts(at)
  const d = date ?? `${p.year}-${p.month}-${p.day}`
  return `${d} ${p.hour}:${p.minute}`
}

export function addDays(isoDate: string, delta: number): string {
  const d = new Date(isoDate + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

export function weekRangeAround(isoDate: string): { start: string; end: string } {
  const d = new Date(isoDate + 'T12:00:00Z')
  const day = d.getUTCDay() // 0 Sun … 6 Sat
  const mondayOffset = day === 0 ? -6 : 1 - day
  const start = addDays(isoDate, mondayOffset)
  const end = addDays(start, 4) // Fri
  return { start, end }
}

export function monthRangeOf(isoDate: string): { start: string; end: string } {
  const [y, m] = isoDate.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { start, end }
}
