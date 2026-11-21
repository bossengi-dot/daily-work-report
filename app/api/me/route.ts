import {
  jsonNoStore,
  requireViewer,
  resolveViewerSession,
} from '../../../src/server/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const identity = await requireViewer(request)
  if (identity instanceof Response) return identity
  const session = await resolveViewerSession(identity)
  return jsonNoStore({ session })
}
