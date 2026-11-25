import type { DailyReport, Employee, ReportStatus } from '../types'
import { isEveningDone, isMorningDone, isOooOn } from '../types'

/** 직원 화면 카피 */
export function employeeStatusLabel(report: DailyReport): string {
  if (report.status === 'revision') return '보완요청'
  if (isEveningDone(report)) return '마감됨'
  if (isMorningDone(report)) return '계획제출됨'
  if (report.status === 'draft' && report.draftSavedAt) return '작성중'
  return '작성중'
}

/** 관리자 보드 상태 필 */
export type ManagerDisplayStatus =
  | 'ooo'
  | 'morning_only'
  | 'missing'
  | 'submitted'
  | 'reviewing'
  | 'done'
  | 'revision'

export function managerDisplayStatus(
  emp: Employee,
  report: DailyReport,
  currentDate: string,
): ManagerDisplayStatus {
  if (isOooOn(emp, currentDate)) return 'ooo'
  if (report.status === 'revision') return 'revision'
  if (report.status === 'done') return 'done'
  if (report.status === 'reviewing') return 'reviewing'
  if (report.status === 'submitted' || isEveningDone(report)) return 'submitted'
  if (isMorningDone(report) && !isEveningDone(report)) return 'morning_only'
  return 'missing'
}

export const MANAGER_STATUS_KO: Record<ManagerDisplayStatus, string> = {
  ooo: '부재',
  morning_only: '오전만',
  missing: '미제출',
  submitted: '제출',
  reviewing: '검토중',
  done: '완료',
  revision: '보완요청',
}

export function isMorningOnly(report: DailyReport): boolean {
  return isMorningDone(report) && !isEveningDone(report)
}

export function isAttentionRow(
  emp: Employee,
  report: DailyReport,
  currentDate: string,
): boolean {
  if (isOooOn(emp, currentDate)) return false
  const st = managerDisplayStatus(emp, report, currentDate)
  if (st === 'morning_only' || st === 'missing' || st === 'revision') return true
  const blockers = [...(report.progress ?? []), ...report.execution, ...report.carryover].some(
    (i) => i.status === 'blocker',
  )
  if (blockers) return true
  if (report.instructions.some((i) => i.reflect === 'unreflected')) return true
  return false
}

export function legacyReportStatusKo(status: ReportStatus): string {
  return (
    {
      draft: '미제출',
      submitted: '제출',
      reviewing: '검토중',
      done: '완료',
      revision: '보완요청',
    } as const
  )[status]
}
