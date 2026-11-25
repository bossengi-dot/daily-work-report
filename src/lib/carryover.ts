import type { DailyReport, WorkItem } from '../types'

export type WorkSection = 'plan' | 'progress' | 'execution' | 'carryover'

export function sectionItems(report: DailyReport, section: WorkSection): WorkItem[] {
  return report[section] ?? []
}

/** Items that should roll into next-day (or evening) carryover. */
export function unfinishedForCarryover(report: DailyReport): WorkItem[] {
  const fromPlan = report.plan ?? []
  const fromProgress = (report.progress ?? []).filter((i) => i.status !== 'done')
  const fromExec = (report.execution ?? []).filter(
    (i) => i.status === 'in_progress' || i.status === 'blocker' || i.status == null,
  )
  const fromCarry = (report.carryover ?? []).filter((i) => i.status !== 'done')
  return [...fromPlan, ...fromProgress, ...fromExec, ...fromCarry]
}

/** Clone unfinished items into carryover with consecutive day badges. */
export function buildCarryoverItems(
  source: DailyReport | undefined,
  idFactory: (prefix: string) => string,
): WorkItem[] {
  if (!source) return []
  return unfinishedForCarryover(source).map((item) => ({
    ...item,
    id: idFactory('c'),
    status: item.status === 'blocker' ? 'blocker' : 'in_progress',
    consecutiveDays: (item.consecutiveDays ?? 0) + 1,
    checked: undefined,
    fromPlanId: item.fromPlanId,
    isAdHoc: item.isAdHoc,
  }))
}

/** On evening close: move unfinished plan/progress into today's carryover list. */
export function applyEveningCarryTransfer(report: DailyReport): DailyReport {
  const keepProgress = (report.progress ?? []).filter((i) => i.status === 'done')
  const keepExec = (report.execution ?? []).filter((i) => i.status === 'done')
  const moving = unfinishedForCarryover({
    ...report,
    // Avoid double-counting existing carryover in the merge below
    carryover: [],
  })
  const existingCarry = (report.carryover ?? []).filter((i) => i.status !== 'done')
  const doneCarry = (report.carryover ?? []).filter((i) => i.status === 'done')

  const seen = new Set<string>()
  const mergedCarry: WorkItem[] = []
  for (const item of [...existingCarry, ...moving]) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    mergedCarry.push({
      ...item,
      status: item.status === 'blocker' ? 'blocker' : item.status ?? 'in_progress',
      consecutiveDays: item.consecutiveDays ?? 1,
    })
  }

  return {
    ...report,
    plan: [],
    progress: keepProgress,
    execution: [...keepExec, ...doneCarry.filter((i) => !keepExec.some((e) => e.id === i.id))],
    carryover: mergedCarry,
  }
}

export function findItemSection(
  report: DailyReport,
  itemId: string,
): WorkSection | null {
  for (const section of ['plan', 'progress', 'execution', 'carryover'] as const) {
    if ((report[section] ?? []).some((i) => i.id === itemId)) return section
  }
  return null
}

export function moveItemBetweenSections(
  report: DailyReport,
  itemId: string,
  to: WorkSection,
): DailyReport {
  const from = findItemSection(report, itemId)
  if (!from || from === to) return report
  const item = (report[from] ?? []).find((i) => i.id === itemId)
  if (!item) return report

  let next: WorkItem = { ...item, checked: undefined }
  if (to === 'plan') {
    next = {
      ...next,
      status: undefined,
      blockerReason: next.blockerReason,
    }
  } else if (to === 'progress') {
    next = {
      ...next,
      status: next.status === 'blocker' ? 'blocker' : 'in_progress',
    }
  } else if (to === 'execution') {
    next = {
      ...next,
      status: 'done',
    }
  } else if (to === 'carryover') {
    next = {
      ...next,
      status: next.status === 'blocker' ? 'blocker' : next.status ?? 'in_progress',
      consecutiveDays: next.consecutiveDays ?? 1,
    }
  }

  return {
    ...report,
    [from]: (report[from] ?? []).filter((i) => i.id !== itemId),
    [to]: [...(report[to] ?? []), next],
  }
}
