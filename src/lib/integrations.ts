import { generateWeeklyBrief } from './aiBrief'
import type { AppState } from '../types'

/** Heuristic-only briefs. LLM secrets are not accepted from the browser. */
export async function tryGenerateBrief(
  state: AppState,
): Promise<{ text: string; mode: 'heuristic'; detail: string }> {
  return {
    text: generateWeeklyBrief(state),
    mode: 'heuristic',
    detail: '규칙 기반 초안 (서버 비밀키 연동 시에만 LLM 사용)',
  }
}
