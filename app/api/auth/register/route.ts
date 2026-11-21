import {
  jsonNoStore,
  resolveViewerSession,
} from '../../../../src/server/auth'
import {
  accountToIdentity,
  authMode,
  consumeInviteCode,
  createLocalAccount,
  ensureBootstrapManager,
  findAccountByEmail,
  sessionCookieHeader,
  signSessionCookie,
  validateInviteCode,
} from '../../../../src/server/localAuth'

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

  if (await findAccountByEmail(email)) {
    return jsonNoStore(
      { ok: false, error: 'email_taken', message: '이미 등록된 이메일입니다.' },
      409,
    )
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
