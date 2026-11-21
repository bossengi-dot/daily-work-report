import { sql } from '../lib/db'
import { createSeed } from '../seed'
import type { AppState, DailyReport } from '../types'
import type { AppStage } from './auth'

type StateRow = { data: AppState }

export async function loadAppState(stage: AppStage): Promise<AppState> {
  const rows = await sql<StateRow>(
    `select data from app_state where stage = $1`,
    [stage],
  )
  if (rows[0]?.data) {
    const normalized = normalizeState(rows[0].data)
    const ensured = ensureTodayReports(normalized)
    if (ensured.changed) {
      await saveAppState(stage, ensured.state)
      return ensured.state
    }
    return ensured.state
  }
  const seed = createSeed()
  await saveAppState(stage, seed)
  return seed
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
    execution: [],
    carryover: [],
    instructions: [],
  }
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

/** Strip any leftover PIN fields from persisted/seeded payloads. */
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
  }
}
