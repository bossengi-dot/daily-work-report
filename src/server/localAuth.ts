import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { VerifiedIdentity } from '../../cursor/identity'
import { sql } from '../lib/db'

export const LOCAL_SESSION_COOKIE = 'dwr_local_session'
const SESSION_DAYS = 14

export type LocalAccount = {
  id: string
  email: string
  password_hash: string
  display_name: string
}

export function authMode(): 'cursor' | 'local' {
  const mode = (process.env.AUTH_MODE ?? 'cursor').trim().toLowerCase()
  return mode === 'local' ? 'local' : 'cursor'
}

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim() ?? ''
  if (secret) return secret
  if (authMode() === 'local') {
    throw new Error('SESSION_SECRET is required when AUTH_MODE=local')
  }
  return 'dev-only-not-for-production'
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf, 'utf8') : buf
  return b.toString('base64url')
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 32)
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, saltB64, hashB64] = stored.split('$')
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return false
  const salt = Buffer.from(saltB64, 'base64url')
  const expected = Buffer.from(hashB64, 'base64url')
  const actual = scryptSync(password, salt, expected.length)
  return timingSafeEqual(actual, expected)
}

export async function findAccountByEmail(email: string): Promise<LocalAccount | null> {
  const rows = await sql<LocalAccount>(
    `select id, email, password_hash, display_name from local_accounts where lower(email) = lower($1)`,
    [email.trim()],
  )
  return rows[0] ?? null
}

export async function findAccountById(id: string): Promise<LocalAccount | null> {
  const rows = await sql<LocalAccount>(
    `select id, email, password_hash, display_name from local_accounts where id = $1`,
    [id],
  )
  return rows[0] ?? null
}

export async function createLocalAccount(input: {
  email: string
  password: string
  displayName: string
}): Promise<LocalAccount> {
  const id = `local:${randomBytes(12).toString('hex')}`
  const email = input.email.trim().toLowerCase()
  const displayName = input.displayName.trim() || email.split('@')[0] || '사용자'
  const passwordHash = hashPassword(input.password)
  await sql(
    `insert into local_accounts (id, email, password_hash, display_name)
     values ($1, $2, $3, $4)`,
    [id, email, passwordHash, displayName],
  )
  const row = await findAccountById(id)
  if (!row) throw new Error('local account create failed')
  return row
}

export async function deleteLocalAccount(id: string): Promise<void> {
  await sql(`delete from local_accounts where id = $1`, [id])
  // Free one-time invite codes that pointed at this account so re-use is not blocked
  // by leftover used_by references (env INVITE_CODE is unaffected).
  await sql(
    `update invite_codes set used_by = null, used_at = null where used_by = $1`,
    [id],
  )
}

export async function updateLocalAccount(
  id: string,
  patch: { email?: string; password?: string; displayName?: string },
): Promise<LocalAccount> {
  const current = await findAccountById(id)
  if (!current) throw new Error('local account not found')

  const email = patch.email?.trim().toLowerCase() || current.email
  const displayName =
    patch.displayName?.trim() || current.display_name
  const passwordHash = patch.password
    ? hashPassword(patch.password)
    : current.password_hash

  await sql(
    `update local_accounts
     set email = $2, password_hash = $3, display_name = $4
     where id = $1`,
    [id, email, passwordHash, displayName],
  )
  const row = await findAccountById(id)
  if (!row) throw new Error('local account update failed')
  return row
}

export type LocalAccountRoleHint = {
  role: 'manager' | 'employee'
  employee_id: string | null
} | null

/**
 * Decide whether an existing local account email can be reclaimed for a new
 * registration. Orphans (invite-only / role pointing at a deleted employee)
 * are reclaimable; live manager/employee bindings are not.
 */
export function localAccountReclaimability(
  role: LocalAccountRoleHint,
  liveEmployeeIds: ReadonlySet<string>,
):
  | { reclaimable: true; reason: 'no_role' | 'orphan_employee' }
  | { reclaimable: false; reason: 'manager' | 'active_employee' } {
  if (!role) return { reclaimable: true, reason: 'no_role' }
  if (role.role === 'manager') return { reclaimable: false, reason: 'manager' }
  if (role.employee_id && liveEmployeeIds.has(role.employee_id)) {
    return { reclaimable: false, reason: 'active_employee' }
  }
  // Role row left behind after employee was removed from app_state, or employee_id null.
  return { reclaimable: true, reason: 'orphan_employee' }
}

/** Create bootstrap manager from env once, if no managers exist. */
export async function ensureBootstrapManager(
  stage: 'production' | 'preview' = 'production',
): Promise<void> {
  if (authMode() !== 'local') return
  const email = process.env.BOOTSTRAP_MANAGER_EMAIL?.trim().toLowerCase() ?? ''
  const password = process.env.BOOTSTRAP_MANAGER_PASSWORD?.trim() ?? ''
  if (!email || !password) return

  const managers = await sql<{ c: string }>(
    `select count(*)::text as c from user_roles where stage = $1 and role = 'manager'`,
    [stage],
  )
  if (Number(managers[0]?.c ?? 0) > 0) return

  let account = await findAccountByEmail(email)
  if (!account) {
    account = await createLocalAccount({
      email,
      password,
      displayName: process.env.BOOTSTRAP_MANAGER_NAME?.trim() || '관리자',
    })
  }
  await sql(
    `insert into user_roles (stage, cursor_sub, role, employee_id, display_name)
     values ($1, $2, 'manager', null, $3)
     on conflict (stage, cursor_sub) do update set
       role = 'manager',
       display_name = excluded.display_name`,
    [stage, account.id, account.display_name],
  )
}

export function signSessionCookie(account: LocalAccount): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60
  const payload = b64url(JSON.stringify({ sub: account.id, email: account.email, exp }))
  const sig = createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifySessionCookie(raw: string | undefined): { sub: string; email: string } | null {
  if (!raw) return null
  const [payload, sig] = raw.split('.')
  if (!payload || !sig) return null
  const expected = createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: string
      email?: string
      exp?: number
    }
    if (!data.sub || !data.email || !data.exp) return null
    if (data.exp * 1000 < Date.now()) return null
    return { sub: data.sub, email: data.email }
  } catch {
    return null
  }
}

export function parseCookieHeader(header: string | null, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

export function sessionCookieHeader(value: string, maxAgeSec = SESSION_DAYS * 86400): string {
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''
  return `${LOCAL_SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`
}

export function clearSessionCookieHeader(): string {
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''
  return `${LOCAL_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
}

export function accountToIdentity(account: LocalAccount): VerifiedIdentity {
  return {
    verified: true,
    simulated: false,
    token: '',
    sub: account.id,
    email: account.email,
    emailVerified: true,
    name: account.display_name,
    idp: { provider: 'cursor', sub: account.id },
    stage: 'production',
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000),
    claims: { authMode: 'local' },
    kind: 'person',
    userId: 0,
    appVisibility: 'private',
  }
}

export async function validateInviteCode(
  code: string,
): Promise<{ ok: true; kind: 'env' | 'db' } | { ok: false; error: string }> {
  const trimmed = code.trim()
  if (!trimmed) return { ok: false, error: 'invalid_invite' }
  const envCode = process.env.INVITE_CODE?.trim() ?? ''
  if (envCode && trimmed === envCode) {
    return { ok: true, kind: 'env' }
  }

  const rows = await sql<{ code: string; used_by: string | null }>(
    `select code, used_by from invite_codes where code = $1`,
    [trimmed],
  )
  const row = rows[0]
  if (!row) return { ok: false, error: 'invalid_invite' }
  if (row.used_by) return { ok: false, error: 'invite_used' }
  return { ok: true, kind: 'db' }
}

export async function consumeInviteCode(
  code: string,
  usedBy: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const check = await validateInviteCode(code)
  if (!check.ok) return check
  if (check.kind === 'env') return { ok: true }
  const result = await sql(
    `update invite_codes set used_by = $1, used_at = NOW()
     where code = $2 and used_by is null
     returning code`,
    [usedBy, code.trim()],
  )
  if (result.length === 0) return { ok: false, error: 'invite_used' }
  return { ok: true }
}

export async function createInviteCode(createdBy: string): Promise<string> {
  const code = randomBytes(4).toString('hex')
  await sql(
    `insert into invite_codes (code, created_by) values ($1, $2)`,
    [code, createdBy],
  )
  return code
}
