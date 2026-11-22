import { generateWeeklyBrief } from './aiBrief'
import type { AppState } from '../types'

export type BriefMode = 'llm' | 'heuristic'

export type BriefClientResult = {
  text: string
  mode: BriefMode
  detail: string
}

function localHeuristic(
  state: AppState,
  period: 'week' | 'month',
): BriefClientResult {
  const scoped =
    period === 'month' ? { ...state, weekRange: { ...state.monthRange } } : state
  let text = generateWeeklyBrief(scoped)
  if (period === 'month') {
    text = text.startsWith('주간')
      ? text.replace('주간 업무 브리프', '월간 업무 브리프')
      : `월간 업무 브리프 초안\n\n${text}`
  }
  return {
    text,
    mode: 'heuristic',
    detail: '규칙 기반 초안 (서버 비밀키 연동 시에만 LLM 사용)',
  }
}

/**
 * Asks the manager-only server route to generate a brief.
 * LLM uses server env OPENAI_API_KEY only — never accepted from the browser.
 * Falls back to local heuristic if the API is unreachable.
 */
export async function tryGenerateBrief(
  state: AppState,
  options?: { period?: 'week' | 'month' },
): Promise<BriefClientResult> {
  const period = options?.period ?? 'week'
  try {
    const res = await fetch('/api/integrations/brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ period }),
    })
    if (res.ok) {
      const data = (await res.json()) as {
        text?: string
        mode?: BriefMode
        detail?: string
      }
      if (typeof data.text === 'string' && data.text.length > 0) {
        return {
          text: data.text,
          mode: data.mode === 'llm' ? 'llm' : 'heuristic',
          detail:
            typeof data.detail === 'string' && data.detail
              ? data.detail
              : data.mode === 'llm'
                ? 'OpenAI LLM 초안'
                : '규칙 기반 초안',
        }
      }
    }
  } catch {
    /* network / offline → local heuristic */
  }
  return localHeuristic(state, period)
}
