import { composeChatSummary } from '../../../../src/lib/pushMessage'
import {
  jsonNoStore,
  requireManagerSession,
} from '../../../../src/server/auth'
import { loadAppState } from '../../../../src/server/stateRepo'

export const dynamic = 'force-dynamic'

/** Server-side webhook push. Uses NW_WEBHOOK_URL env if set; never accepts client secrets. */
export async function POST(request: Request) {
  const gated = await requireManagerSession(request)
  if (gated instanceof Response) return gated
  const { session } = gated
  const state = await loadAppState(session.stage)

  let employeeId: string | undefined
  try {
    const body = (await request.json()) as { employeeId?: string }
    employeeId = body.employeeId
  } catch {
    /* optional body */
  }

  const emp =
    state.employees.find((e) => e.id === employeeId) ?? state.employees[0]
  const report =
    (emp &&
      state.reports.find(
        (r) => r.employeeId === emp.id && r.date === state.currentDate,
      )) ||
    null
  if (!emp || !report) {
    return jsonNoStore({ ok: false, error: 'not_found' }, 404)
  }

  const message = composeChatSummary(emp, report)
  const url = process.env.NW_WEBHOOK_URL?.trim() ?? ''
  if (!url) {
    return jsonNoStore({
      ok: false,
      mode: 'clipboard-fallback',
      detail: '서버 웹훅 미설정 — 클라이언트에서 복사하세요.',
      message,
    })
  }
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return jsonNoStore({ ok: false, error: 'invalid_webhook' }, 500)
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message, source: 'daily-report-mvp' }),
    })
    if (!res.ok) {
      return jsonNoStore({
        ok: false,
        mode: 'clipboard-fallback',
        detail: `웹훅 응답 ${res.status}`,
        message,
      })
    }
    return jsonNoStore({
      ok: true,
      mode: 'webhook',
      detail: '웹훅 전송 성공',
      message,
    })
  } catch (e) {
    return jsonNoStore({
      ok: false,
      mode: 'clipboard-fallback',
      detail: `웹훅 실패 (${e instanceof Error ? e.message : 'network'})`,
      message,
    })
  }
}
