import { jsonNoStore } from '../../../../src/server/auth'
import { authMode, clearSessionCookieHeader } from '../../../../src/server/localAuth'

export const dynamic = 'force-dynamic'

export async function POST() {
  if (authMode() !== 'local') {
    return jsonNoStore({ ok: true, message: 'cursor_mode' })
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'private, no-store',
      'set-cookie': clearSessionCookieHeader(),
    },
  })
}
