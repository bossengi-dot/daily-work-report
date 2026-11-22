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
    // No role yet — still report whether this account has a pending join so the
    // waiting screen can show status after refresh (without leaking full state).
    const state = await loadAppState(session.stage)
    const joinPending = state.joinApplications.some(
      (j) => j.status === 'pending' && j.applicantSub === session.cursorSub,
    )
    return jsonNoStore({ session, state: null, joinPending })
  }
  const state = await loadAppState(session.stage)
  return jsonNoStore({ session, state, joinPending: false })
}
