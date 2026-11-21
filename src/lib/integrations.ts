import type { AppSettings } from '../types'
import { generateWeeklyBrief } from './aiBrief'
import type { AppState } from '../types'

export type PushResult =
  | { ok: true; mode: 'webhook' | 'clipboard-fallback'; detail: string }
  | { ok: false; mode: 'clipboard-fallback'; detail: string }

/** Try NW webhook if configured; never embeds secrets in code. */
export async function tryPushWebhook(
  settings: AppSettings,
  message: string,
): Promise<{ attempted: boolean; ok: boolean; detail: string }> {
  const url = settings.nwWebhookUrl.trim()
  if (!url) {
    return { attempted: false, ok: false, detail: '웹훅 URL 없음 — 로컬 미리보기/복사 사용' }
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message,
        source: 'daily-report-mvp',
      }),
    })
    if (!res.ok) {
      return {
        attempted: true,
        ok: false,
        detail: `웹훅 응답 ${res.status} — 로컬 폴백`,
      }
    }
    return { attempted: true, ok: true, detail: '웹훅 전송 성공' }
  } catch (e) {
    return {
      attempted: true,
      ok: false,
      detail: `웹훅 실패 (${e instanceof Error ? e.message : 'network'}) — 로컬 폴백`,
    }
  }
}

/** Try LLM endpoint if key+URL set; else heuristic brief. Never hardcode keys. */
export async function tryGenerateBrief(
  state: AppState,
  settings: AppSettings,
): Promise<{ text: string; mode: 'llm' | 'heuristic'; detail: string }> {
  const heuristic = generateWeeklyBrief(state)
  const endpoint = settings.llmEndpoint.trim()
  const key = settings.llmApiKey.trim()
  if (!endpoint || !key) {
    return {
      text: heuristic,
      mode: 'heuristic',
      detail: 'LLM 미설정 — 규칙 기반 초안 사용',
    }
  }
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              '당신은 한국어 주간 업무 브리프 작성 도우미입니다. 간결한 불릿으로 요약하세요.',
          },
          {
            role: 'user',
            content: `다음 초안을 다듬어 주세요. 사람 검토 후 발송 전제입니다.\n\n${heuristic}`,
          },
        ],
      }),
    })
    if (!res.ok) {
      return {
        text: heuristic,
        mode: 'heuristic',
        detail: `LLM 응답 ${res.status} — 휴리스틱 폴백`,
      }
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
      content?: string
    }
    const text =
      data.choices?.[0]?.message?.content?.trim() ||
      data.content?.trim() ||
      heuristic
    return { text, mode: 'llm', detail: 'LLM 초안 생성' }
  } catch (e) {
    return {
      text: heuristic,
      mode: 'heuristic',
      detail: `LLM 실패 (${e instanceof Error ? e.message : 'network'}) — 휴리스틱 폴백`,
    }
  }
}
