import {
  jsonNoStore,
  requireViewer,
  resolveViewerSession,
} from '../../../src/server/auth'
import { loadAppState } from '../../../src/server/stateRepo'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const identity = await requireViewer(request)
  if (identity instanceof Response) return identity
  const session = await resolveViewerSession(identity)
  if (!session.role) {
    return jsonNoStore({ session, state: null })
  }
  const state = await loadAppState(session.stage)
  return jsonNoStore({ session, state })
}
