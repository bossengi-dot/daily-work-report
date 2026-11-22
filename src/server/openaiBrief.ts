import { generateWeeklyBrief } from '../lib/aiBrief'
import type { AppState } from '../types'

export type BriefMode = 'llm' | 'heuristic'

export type BriefResult = {
  text: string
  mode: BriefMode
  detail: string
}

const DEFAULT_MODEL = 'gpt-4o-mini'

function openaiApiKey(): string {
  return process.env.OPENAI_API_KEY?.trim() ?? ''
}

function openaiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL
}

function briefStateForPeriod(
  state: AppState,
  period: 'week' | 'month',
): AppState {
  if (period === 'month') {
    return { ...state, weekRange: { ...state.monthRange } }
  }
  return state
}

function labelHeuristicText(text: string, period: 'week' | 'month'): string {
  if (period !== 'month') return text
  if (text.startsWith('주간')) {
    return text.replace('주간 업무 브리프', '월간 업무 브리프')
  }
  return `월간 업무 브리프 초안\n\n${text}`
}

async function polishWithOpenAI(
  heuristic: string,
  period: 'week' | 'month',
): Promise<string> {
  const apiKey = openaiApiKey()
  if (!apiKey) {
    throw new Error('missing_openai_key')
  }
  const model = openaiModel()
  const periodKo = period === 'month' ? '월간' : '주간'
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: [
            `당신은 한국어로 쓰는 ${periodKo} 업무 브리프 편집자입니다.`,
            '아래 규칙 기반 초안을 관리자가 바로 검토·공유할 수 있게 다듬으세요.',
            '사실·수치·이름·날짜를 바꾸거나 지어내지 마세요. 없는 정보는 추가하지 마세요.',
            '구조는 유지하되 문장을 더 읽기 쉽게 다듬고, 끝에는 사람 검토 안내를 남기세요.',
            '마크다운 코드펜스 없이 본문만 출력하세요.',
          ].join(' '),
        },
        {
          role: 'user',
          content: heuristic,
        },
      ],
    }),
  })

  if (!res.ok) {
    // Do not log response body — may contain request echoes; never log the key.
    throw new Error(`openai_http_${res.status}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>
  }
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('openai_empty')
  }
  return content
}

/** Server-only brief generation. Reads OPENAI_API_KEY from process.env; never from the client. */
export async function generateManagerBrief(
  state: AppState,
  period: 'week' | 'month' = 'week',
): Promise<BriefResult> {
  const scoped = briefStateForPeriod(state, period)
  let heuristic = generateWeeklyBrief(scoped)
  if (period === 'month') {
    heuristic = labelHeuristicText(heuristic, period)
  }

  if (!openaiApiKey()) {
    return {
      text: heuristic,
      mode: 'heuristic',
      detail: '규칙 기반 초안 (서버 비밀키 연동 시에만 LLM 사용)',
    }
  }

  try {
    const polished = await polishWithOpenAI(heuristic, period)
    return {
      text: polished,
      mode: 'llm',
      detail: `OpenAI LLM 초안 (${openaiModel()})`,
    }
  } catch {
    return {
      text: heuristic,
      mode: 'heuristic',
      detail: 'LLM 호출 실패 — 규칙 기반 초안 사용',
    }
  }
}
