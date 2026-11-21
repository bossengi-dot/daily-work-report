import type { DailyReport, Employee } from '../types'

/** NAVER WORKS / 채팅용 1메시지 요약 초안 (실연동 없음) */
export function composeChatSummary(employee: Employee, report: DailyReport): string {
  const lines: string[] = []
  lines.push(`[일일업무보고] ${employee.name} · ${report.date}`)
  lines.push('')

  lines.push('■ 계획')
  if (report.plan.length === 0) lines.push('- (실행으로 이관됨 / 없음)')
  else report.plan.forEach((p) => lines.push(`- ${p.text}`))

  lines.push('')
  lines.push('■ 실행')
  if (report.execution.length === 0) lines.push('- (없음)')
  else {
    for (const x of report.execution) {
      const st =
        x.status === 'done' ? '완료' : x.status === 'blocker' ? '블로커' : '진행'
      const ad = x.isAdHoc ? ' [계획 외]' : ''
      lines.push(`- (${st})${ad} ${x.text}`)
      if (x.status === 'blocker' && x.blockerReason) {
        lines.push(`  · 사유: ${x.blockerReason}`)
      }
    }
  }

  lines.push('')
  lines.push('■ 이월')
  if (report.carryover.length === 0) lines.push('- (없음)')
  else {
    for (const c of report.carryover) {
      const days = c.consecutiveDays ? ` · 연속 ${c.consecutiveDays}일` : ''
      lines.push(`- ${c.text}${days}`)
    }
  }

  const blockers = [...report.execution, ...report.carryover].filter(
    (i) => i.status === 'blocker',
  )
  lines.push('')
  lines.push(`■ 블로커 ${blockers.length}건`)
  if (blockers.length === 0) lines.push('- 없음')
  else {
    for (const b of blockers) {
      lines.push(`- ${b.text}`)
      if (b.blockerReason) lines.push(`  · ${b.blockerReason}`)
      if (b.supportRequest) lines.push(`  · 요청: ${b.supportRequest}`)
    }
  }

  const unreflected = report.instructions.filter((i) => i.reflect === 'unreflected')
  if (unreflected.length) {
    lines.push('')
    lines.push(`■ 미반영 지시 ${unreflected.length}건`)
    unreflected.forEach((i) => lines.push(`- ${i.text}`))
  }

  lines.push('')
  lines.push('(앱에서 복사 · NAVER WORKS/잔디 수동 붙여넣기)')
  return lines.join('\n')
}
