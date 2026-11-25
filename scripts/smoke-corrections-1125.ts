import {
  applyEveningCarryTransfer,
  buildCarryoverItems,
  moveItemBetweenSections,
} from '../src/lib/carryover'
import { nowStampSeoul, todaySeoul } from '../src/lib/dates'
import type { DailyReport, WorkItem } from '../src/types'

function item(id: string, text: string, status?: WorkItem['status']): WorkItem {
  return { id, text, status, attachments: [] }
}

const report: DailyReport = {
  id: 'r1',
  employeeId: 'e1',
  date: '2026-11-25',
  status: 'draft',
  memo: '',
  plan: [item('p1', '계획 잔여')],
  progress: [item('pr1', '진행 중', 'in_progress'), item('pr2', '블로커', 'blocker')],
  execution: [item('x1', '완료', 'done')],
  carryover: [item('c1', '기존 이월', 'in_progress')],
  instructions: [],
}

const moved = moveItemBetweenSections(report, 'x1', 'plan')
if (!(moved.plan.some((i) => i.id === 'x1') && !moved.execution.some((i) => i.id === 'x1'))) {
  throw new Error('move execution→plan failed')
}
console.log('ok move execution→plan')

const evening = applyEveningCarryTransfer(report)
if (evening.plan.length !== 0) throw new Error('plan should clear')
if (!evening.carryover.some((i) => i.text === '계획 잔여')) throw new Error('plan not in carry')
if (!evening.carryover.some((i) => i.text === '진행 중')) throw new Error('progress not in carry')
if (!evening.execution.some((i) => i.id === 'x1')) throw new Error('done should stay in execution')
console.log('ok evening carry transfer', evening.carryover.map((i) => i.text).join(', '))

const next = buildCarryoverItems(report, (p) => `${p}-new`)
if (next.length < 4) throw new Error('expected unfinished carry seed')
if (!next.every((i) => (i.consecutiveDays ?? 0) >= 1)) throw new Error('days')
console.log('ok next-day seed', next.length)

const today = todaySeoul()
const stamp = nowStampSeoul(today)
if (!stamp.startsWith(today + ' ')) throw new Error('stamp date')
console.log('ok dates', today, stamp)
console.log('ALL PASS')
