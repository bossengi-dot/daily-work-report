import type { ClientAction } from '../../../src/actionTypes'
import { runAction } from '../../../src/server/actions'
import {
  jsonNoStore,
  requireViewer,
  resolveViewerSession,
} from '../../../src/server/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const identity = await requireViewer(request)
  if (identity instanceof Response) return identity
  const session = await resolveViewerSession(identity)

  let body: { action?: ClientAction }
  try {
    body = (await request.json()) as { action?: ClientAction }
  } catch {
    return jsonNoStore({ ok: false, error: 'invalid_json' }, 400)
  }
  if (!body.action || typeof body.action !== 'object' || !('type' in body.action)) {
    return jsonNoStore({ ok: false, error: 'missing_action' }, 400)
  }

  if (!session.role && body.action.type !== 'submitJoin') {
    return jsonNoStore({ ok: false, error: 'forbidden' }, 403)
  }

  const result = await runAction(session.stage, session, body.action)
  const status = result.ok ? 200 : result.error === 'forbidden' ? 403 : 400
  const fresh = await resolveViewerSession(identity)
  return jsonNoStore({ ...result, session: fresh }, status)
}
