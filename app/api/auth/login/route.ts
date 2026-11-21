import {
  jsonNoStore,
  resolveViewerSession,
} from '../../../../src/server/auth'
import {
  accountToIdentity,
  authMode,
  ensureBootstrapManager,
  findAccountByEmail,
  sessionCookieHeader,
  signSessionCookie,
  verifyPassword,
} from '../../../../src/server/localAuth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (authMode() !== 'local') {
    return jsonNoStore({ ok: false, error: 'cursor_mode' }, 400)
  }

  try {
    await ensureBootstrapManager('production')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'bootstrap_failed'
    return jsonNoStore({ ok: false, error: message }, 500)
  }

  let body: { email?: string; password?: string }
  try {
    body = (await request.json()) as { email?: string; password?: string }
  } catch {
    return jsonNoStore({ ok: false, error: 'invalid_json' }, 400)
  }

  const email = body.email?.trim() ?? ''
  const password = body.password ?? ''
  if (!email || !password) {
    return jsonNoStore({ ok: false, error: 'missing_fields' }, 400)
  }

  const account = await findAccountByEmail(email)
  if (!account || !verifyPassword(password, account.password_hash)) {
    return jsonNoStore({ ok: false, error: 'invalid_credentials' }, 401)
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
