import {
  jsonNoStore,
  requireManagerSession,
} from '../../../../src/server/auth'
import { authMode, createInviteCode } from '../../../../src/server/localAuth'

export const dynamic = 'force-dynamic'

/** Manager-only: mint a one-time invite code for NAS local registration. */
export async function POST(request: Request) {
  if (authMode() !== 'local') {
    return jsonNoStore({ ok: false, error: 'cursor_mode' }, 400)
  }
  const gated = await requireManagerSession(request)
  if (gated instanceof Response) return gated
  const code = await createInviteCode(gated.session.cursorSub)
  return jsonNoStore({ ok: true, code })
}
