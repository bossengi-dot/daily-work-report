import type { AppState } from '../types'
import { deriveWeeklyTodos, deriveWeeklyTopics, employeeName, weekKpi } from './weekly'

/** 규칙 기반 주간 브리프 초안. */
export function generateWeeklyBrief(state: AppState): string {
  const kpi = weekKpi(state)
  const topics = deriveWeeklyTopics(state)
  const todos = deriveWeeklyTodos(state)
  const blockers = todos.filter((t) => t.status === 'blocker')
  const longCarry = todos.filter((t) => t.consecutiveDays >= 5)

  const lines: string[] = []
  lines.push(`주간 업무 브리프 초안 (${state.weekRange.start} ~ ${state.weekRange.end})`)
  lines.push('')
  lines.push(
    `1) 운영 요약: 제출률 ${kpi.submitted}/${kpi.expected} (${kpi.rate}%), 블로커 ${kpi.blockers}건, 연속이월(3일+) ${kpi.carries}건.`,
  )

  if (topics.length) {
    lines.push('')
    lines.push('2) 주간 주요 토픽 (일일 데이터 키워드 2회+ 클러스터):')
    for (const t of topics) {
      const st =
        t.status === 'blocker' ? '블로커' : t.status === 'done' ? '완료' : '진행'
      lines.push(
        `   · ${t.weekday} ${t.date.slice(5)} — ${t.title} (${st}, 언급 ${t.count ?? '-'}회)`,
      )
    }
  }

  if (blockers.length) {
    lines.push('')
    lines.push('3) 블로커·에스컬레이션 후보:')
    for (const b of blockers.slice(0, 5)) {
      lines.push(`   · [${employeeName(state.employees, b.assigneeId)}] ${b.text}`)
    }
  }

  if (longCarry.length) {
    lines.push('')
    lines.push('4) 만성 이월 (5일+):')
    for (const c of longCarry) {
      lines.push(
        `   · [${employeeName(state.employees, c.assigneeId)}] ${c.text} — 연속 ${c.consecutiveDays}일`,
      )
    }
  }

  const unreflected = state.reports
    .filter((r) => r.date >= state.weekRange.start && r.date <= state.weekRange.end)
    .flatMap((r) =>
      r.instructions
        .filter((i) => i.reflect === 'unreflected')
        .map((i) => ({ emp: r.employeeId, text: i.text, date: i.date })),
    )
  if (unreflected.length) {
    lines.push('')
    lines.push('5) 미반영 사장 지시:')
    for (const u of unreflected.slice(0, 5)) {
      lines.push(`   · [${employeeName(state.employees, u.emp)}] ${u.date} — ${u.text}`)
    }
  }

  lines.push('')
  lines.push('6) 제안 액션: 장기 이월·블로커 담당과 일정 재합의, 미반영 지시는 당일 반영 확인.')
  lines.push('')
  lines.push('— 본 초안은 규칙 기반 자동 생성입니다. 사람 검토 후 발송하세요. —')
  return lines.join('\n')
}

/** 주간·월간 규칙 기반 브리프 초안 (클라이언트에서 바로 생성). */
export function generateBriefDraft(
  state: AppState,
  period: 'week' | 'month' = 'week',
): string {
  const scoped =
    period === 'month' ? { ...state, weekRange: { ...state.monthRange } } : state
  let text = generateWeeklyBrief(scoped)
  if (period === 'month') {
    text = text.startsWith('주간')
      ? text.replace('주간 업무 브리프', '월간 업무 브리프')
      : `월간 업무 브리프 초안\n\n${text}`
  }
  return text
}
