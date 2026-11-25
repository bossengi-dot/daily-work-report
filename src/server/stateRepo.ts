import { buildCarryoverItems } from '../lib/carryover'
import { monthRangeOf, todaySeoul, weekRangeAround } from '../lib/dates'
import { sql } from '../lib/db'
import { createSeed } from '../seed'
import type { AppState, DailyReport, WorkItem } from '../types'
import type { AppStage } from './auth'

type StateRow = { data: AppState }

export async function loadAppState(stage: AppStage): Promise<AppState> {
  const rows = await sql<StateRow>(
    `select data from app_state where stage = $1`,
    [stage],
  )
  if (rows[0]?.data) {
    const normalized = normalizeState(rows[0].data)
    const advanced = syncCurrentDate(normalized)
    if (advanced.changed) {
      await saveAppState(stage, advanced.state)
      return advanced.state
    }
    return advanced.state
  }
  const seed = createSeed()
  const advanced = syncCurrentDate(normalizeState(seed))
  await saveAppState(stage, advanced.state)
  return advanced.state
}

export async function saveAppState(stage: AppStage, state: AppState): Promise<void> {
  const clean = normalizeState(state)
  await sql(
    `insert into app_state (stage, data, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (stage) do update set data = excluded.data, updated_at = now()`,
    [stage, JSON.stringify(clean)],
  )
}

function emptyTodayReport(employeeId: string, date: string): DailyReport {
  return {
    id: `r-${employeeId}-${date}`,
    employeeId,
    date,
    status: 'draft',
    memo: '',
    plan: [],
    progress: [],
    execution: [],
    carryover: [],
    instructions: [],
  }
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** Advance currentDate to Seoul today and seed carryover from the prior report. */
export function syncCurrentDate(state: AppState): { state: AppState; changed: boolean } {
  const today = todaySeoul()
  let next = state
  let changed = false

  if (state.currentDate !== today) {
    const prevDate = state.currentDate
    const reports = [...state.reports]
    for (const emp of state.employees) {
      if (reports.some((r) => r.employeeId === emp.id && r.date === today)) continue
      const prev =
        reports.find((r) => r.employeeId === emp.id && r.date === prevDate) ??
        reports
          .filter((r) => r.employeeId === emp.id && r.date < today)
          .sort((a, b) => b.date.localeCompare(a.date))[0]
      const carryover = buildCarryoverItems(prev, uid)
      const instructions =
        prev?.instructions
          ?.filter((i) => i.reflect === 'unreflected')
          .map((i) => ({ ...i })) ?? []
      reports.push({
        ...emptyTodayReport(emp.id, today),
        carryover,
        instructions,
      })
    }
    next = {
      ...state,
      currentDate: today,
      weekRange: weekRangeAround(today),
      monthRange: monthRangeOf(today),
      reports,
    }
    changed = true
  }

  const ensured = ensureTodayReports(next)
  return { state: ensured.state, changed: changed || ensured.changed }
}

/** Ensure every employee has a draft report for currentDate (fixes missing-report blocks). */
export function ensureTodayReports(state: AppState): {
  state: AppState
  changed: boolean
} {
  const date = state.currentDate
  const existing = new Set(
    state.reports
      .filter((r) => r.date === date)
      .map((r) => r.employeeId),
  )
  const missing = state.employees.filter((e) => !existing.has(e.id))
  if (missing.length === 0) return { state, changed: false }
  return {
    changed: true,
    state: {
      ...state,
      reports: [
        ...state.reports,
        ...missing.map((e) => emptyTodayReport(e.id, date)),
      ],
    },
  }
}

function migrateReportSections(report: DailyReport): DailyReport {
  const raw = report as DailyReport & { progress?: WorkItem[] }
  if (Array.isArray(raw.progress)) {
    return {
      ...report,
      plan: report.plan ?? [],
      progress: raw.progress,
      execution: report.execution ?? [],
      carryover: report.carryover ?? [],
    }
  }
  // Legacy: split execution into progress (not done) vs execution (done)
  const exec = report.execution ?? []
  const progress = exec.filter((i) => i.status !== 'done')
  const execution = exec.filter((i) => i.status === 'done')
  return {
    ...report,
    plan: report.plan ?? [],
    progress,
    execution,
    carryover: report.carryover ?? [],
  }
}

/** Strip leftover PIN fields and ensure progress section exists. */
function normalizeState(raw: AppState): AppState {
  return {
    ...raw,
    settings: { ...raw.settings },
    employees: (raw.employees ?? []).map((e) => {
      const { pin: _pin, ...rest } = e as typeof e & { pin?: string }
      return rest
    }),
    joinApplications: (raw.joinApplications ?? []).map((j) => {
      const {
        desiredPin: _d,
        issuedPin: _i,
        ...rest
      } = j as typeof j & { desiredPin?: string; issuedPin?: string }
      return rest
    }),
    reports: (raw.reports ?? []).map(migrateReportSections),
  }
}
