import { legacyReportStatusKo } from './statusLabels'
import type { DailyReport, Employee, WorkItem } from '../types'

export type ExportRange = {
  /** Inclusive YYYY-MM-DD, or empty for unbounded */
  from?: string
  /** Inclusive YYYY-MM-DD, or empty for unbounded */
  to?: string
}

function itemStatusKo(item: WorkItem): string {
  if (item.status === 'done') return '완료'
  if (item.status === 'blocker') return '블로커'
  if (item.status === 'in_progress') return '진행'
  return ''
}

function formatItemLine(item: WorkItem, prefix = '-'): string[] {
  const st = itemStatusKo(item)
  const ad = item.isAdHoc ? ' [계획 외]' : ''
  const days =
    item.consecutiveDays && item.consecutiveDays > 0
      ? ` · 연속 ${item.consecutiveDays}일`
      : ''
  const lines = [`${prefix} ${st ? `(${st}) ` : ''}${item.text}${ad}${days}`]
  if (item.blockerReason) lines.push(`  · 사유: ${item.blockerReason}`)
  if (item.supportRequest) lines.push(`  · 요청: ${item.supportRequest}`)
  if (item.attachments?.length) {
    for (const a of item.attachments) {
      lines.push(`  · 첨부: ${a.label || a.url}`)
    }
  }
  return lines
}

function formatReportBlock(report: DailyReport): string[] {
  const lines: string[] = []
  lines.push(`── ${report.date} · ${legacyReportStatusKo(report.status)} ──`)
  if (report.planSubmittedAt) lines.push(`오전 제출: ${report.planSubmittedAt}`)
  if (report.execSubmittedAt || report.submittedAt) {
    lines.push(`저녁 마감: ${report.execSubmittedAt ?? report.submittedAt}`)
  }
  if (report.revisionNote) lines.push(`보완요청: ${report.revisionNote}`)
  if (report.managerAck === 'thumbsup') lines.push('매니저 반응: 👍')
  if (report.managerAck === 'confirmed') lines.push('매니저 반응: 확인')

  lines.push('')
  lines.push('[계획]')
  if (report.plan.length === 0) lines.push('- (없음)')
  else report.plan.forEach((p) => lines.push(...formatItemLine(p)))

  lines.push('')
  lines.push('[진행]')
  if ((report.progress ?? []).length === 0) lines.push('- (없음)')
  else (report.progress ?? []).forEach((x) => lines.push(...formatItemLine(x)))

  lines.push('')
  lines.push('[실행]')
  if (report.execution.length === 0) lines.push('- (없음)')
  else report.execution.forEach((x) => lines.push(...formatItemLine(x)))

  lines.push('')
  lines.push('[이월]')
  if (report.carryover.length === 0) lines.push('- (없음)')
  else report.carryover.forEach((c) => lines.push(...formatItemLine(c)))

  if (report.instructions.length > 0) {
    lines.push('')
    lines.push('[지시]')
    for (const i of report.instructions) {
      const reflect = i.reflect === 'reflected' ? '반영' : '미반영'
      lines.push(`- [${i.date}] (${reflect}) ${i.text}`)
    }
  }

  if (report.memo?.trim()) {
    lines.push('')
    lines.push('[메모]')
    lines.push(report.memo.trim())
  }

  return lines
}

/** Filter reports for one employee within an optional date range. */
export function filterReportsForExport(
  reports: DailyReport[],
  employeeId: string,
  range?: ExportRange,
): DailyReport[] {
  const from = range?.from?.trim() || ''
  const to = range?.to?.trim() || ''
  return reports
    .filter((r) => r.employeeId === employeeId)
    .filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Korean plain-text export of a member's work/report history. */
export function composeWorkHistoryText(
  employee: Employee,
  reports: DailyReport[],
  range?: ExportRange,
): string {
  const filtered = filterReportsForExport(reports, employee.id, range)
  const lines: string[] = []
  lines.push('일일업무보고 내보내기')
  lines.push('====================')
  lines.push(`구성원: ${employee.name}`)
  lines.push(`부서: ${employee.dept}`)
  lines.push(`직책: ${employee.role}`)
  const from = range?.from?.trim() || ''
  const to = range?.to?.trim() || ''
  if (from || to) {
    lines.push(`기간: ${from || '시작'} ~ ${to || '끝'}`)
  } else {
    lines.push('기간: 전체')
  }
  lines.push(`건수: ${filtered.length}일`)
  lines.push(`내보낸 시각: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`)
  lines.push('')

  if (filtered.length === 0) {
    lines.push('(해당 기간의 보고가 없습니다.)')
  } else {
    for (let i = 0; i < filtered.length; i++) {
      if (i > 0) lines.push('')
      lines.push(...formatReportBlock(filtered[i]))
    }
  }

  lines.push('')
  lines.push('— 끝 —')
  return lines.join('\n')
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function exportFilename(employeeName: string, range?: ExportRange): string {
  const safe = employeeName.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'member'
  const from = range?.from?.trim() || 'all'
  const to = range?.to?.trim() || 'all'
  if (from === 'all' && to === 'all') return `일일보고_${safe}_전체.txt`
  return `일일보고_${safe}_${from}_${to}.txt`
}
