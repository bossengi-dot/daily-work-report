import { sql } from '../lib/db'
import { createSeed } from '../seed'
import type { AppState } from '../types'
import type { AppStage } from './auth'

type StateRow = { data: AppState }

export async function loadAppState(stage: AppStage): Promise<AppState> {
  const rows = await sql<StateRow>(
    `select data from app_state where stage = $1`,
    [stage],
  )
  if (rows[0]?.data) {
    return normalizeState(rows[0].data)
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
