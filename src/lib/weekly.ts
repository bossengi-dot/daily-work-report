import type {
  AppState,
  DailyReport,
  Employee,
  ItemStatus,
  TopicCard,
  WeeklyTodo,
  WorkItem,
} from '../types'
import { isOooOn } from '../types'

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

/** 키워드 사전 — 박도형 테마 기반 정규화 */
const TOPIC_ALIASES: { key: string; patterns: RegExp[] }[] = [
  { key: '출장 정산', patterns: [/출장/, /정산/, /Hammelmann/, /독일/, /녹음본/] },
  { key: '콘젯 / Nalta', patterns: [/콘젯/, /Nalta/, /날타/, /다솜/, /유압/, /크래들/] },
  { key: 'PC 세팅', patterns: [/PC/, /컴퓨터/, /모니터/, /컴퓨존/, /세팅/] },
  { key: 'Wi‑Fi / 네트워크', patterns: [/Wi.?Fi/, /와이파이/, /mesh/, /네트워크/, /IP/] },
  { key: '작업테이블', patterns: [/작업테이블/, /테이블/] },
  { key: '기아차 펌프', patterns: [/기아/, /펌프/, /소모품/] },
  { key: '구매·발주', patterns: [/KTR/, /커플링/, /에어팬/, /쿨러/, /호스/, /발주/, /필터백/, /컨테이너/] },
  { key: '현장 수리', patterns: [/울산/, /스키드/, /얼라인/, /현장/] },
]

function datesInRange(start: string, end: string): string[] {
  const out: string[] = []
  const cur = new Date(start + 'T00:00:00')
  const endD = new Date(end + 'T00:00:00')
  while (cur <= endD) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

function matchTopic(text: string): string | null {
  for (const alias of TOPIC_ALIASES) {
    if (alias.patterns.some((p) => p.test(text))) return alias.key
  }
  // fallback: first 8 chars as soft topic
  const soft = text.replace(/\s+/g, ' ').trim().slice(0, 10)
  return soft || null
}

function allItems(r: DailyReport): WorkItem[] {
  return [...r.plan, ...r.execution, ...r.carryover]
}

export function deriveTopicsForRange(
  state: AppState,
  start: string,
  end: string,
): TopicCard[] {
  const dates = datesInRange(start, end)
  const globalCount = new Map<string, number>()
  const byDate = new Map<string, Map<string, { people: Set<string>; statuses: ItemStatus[]; n: number }>>()

  for (const date of dates) {
    byDate.set(date, new Map())
    for (const r of state.reports.filter((x) => x.date === date)) {
      for (const item of allItems(r)) {
        const topic = matchTopic(item.text)
        if (!topic) continue
        globalCount.set(topic, (globalCount.get(topic) ?? 0) + 1)
        const dayMap = byDate.get(date)!
        const cur = dayMap.get(topic) ?? { people: new Set(), statuses: [], n: 0 }
        cur.people.add(r.employeeId)
        cur.n += 1
        if (item.status) cur.statuses.push(item.status)
        dayMap.set(topic, cur)
      }
    }
  }

  // Only topics that appear 2+ times in the week
  const eligible = new Set(
    [...globalCount.entries()].filter(([, n]) => n >= 2).map(([k]) => k),
  )

  const cards: TopicCard[] = []
  for (const date of dates) {
    const dayMap = byDate.get(date)!
    const ranked = [...dayMap.entries()]
      .filter(([k]) => eligible.has(k))
      .sort((a, b) => b[1].n - a[1].n)
    if (ranked.length === 0) continue
    const [title, info] = ranked[0]
    let status: TopicCard['status'] = 'in_progress'
    if (info.statuses.some((s) => s === 'blocker')) status = 'blocker'
    else if (info.statuses.length && info.statuses.every((s) => s === 'done')) status = 'done'
    const people = [...info.people]
    cards.push({
      id: `auto-${date}-${title}`,
      date,
      weekday: WEEKDAY[new Date(date + 'T00:00:00').getDay()],
      title,
      status,
      people: people.slice(0, 3),
      extraCount: Math.max(0, people.length - 3),
      count: info.n,
    })
  }
  return cards
}

export function deriveWeeklyTopics(state: AppState): TopicCard[] {
  return deriveTopicsForRange(state, state.weekRange.start, state.weekRange.end)
}

/** 기간 말일 기준 미완료·블로커·연속이월 → 오픈 TODO */
export function deriveTodosForRange(
  state: AppState,
  start: string,
  end: string,
): WeeklyTodo[] {
  const endReports = state.reports.filter((r) => r.date === end)
  const todos: WeeklyTodo[] = []

  for (const r of endReports) {
    const candidates = [
      ...r.execution.filter((i) => i.status === 'in_progress' || i.status === 'blocker'),
      ...r.carryover.filter((i) => i.status !== 'done'),
    ]
    for (const item of candidates) {
      const days = item.consecutiveDays ?? (item.status === 'blocker' ? 2 : 1)
      const topic = matchTopic(item.text) ?? '기타'
      let priority: WeeklyTodo['priority'] = '중간'
      if (item.status === 'blocker' || days >= 5) priority = '높음'
      else if (days <= 1 && item.status === 'in_progress') priority = '낮음'

      let status: WeeklyTodo['status'] = item.status ?? 'in_progress'
      if (days >= 3 && item.status === 'in_progress') status = 'delayed'

      todos.push({
        id: `todo-${r.id}-${item.id}`,
        priority,
        text: item.text,
        assigneeId: r.employeeId,
        topic,
        startDate: days > 1 ? shiftDate(end, -(days - 1)) : end,
        dueDate: end,
        consecutiveDays: days,
        status,
      })
    }
  }

  for (const r of state.reports) {
    if (r.date === end) continue
    if (r.date < start || r.date > end) continue
    for (const item of r.carryover) {
      if ((item.consecutiveDays ?? 0) < 3) continue
      const already = todos.some(
        (t) => t.assigneeId === r.employeeId && t.text === item.text,
      )
      if (already) continue
      todos.push({
        id: `todo-hist-${r.id}-${item.id}`,
        priority: (item.consecutiveDays ?? 0) >= 5 ? '높음' : '중간',
        text: item.text,
        assigneeId: r.employeeId,
        topic: matchTopic(item.text) ?? '이월',
        startDate: shiftDate(r.date, -((item.consecutiveDays ?? 1) - 1)),
        dueDate: end,
        consecutiveDays: item.consecutiveDays ?? 3,
        status: item.status === 'blocker' ? 'blocker' : 'delayed',
      })
    }
  }

  return todos.sort((a, b) => {
    const p = { 높음: 0, 중간: 1, 낮음: 2 }
    if (p[a.priority] !== p[b.priority]) return p[a.priority] - p[b.priority]
    return b.consecutiveDays - a.consecutiveDays
  })
}

export function deriveWeeklyTodos(state: AppState): WeeklyTodo[] {
  return deriveTodosForRange(state, state.weekRange.start, state.weekRange.end)
}

function shiftDate(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return d.toISOString().slice(0, 10)
}

export function rangeKpi(state: AppState, start: string, end: string) {
  const dates = datesInRange(start, end)
  let expected = 0
  let submitted = 0
  let blockers = 0
  let carries = 0
  let oooExempt = 0

  for (const date of dates) {
    for (const emp of state.employees) {
      if (isOooOn(emp, date)) {
        oooExempt += 1
        continue
      }
      expected += 1
      const report = state.reports.find((r) => r.employeeId === emp.id && r.date === date)
      if (!report) continue
      if (['submitted', 'reviewing', 'done'].includes(report.status) || report.execSubmittedAt) {
        submitted += 1
      }
      blockers += [...report.execution, ...report.carryover].filter(
        (i) => i.status === 'blocker',
      ).length
      carries += report.carryover.filter((c) => (c.consecutiveDays ?? 0) >= 3).length
    }
  }

  return {
    expected,
    submitted,
    rate: expected ? Math.round((submitted / expected) * 100) : 0,
    blockers,
    carries,
    oooExempt,
  }
}

export function weekKpi(state: AppState) {
  return rangeKpi(state, state.weekRange.start, state.weekRange.end)
}

export function employeeName(employees: Employee[], id: string) {
  return employees.find((e) => e.id === id)?.name ?? id
}
