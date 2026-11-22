import {
  deleteRole,
  jsonNoStore,
  loadRole,
  resolveViewerSession,
} from '../../../../src/server/auth'
import {
  accountToIdentity,
  authMode,
  consumeInviteCode,
  createLocalAccount,
  deleteLocalAccount,
  ensureBootstrapManager,
  findAccountByEmail,
  localAccountReclaimability,
  sessionCookieHeader,
  signSessionCookie,
  validateInviteCode,
} from '../../../../src/server/localAuth'
import { loadAppState, saveAppState } from '../../../../src/server/stateRepo'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (authMode() !== 'local') {
    return jsonNoStore({ ok: false, error: 'cursor_mode' }, 400)
  }

  await ensureBootstrapManager('production')

  let body: {
    email?: string
    password?: string
    displayName?: string
    inviteCode?: string
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return jsonNoStore({ ok: false, error: 'invalid_json' }, 400)
  }

  const email = body.email?.trim().toLowerCase() ?? ''
  const password = body.password ?? ''
  const displayName = body.displayName?.trim() ?? ''
  const inviteCode = body.inviteCode?.trim() ?? ''

  if (!email || !password || password.length < 8) {
    return jsonNoStore(
      {
        ok: false,
        error: 'invalid_fields',
        message: '이메일과 8자 이상 비밀번호가 필요합니다.',
      },
      400,
    )
  }
  if (!inviteCode) {
    return jsonNoStore(
      { ok: false, error: 'invite_required', message: '초대 코드가 필요합니다.' },
      400,
    )
  }

  const existing = await findAccountByEmail(email)
  if (existing) {
    const stage = 'production' as const
    const role = await loadRole(stage, existing.id)
    const state = await loadAppState(stage)
    const liveIds = new Set(state.employees.map((e) => e.id))
    const reclaim = localAccountReclaimability(
      role ? { role: role.role, employee_id: role.employee_id } : null,
      liveIds,
    )
    if (!reclaim.reclaimable) {
      return jsonNoStore(
        {
          ok: false,
          error: 'email_taken',
          message:
            reclaim.reason === 'manager'
              ? '관리자 이메일입니다. 다른 이메일을 사용하세요.'
              : '이미 등록된 이메일입니다.',
        },
        409,
      )
    }
    // Free orphan / invite-only leftover so the same email can sign up again.
    if (role) await deleteRole(stage, existing.id)
    await deleteLocalAccount(existing.id)
    if (role?.employee_id || state.joinApplications.some((j) => j.applicantSub === existing.id)) {
      const next = {
        ...state,
        employees: role?.employee_id
          ? state.employees.filter((e) => e.id !== role.employee_id)
          : state.employees,
        reports: role?.employee_id
          ? state.reports.filter((r) => r.employeeId !== role.employee_id)
          : state.reports,
        weeklyTodos: role?.employee_id
          ? state.weeklyTodos.filter((t) => t.assigneeId !== role.employee_id)
          : state.weeklyTodos,
        joinApplications: state.joinApplications.filter(
          (j) =>
            j.applicantSub !== existing.id &&
            j.employeeId !== role?.employee_id,
        ),
      }
      await saveAppState(stage, next)
    }
  }

  const inviteCheck = await validateInviteCode(inviteCode)
  if (!inviteCheck.ok) {
    const message =
      inviteCheck.error === 'invite_used'
        ? '이미 사용된 초대 코드입니다.'
        : '초대 코드가 올바르지 않습니다.'
    return jsonNoStore({ ok: false, error: inviteCheck.error, message }, 400)
  }

  const account = await createLocalAccount({ email, password, displayName })
  const consumed = await consumeInviteCode(inviteCode, account.id)
  if (!consumed.ok) {
    return jsonNoStore(
      { ok: false, error: consumed.error, message: '초대 코드 처리에 실패했습니다.' },
      400,
    )
  }

  const identity = accountToIdentity(account)
  const session = await resolveViewerSession(identity)
  const cookie = signSessionCookie(account)
  return new Response(JSON.stringify({ ok: true, session }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'private, no-store',
      'set-cookie': sessionCookieHeader(cookie),
    },
  })
}
