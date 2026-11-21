import { jsonNoStore } from '../../../../src/server/auth'
import { authMode, ensureBootstrapManager } from '../../../../src/server/localAuth'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (authMode() === 'local') {
    try {
      await ensureBootstrapManager('production')
    } catch {
      /* bootstrap can fail before DB is ready; client still sees mode */
    }
  }
  return jsonNoStore({
    mode: authMode(),
    inviteHint: authMode() === 'local',
  })
}
