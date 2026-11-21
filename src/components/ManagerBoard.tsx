import { useEffect, useMemo, useState } from 'react'
import { composeChatSummary } from '../lib/pushMessage'
import {
  isAttentionRow,
  MANAGER_STATUS_KO,
  managerDisplayStatus,
  type ManagerDisplayStatus,
} from '../lib/statusLabels'
import { useStore } from '../store'
import {
  isEveningDone,
  isMorningDone,
  isOooOn,
  type DailyReport,
  type WorkItem,
} from '../types'

type FilterKey =
  | 'attention'
  | 'review_queue'
  | 'blocker'
  | 'draft'
  | 'submitted'
  | 'reviewing'
  | 'done'
  | 'unreflected'
  | 'all'

function blockersOf(report: DailyReport): WorkItem[] {
  return [...report.execution, ...report.carryover].filter((i) => i.status === 'blocker')
}

function maxCarry(report: DailyReport) {
  return Math.max(0, ...report.carryover.map((c) => c.consecutiveDays ?? 0))
}

function unreflectedCount(report: DailyReport) {
  return report.instructions.filter((i) => i.reflect === 'unreflected').length
}

function rowBarClass(
  emp: { ooo?: { start: string; end: string } | null },
  report: DailyReport,
  date: string,
  st: ManagerDisplayStatus,
): string {
  if (isOooOn(emp as Parameters<typeof isOooOn>[0], date)) return 'bar-ooo'
  if (blockersOf(report).length) return 'bar-blocker'
  if (st === 'morning_only') return 'bar-morning'
  if (st === 'missing' || st === 'revision') return 'bar-missing'
  return 'bar-ok'
}

export function ManagerBoard() {
  const {
    state,
    getReport,
    remind,
    leaveInstruction,
    confirmReport,
    requestRevision,
    setReportStatus,
    setManagerAck,
    showToast,
    setView,
  } = useStore()

  const [filter, setFilter] = useState<FilterKey>('attention')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [instructionText, setInstructionText] = useState('')
  const [revisionText, setRevisionText] = useState('')
  const [pushOpen, setPushOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const todayReports = useMemo(
    () =>
      state.employees
        .map((emp) => {
          const report = getReport(emp.id)
          return report ? { emp, report } : null
        })
        .filter(Boolean) as { emp: (typeof state.employees)[0]; report: DailyReport }[],
    [state.employees, getReport],
  )

  const progress = useMemo(() => {
    const active = todayReports.filter(({ emp }) => !isOooOn(emp, state.currentDate))
    const n = active.length || 1
    const morning = active.filter(({ report }) => isMorningDone(report)).length
    const evening = active.filter(({ report }) => isEveningDone(report)).length
    return {
      morning,
      evening,
      morningPct: Math.round((morning / n) * 100),
      eveningPct: Math.round((evening / n) * 100),
      total: active.length,
      ooo: todayReports.length - active.length,
    }
  }, [todayReports, state.currentDate])

  const counts = useMemo(() => {
    let blocker = 0
    let draft = 0
    let morningOnly = 0
    let submitted = 0
    let reviewing = 0
    let done = 0
    let unreflected = 0
    let attention = 0
    let reviewQueue = 0
    for (const { emp, report } of todayReports) {
      blocker += blockersOf(report).length
      const st = managerDisplayStatus(emp, report, state.currentDate)
      if (st === 'missing') draft += 1
      if (st === 'morning_only') morningOnly += 1
      if (st === 'submitted') submitted += 1
      if (st === 'reviewing') reviewing += 1
      if (st === 'done') done += 1
      if (unreflectedCount(report) > 0) unreflected += 1
      if (isAttentionRow(emp, report, state.currentDate)) attention += 1
      if (st === 'submitted' || st === 'reviewing') reviewQueue += 1
    }
    return {
      blocker,
      draft,
      morningOnly,
      submitted,
      reviewing,
      done,
      unreflected,
      attention,
      reviewQueue,
    }
  }, [todayReports, state.currentDate])

  const filtered = todayReports.filter(({ emp, report }) => {
    const st = managerDisplayStatus(emp, report, state.currentDate)
    if (filter === 'all') return true
    if (filter === 'attention') return isAttentionRow(emp, report, state.currentDate)
    if (filter === 'review_queue') return st === 'submitted' || st === 'reviewing'
    if (filter === 'blocker') return blockersOf(report).length > 0
    if (filter === 'draft') return st === 'missing' || st === 'revision'
    if (filter === 'unreflected') return unreflectedCount(report) > 0
    if (filter === 'submitted') return st === 'submitted' || st === 'morning_only'
    return st === filter
  })

  const sorted = [...filtered].sort((a, b) => {
    const score = (emp: typeof a.emp, report: DailyReport) => {
      let s = 0
      if (blockersOf(report).length) s += 100
      if (unreflectedCount(report)) s += 50
      const st = managerDisplayStatus(emp, report, state.currentDate)
      if (st === 'missing') s += 40
      if (st === 'morning_only') s += 35
      if (st === 'revision') s += 30
      if (st === 'submitted' || st === 'reviewing') s += 20
      s += maxCarry(report)
      return s
    }
    return score(b.emp, b.report) - score(a.emp, a.report)
  })

  // Keep selection in filtered set
  useEffect(() => {
    if (!sorted.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !sorted.some((r) => r.report.id === selectedId)) {
      setSelectedId(sorted[0].report.id)
    }
  }, [sorted, selectedId])

  const selected = sorted.find((r) => r.report.id === selectedId) ?? null
  const pushText = selected ? composeChatSummary(selected.emp, selected.report) : ''

  const selectRow = (reportId: string, report: DailyReport) => {
    setSelectedId(reportId)
    if (report.status === 'submitted') setReportStatus(reportId, 'reviewing')
  }

  const goNextInQueue = () => {
    const queue = todayReports
      .filter(({ emp, report }) => {
        const st = managerDisplayStatus(emp, report, state.currentDate)
        return st === 'submitted' || st === 'reviewing'
      })
      .sort((a, b) => maxCarry(b.report) - maxCarry(a.report))
    if (!queue.length) {
      showToast('검토 대기 건이 없습니다.')
      return
    }
    const idx = queue.findIndex((q) => q.report.id === selectedId)
    const next = queue[(idx + 1) % queue.length]
    setFilter('review_queue')
    selectRow(next.report.id, next.report)
  }

  const applyFilter = (key: FilterKey) => {
    const next = filter === key && key !== 'attention' ? 'attention' : key
    setFilter(next)
    if (key === 'blocker') {
      const first = todayReports.find(({ report }) => blockersOf(report).length > 0)
      if (first) selectRow(first.report.id, first.report)
    }
  }

  return (
    <div className="page page-wide page-manager">
      <div className="page-header">
        <div>
          <h1>일일업무보고</h1>
          <p>조치 필요 건을 우선 확인 · {state.currentDate}</p>
        </div>
        {selected && (
          <button type="button" className="btn btn-outline btn-sm" onClick={goNextInQueue}>
            다음 →
          </button>
        )}
      </div>

      <div className="progress-duo">
        <div className="panel panel-pad progress-card">
          <div className="progress-head">
            <strong>오전 계획</strong>
            <span>
              {progress.morning}/{progress.total} ({progress.morningPct}%)
              {progress.ooo > 0 ? ` · 부재 ${progress.ooo}` : ''}
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill morning" style={{ width: `${progress.morningPct}%` }} />
          </div>
        </div>
        <div className="panel panel-pad progress-card">
          <div className="progress-head">
            <strong>저녁 마감</strong>
            <span>
              {progress.evening}/{progress.total} ({progress.eveningPct}%)
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill evening" style={{ width: `${progress.eveningPct}%` }} />
          </div>
        </div>
      </div>

      <div className="chip-row chip-scroll">
        <button
          type="button"
          className={`filter-chip ${filter === 'attention' ? 'active' : ''}`}
          onClick={() => applyFilter('attention')}
        >
          조치 필요 <span className="count">{counts.attention}</span>
        </button>
        <button
          type="button"
          className={`filter-chip blocker ${filter === 'blocker' ? 'active' : ''}`}
          onClick={() => applyFilter('blocker')}
        >
          오늘 블로커 <span className="count">{counts.blocker}</span>
        </button>
        <button
          type="button"
          className={`filter-chip ${filter === 'review_queue' ? 'active' : ''}`}
          onClick={() => applyFilter('review_queue')}
        >
          검토 대기 <span className="count">{counts.reviewQueue}</span>
        </button>
        <button
          type="button"
          className={`filter-chip ${filter === 'unreflected' ? 'active' : ''}`}
          onClick={() => applyFilter('unreflected')}
        >
          미반영 <span className="count">{counts.unreflected}</span>
        </button>
        <button
          type="button"
          className={`filter-chip ${filter === 'draft' ? 'active' : ''}`}
          onClick={() => applyFilter('draft')}
        >
          미제출 <span className="count">{counts.draft}</span>
        </button>
        <button
          type="button"
          className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
          onClick={() => applyFilter('all')}
        >
          전체
        </button>
      </div>

      <div className={`manager-layout ${selected ? '' : 'no-side'}`}>
        {/* Desktop table */}
        <div className="panel table-wrap desktop-only">
          <table className="table table-dense">
            <thead>
              <tr>
                <th>구성원</th>
                <th>요약</th>
                <th>신호</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <div className="empty">해당 필터에 없습니다.</div>
                  </td>
                </tr>
              )}
              {sorted.map(({ emp, report }) => {
                const st = managerDisplayStatus(emp, report, state.currentDate)
                const planSummary =
                  report.plan[0]?.text ??
                  report.execution[0]?.text ??
                  report.carryover[0]?.text ??
                  '—'
                const carry = maxCarry(report)
                const blockers = blockersOf(report).length
                const unref = unreflectedCount(report)
                return (
                  <tr
                    key={report.id}
                    className={`clickable row-bar ${rowBarClass(emp, report, state.currentDate, st)} ${selected?.report.id === report.id ? 'selected' : ''}`}
                    onClick={() => selectRow(report.id, report)}
                  >
                    <td>
                      <div className="person">
                        <div className="avatar">{emp.initials}</div>
                        <div>
                          <div className="name">
                            {emp.name}
                            {st === 'ooo' && (
                              <span className="badge badge-revision" style={{ marginLeft: 6 }}>
                                부재
                              </span>
                            )}
                          </div>
                          <div className="role">
                            {emp.dept}
                            <span className="am-pm inline">
                              <span className={`mini-pill ${isMorningDone(report) ? 'on' : ''}`}>
                                오전
                              </span>
                              <span className={`mini-pill ${isEveningDone(report) ? 'on' : ''}`}>
                                오후
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="summary-cell">{planSummary}</td>
                    <td>
                      <div className="signal-cell">
                        {blockers > 0 && (
                          <span className="badge badge-blocker" title="블로커">
                            B{blockers}
                          </span>
                        )}
                        {carry >= 3 && (
                          <span className="badge badge-carry warn" title={`연속이월 ${carry}일`}>
                            ↻{carry}
                          </span>
                        )}
                        {unref > 0 && (
                          <span className="badge badge-revision" title="미반영 지시">
                            !{unref}
                          </span>
                        )}
                        {!blockers && carry < 3 && !unref && <span className="hint">—</span>}
                      </div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="status-actions">
                        <span className={`status-pill status-${MANAGER_STATUS_KO[st]}`}>
                          {MANAGER_STATUS_KO[st]}
                        </span>
                        {st === 'ooo' ? (
                          <span className="hint">리마인드 스킵</span>
                        ) : (
                          (st === 'missing' || st === 'morning_only' || st === 'revision') && (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => remind(emp.id)}
                            >
                              리마인드
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="mobile-cards mobile-only">
          {sorted.map(({ emp, report }) => {
            const st = managerDisplayStatus(emp, report, state.currentDate)
            return (
              <button
                type="button"
                key={report.id}
                className={`mgr-card row-bar ${rowBarClass(emp, report, state.currentDate, st)} ${selected?.report.id === report.id ? 'selected' : ''}`}
                onClick={() => selectRow(report.id, report)}
              >
                <div className="person">
                  <div className="avatar">{emp.initials}</div>
                  <div>
                    <div className="name">{emp.name}</div>
                    <div className="role">{MANAGER_STATUS_KO[st]}</div>
                  </div>
                </div>
                {blockersOf(report).length > 0 && (
                  <span className="badge badge-blocker">블로커</span>
                )}
              </button>
            )
          })}
        </div>

        {selected && (
          <aside className="side-panel">
            <div className="panel side-panel-inner">
              <div className="side-header">
                <div className="person">
                  <div className="avatar">{selected.emp.initials}</div>
                  <div>
                    <div className="name">{selected.emp.name}</div>
                    <div className="role">
                      {selected.emp.dept} · {selected.emp.role}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    title="주간에서 보기"
                    onClick={() => setView('weekly')}
                  >
                    주간
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSelectedId(null)}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="side-body">
                {unreflectedCount(selected.report) > 0 && (
                  <div className="unreflected-alert">
                    <strong>미반영 지시 {unreflectedCount(selected.report)}건</strong>
                    <ul>
                      {selected.report.instructions
                        .filter((i) => i.reflect === 'unreflected')
                        .map((i) => (
                          <li key={i.id}>
                            [{i.date}] {i.text}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                <div className="side-section">
                  <h3>계획</h3>
                  {selected.report.plan.length === 0 ? (
                    <div className="hint">남은 계획 없음</div>
                  ) : (
                    <ul>
                      {selected.report.plan.map((p) => (
                        <li key={p.id}>{p.text}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="side-section">
                  <h3>실행</h3>
                  <ul>
                    {selected.report.execution.map((x) => (
                      <li key={x.id}>
                        {x.text}{' '}
                        {x.status === 'done' && <span className="badge badge-done">완료</span>}
                        {x.status === 'in_progress' && (
                          <span className="badge badge-progress">진행</span>
                        )}
                        {x.isAdHoc && <span className="ad-hoc-tag">계획 외</span>}
                      </li>
                    ))}
                  </ul>
                </div>

                {selected.report.carryover.length > 0 && (
                  <div className="side-section">
                    <h3>연속이월</h3>
                    <ul>
                      {selected.report.carryover.map((c) => (
                        <li key={c.id}>
                          {c.text}{' '}
                          {(c.consecutiveDays ?? 0) >= 3 && (
                            <span className="badge badge-carry warn">
                              연속 {c.consecutiveDays}일
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {blockersOf(selected.report).map((b) => (
                  <div className="blocker-alert" key={b.id} style={{ marginBottom: 8 }}>
                    <strong>블로커</strong> — {b.text}
                    <div style={{ marginTop: 4, fontWeight: 400 }}>
                      {b.blockerReason}
                      {b.supportRequest ? ` · 요청: ${b.supportRequest}` : ''}
                    </div>
                  </div>
                ))}
              </div>

              <div className="side-actions">
                <div className="ack-row">
                  <button
                    type="button"
                    className={`btn btn-ghost ${selected.report.managerAck === 'thumbsup' ? 'ack-on' : ''}`}
                    onClick={() => setManagerAck(selected.report.id, 'thumbsup')}
                  >
                    👍
                  </button>
                  <button
                    type="button"
                    className={`btn btn-ghost ${selected.report.managerAck === 'confirmed' ? 'ack-on' : ''}`}
                    onClick={() => setManagerAck(selected.report.id, 'confirmed')}
                  >
                    확인
                  </button>
                  <div className="more-wrap">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setMoreOpen((m) => !m)}
                    >
                      ⋯
                    </button>
                    {moreOpen && (
                      <div className="more-menu">
                        <button
                          type="button"
                          onClick={() => {
                            setPushOpen(true)
                            setMoreOpen(false)
                          }}
                        >
                          채팅 푸시…
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {pushOpen && (
                  <div style={{ marginBottom: 8 }}>
                    <textarea className="push-preview" rows={5} readOnly value={pushText} />
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ marginTop: 4 }}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(pushText)
                          showToast('복사했습니다.')
                        } catch {
                          showToast('복사 실패')
                        }
                      }}
                    >
                      복사
                    </button>
                  </div>
                )}

                <div className="field">
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)' }}>
                    지시 남기기
                  </label>
                  <textarea
                    rows={2}
                    placeholder="지시·피드백"
                    value={instructionText}
                    onChange={(e) => setInstructionText(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    leaveInstruction(selected.report.id, instructionText)
                    setInstructionText('')
                  }}
                >
                  지시 저장
                </button>
                <div className="field">
                  <input
                    placeholder="보완요청 사유"
                    value={revisionText}
                    onChange={(e) => setRevisionText(e.target.value)}
                  />
                </div>
                <div className="action-row">
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      confirmReport(selected.report.id)
                      goNextInQueue()
                    }}
                  >
                    확인
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ flex: 1 }}
                    onClick={() => {
                      requestRevision(selected.report.id, revisionText)
                      setRevisionText('')
                    }}
                  >
                    보완요청
                  </button>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
