import { requireIdentity, type VerifiedIdentity } from '../../cursor/identity'
import { sql } from '../lib/db'
import type { SessionRole } from '../types'
import {
  accountToIdentity,
  authMode,
  ensureBootstrapManager,
  findAccountById,
  LOCAL_SESSION_COOKIE,
  parseCookieHeader,
  verifySessionCookie,
} from './localAuth'

export type AppStage = 'production' | 'preview'

export type UserRoleRow = {
  stage: string
  cursor_sub: string
  role: SessionRole
  employee_id: string | null
  display_name: string
}

export type ViewerSession = {
  role: SessionRole | null
  employeeId: string | null
  displayName: string
  cursorSub: string
  email: string
  stage: AppStage
  simulated: boolean
  needsJoin: boolean
  kind: 'person' | 'key'
  authMode: 'cursor' | 'local'
}

export async function requireViewer(
  request: Request,
): Promise<VerifiedIdentity | Response> {
  if (authMode() === 'local') {
    await ensureBootstrapManager('production')
    const raw = parseCookieHeader(
      request.headers.get('cookie'),
      LOCAL_SESSION_COOKIE,
    )
    const parsed = verifySessionCookie(raw)
    if (!parsed) {
      return Response.json(
        { error: 'unauthorized', reason: 'missing_local_session', authMode: 'local' },
        { status: 401, headers: { 'cache-control': 'private, no-store' } },
      )
    }
    const account = await findAccountById(parsed.sub)
    if (!account) {
      return Response.json(
        { error: 'unauthorized', reason: 'unknown_account', authMode: 'local' },
        { status: 401, headers: { 'cache-control': 'private, no-store' } },
      )
    }
    return accountToIdentity(account)
  }
  return requireIdentity(request)
}

export function stageOf(identity: VerifiedIdentity): AppStage {
  if (authMode() === 'local') return 'production'
  return identity.stage === 'preview' ? 'preview' : 'production'
}

export async function loadRole(
  stage: AppStage,
  cursorSub: string,
): Promise<UserRoleRow | null> {
  const rows = await sql<UserRoleRow>(
    `select stage, cursor_sub, role, employee_id, display_name
     from user_roles where stage = $1 and cursor_sub = $2`,
    [stage, cursorSub],
  )
  return rows[0] ?? null
}

export async function countManagers(stage: AppStage): Promise<number> {
  const rows = await sql<{ c: string }>(
    `select count(*)::text as c from user_roles where stage = $1 and role = 'manager'`,
    [stage],
  )
  return Number(rows[0]?.c ?? 0)
}

export async function upsertRole(input: {
  stage: AppStage
  cursorSub: string
  role: SessionRole
  employeeId?: string | null
  displayName: string
}): Promise<UserRoleRow> {
  await sql(
    `insert into user_roles (stage, cursor_sub, role, employee_id, display_name)
     values ($1, $2, $3, $4, $5)
     on conflict (stage, cursor_sub) do update set
       role = excluded.role,
       employee_id = excluded.employee_id,
       display_name = excluded.display_name`,
    [
      input.stage,
      input.cursorSub,
      input.role,
      input.employeeId ?? null,
      input.displayName,
    ],
  )
  const row = await loadRole(input.stage, input.cursorSub)
  if (!row) throw new Error('role upsert failed')
  return row
}

export async function listRoles(stage: AppStage): Promise<UserRoleRow[]> {
  return sql<UserRoleRow>(
    `select stage, cursor_sub, role, employee_id, display_name
     from user_roles where stage = $1
     order by role desc, display_name asc`,
    [stage],
  )
}

export async function listRolesByEmployeeId(
  stage: AppStage,
  employeeId: string,
): Promise<UserRoleRow[]> {
  return sql<UserRoleRow>(
    `select stage, cursor_sub, role, employee_id, display_name
     from user_roles where stage = $1 and employee_id = $2`,
    [stage, employeeId],
  )
}

export async function deleteRole(
  stage: AppStage,
  cursorSub: string,
): Promise<void> {
  await sql(`delete from user_roles where stage = $1 and cursor_sub = $2`, [
    stage,
    cursorSub,
  ])
}

/** First signed-in person becomes manager when none exist. API keys never bootstrap. */
export async function resolveViewerSession(
  identity: VerifiedIdentity,
): Promise<ViewerSession> {
  const stage = stageOf(identity)
  const displayName =
    identity.name?.trim() || identity.email?.trim() || '사용자'
  let roleRow = await loadRole(stage, identity.sub)

  // Local mode: manager is created via BOOTSTRAP_MANAGER_* only (no auto first-login).
  if (!roleRow && identity.kind === 'person' && authMode() !== 'local') {
    const managers = await countManagers(stage)
    if (managers === 0) {
      roleRow = await upsertRole({
        stage,
        cursorSub: identity.sub,
        role: 'manager',
        employeeId: null,
        displayName,
      })
    }
  }

  return {
    role: roleRow?.role ?? null,
    employeeId: roleRow?.employee_id ?? null,
    displayName: roleRow?.display_name ?? displayName,
    cursorSub: identity.sub,
    email: identity.email ?? '',
    stage,
    simulated: Boolean(identity.simulated),
    needsJoin: !roleRow,
    kind: identity.kind,
    authMode: authMode(),
  }
}

export async function requireManagerSession(
  request: Request,
): Promise<{ identity: VerifiedIdentity; session: ViewerSession } | Response> {
  const identity = await requireViewer(request)
  if (identity instanceof Response) return identity
  const session = await resolveViewerSession(identity)
  if (session.role !== 'manager') {
    return Response.json({ error: 'forbidden', reason: 'manager_required' }, { status: 403 })
  }
  return { identity, session }
}

export function jsonNoStore(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { 'cache-control': 'private, no-store' },
  })
}
