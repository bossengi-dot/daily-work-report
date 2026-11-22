import {
  jsonNoStore,
  requireManagerSession,
} from '../../../../src/server/auth'
import { generateManagerBrief } from '../../../../src/server/openaiBrief'
import { loadAppState } from '../../../../src/server/stateRepo'

export const dynamic = 'force-dynamic'

type BriefBody = {
  period?: 'week' | 'month'
}

/**
 * Manager-only weekly/monthly brief. Uses OPENAI_API_KEY on the server when set;
 * never accepts API keys from the client.
 */
export async function POST(request: Request) {
  const gated = await requireManagerSession(request)
  if (gated instanceof Response) return gated
  const { session } = gated
  const state = await loadAppState(session.stage)

  let period: 'week' | 'month' = 'week'
  try {
    const body = (await request.json()) as BriefBody
    if (body.period === 'month' || body.period === 'week') {
      period = body.period
    }
  } catch {
    /* empty body → weekly */
  }

  const result = await generateManagerBrief(state, period)
  return jsonNoStore({
    ok: true,
    text: result.text,
    mode: result.mode,
    detail: result.detail,
  })
}
