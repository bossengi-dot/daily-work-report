import { useMemo, useState } from 'react'
import { composeChatSummary } from '../lib/pushMessage'
import { useStore } from '../store'
import {
  isEveningDone,
  isMorningDone,
  isOooOn,
  type DailyReport,
  type ReportStatus,
  type WorkItem,
} from '../types'

type FilterKey =
  | 'all'
  | 'blocker'
  | 'draft'
  | 'submitted'
  | 'reviewing'
  | 'done'
  | 'unreflected'

const STATUS_KO: Record<ReportStatus, string> = {
  draft: '미제출',
  submitted: '제출',
  reviewing: '검토중',
  done: '완료',
  revision: '보완요청',
}

function blockersOf(report: DailyReport): WorkItem[] {
  return [...report.execution, ...report.carryover].filter((i) => i.status === 'blocker')
}

function pendingCount(report: DailyReport) {
  return [...report.execution, ...report.carryover].filter(
    (i) => i.status === 'in_progress' || i.status === 'blocker',
  ).length
}

function maxCarry(report: DailyReport) {
  return Math.max(0, ...report.carryover.map((c) => c.consecutiveDays ?? 0))
}

function unreflectedCount(report: DailyReport) {
  return report.instructions.filter((i) => i.reflect === 'unreflected').length
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
  } = useStore()

  const [filter, setFilter] = useState<FilterKey>('all')
  const [selectedId, setSelectedId] = useState<string | null>('r1')
  const [instructionText, setInstructionText] = useState('')
  const [revisionText, setRevisionText] = useState('')
  const [pushOpen, setPushOpen] = useState(false)

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
    const active = todayReports.filter(
      ({ emp }) => !isOooOn(emp, state.currentDate),
    )
    const n = active.length || 1
    const morning = active.filter(({ report }) => isMorningDone(report)).length
    const evening = active.filter(({ report }) => isEveningDone(report)).length
    const ooo = todayReports.length - active.length
    return {
      morning,
      evening,
      morningPct: Math.round((morning / n) * 100),
      eveningPct: Math.round((evening / n) * 100),
      total: active.length,
      ooo,
    }
  }, [todayReports, state.currentDate])

  const counts = useMemo(() => {
    let blocker = 0
    let draft = 0
    let submitted = 0
    let reviewing = 0
    let done = 0
    let unreflected = 0
    for (const { report } of todayReports) {
      blocker += blockersOf(report).length
      if (report.status === 'draft' || report.status === 'revision') draft += 1
      if (report.status === 'submitted') submitted += 1
      if (report.status === 'reviewing') reviewing += 1
      if (report.status === 'done') done += 1
      if (unreflectedCount(report) > 0) unreflected += 1
    }
    return { blocker, draft, submitted, reviewing, done, unreflected }
  }, [todayReports])

  const filtered = todayReports.filter(({ report }) => {
    if (filter === 'all') return true
    if (filter === 'blocker') return blockersOf(report).length > 0
    if (filter === 'draft') return report.status === 'draft' || report.status === 'revision'
    if (filter === 'unreflected') return unreflectedCount(report) > 0
    return report.status === filter
  })

  const sorted = [...filtered].sort((a, b) => {
    const ua = unreflectedCount(a.report)
    const ub = unreflectedCount(b.report)
    const ba = blockersOf(a.report).length
    const bb = blockersOf(b.report).length
    if (ub !== ua) return ub - ua
    if (bb !== ba) return bb - ba
    return maxCarry(b.report) - maxCarry(a.report)
  })

  const selected = sorted.find((r) => r.report.id === selectedId) ?? sorted[0] ?? null
  const pushText = selected
    ? composeChatSummary(selected.emp, selected.report)
    : ''

  return (
    <div className="page page-wide">
      <div className="page-header">
        <div>
          <h1>일일업무보고</h1>
          <p>
            팀원의 금일 업무 계획, 진행 및 미결 사항을 한눈에 확인하세요. · {state.currentDate}
          </p>
        </div>
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
            <strong>저녁 실행·이월</strong>
            <span>
              {progress.evening}/{progress.total} ({progress.eveningPct}%)
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill evening" style={{ width: `${progress.eveningPct}%` }} />
          </div>
        </div>
      </div>

      <div className="chip-row">
        <button
          type="button"
          className={`filter-chip blocker ${filter === 'blocker' ? 'active' : ''}`}
          onClick={() => setFilter(filter === 'blocker' ? 'all' : 'blocker')}
        >
          오늘 블로커 <span className="count">{counts.blocker}</span>
        </button>
        <button
          type="button"
          className={`filter-chip ${filter === 'unreflected' ? 'active' : ''}`}
          onClick={() => setFilter(filter === 'unreflected' ? 'all' : 'unreflected')}
        >
          미반영 지시 <span className="count">{counts.unreflected}</span>
        </button>
        <button
          type="button"
          className={`filter-chip ${filter === 'draft' ? 'active' : ''}`}
          onClick={() => setFilter(filter === 'draft' ? 'all' : 'draft')}
        >
          미제출 <span className="count">{counts.draft}</span>
        </button>
        <button
          type="button"
          className={`filter-chip ${filter === 'submitted' ? 'active' : ''}`}
          onClick={() => setFilter(filter === 'submitted' ? 'all' : 'submitted')}
        >
          제출 <span className="count">{counts.submitted}</span>
        </button>
        <button
          type="button"
          className={`filter-chip ${filter === 'reviewing' ? 'active' : ''}`}
          onClick={() => setFilter(filter === 'reviewing' ? 'all' : 'reviewing')}
        >
          검토중 <span className="count">{counts.reviewing}</span>
        </button>
        <button
          type="button"
          className={`filter-chip ${filter === 'done' ? 'active' : ''}`}
          onClick={() => setFilter(filter === 'done' ? 'all' : 'done')}
        >
          완료 <span className="count">{counts.done}</span>
        </button>
      </div>

      <div className={`manager-layout ${selected ? '' : 'no-side'}`}>
        <div className="panel" style={{ overflow: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>구성원</th>
                <th>오전/오후</th>
                <th>계획요약</th>
                <th>미결</th>
                <th>연속이월</th>
                <th>상태</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty">해당 필터에 보고서가 없습니다.</div>
                  </td>
                </tr>
              )}
              {sorted.map(({ emp, report }) => {
                const planSummary =
                  report.plan[0]?.text ??
                  report.execution[0]?.text ??
                  report.carryover[0]?.text ??
                  '—'
                const carry = maxCarry(report)
                const unref = unreflectedCount(report)
                return (
                  <tr
                    key={report.id}
                    className={`clickable ${selected?.report.id === report.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedId(report.id)
                      if (report.status === 'submitted') {
                        setReportStatus(report.id, 'reviewing')
                      }
                    }}
                  >
                    <td>
                      <div className="person">
                        <div className="avatar">{emp.initials}</div>
                        <div>
                          <div className="name">
                            {emp.name}
                            {isOooOn(emp, state.currentDate) && (
                              <span className="badge badge-revision" style={{ marginLeft: 6 }}>
                                부재
                              </span>
                            )}
                            {unref > 0 && (
                              <span
                                className="warn-dot"
                                title={`미반영 지시 ${unref}건`}
                                aria-label="미반영 지시"
                              />
                            )}
                          </div>
                          <div className="role">
                            {emp.dept} · {emp.role}
                            {emp.ooo && isOooOn(emp, state.currentDate)
                              ? ` · ${emp.ooo.reason ?? 'OOO'}`
                              : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="am-pm">
                        <span className={`mini-pill ${isMorningDone(report) ? 'on' : ''}`}>
                          오전
                        </span>
                        <span className={`mini-pill ${isEveningDone(report) ? 'on' : ''}`}>
                          오후
                        </span>
                      </div>
                    </td>
                    <td style={{ maxWidth: 220 }}>
                      <div
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {planSummary}
                      </div>
                      {blockersOf(report).length > 0 && (
                        <span className="badge badge-blocker" style={{ marginTop: 4 }}>
                          블로커 {blockersOf(report).length}
                        </span>
                      )}
                    </td>
                    <td>{pendingCount(report)}</td>
                    <td>
                      <span className={carry >= 3 ? 'consec-warn' : ''}>{carry || '—'}</span>
                    </td>
                    <td>
                      <span className={`status-pill status-${STATUS_KO[report.status]}`}>
                        {STATUS_KO[report.status]}
                      </span>
                      {report.managerAck === 'thumbsup' && (
                        <span style={{ marginLeft: 4 }}>👍</span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {isOooOn(emp, state.currentDate) ? (
                        <span className="hint">리마인드 스킵</span>
                      ) : (
                        (!isEveningDone(report) ||
                          report.status === 'draft' ||
                          report.status === 'revision') && (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => remind(emp.id)}
                          >
                            리마인드
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {selected && (
          <aside className="side-panel">
            <div className="panel">
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
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedId(null)}
                >
                  ✕
                </button>
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
                    <div className="hint">남은 계획 없음 (실행으로 이동됨)</div>
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
                        {x.attachments.map((a) => (
                          <a
                            key={a.id}
                            className="att-chip"
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {a.label}
                          </a>
                        ))}
                      </li>
                    ))}
                  </ul>
                </div>

                {selected.report.carryover.length > 0 && (
                  <div className="side-section">
                    <h3>연속이월 ({selected.report.carryover.length})</h3>
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

                <div className="side-section">
                  <h3>가벼운 반응</h3>
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
                  </div>
                  <p className="hint" style={{ marginTop: 6 }}>
                    이모지/확인만으로 검토 완료 처리됩니다.
                  </p>
                </div>

                <div className="side-section">
                  <h3>채팅 푸시 미리보기</h3>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setPushOpen((o) => !o)}
                  >
                    {pushOpen ? '닫기' : '메시지 보기'}
                  </button>
                  {pushOpen && (
                    <>
                      <textarea
                        className="push-preview"
                        rows={8}
                        readOnly
                        value={pushText}
                        style={{ marginTop: 8 }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: 6 }}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(pushText)
                            showToast('클립보드에 복사했습니다.')
                          } catch {
                            showToast('복사 실패 — 텍스트를 직접 선택해 주세요.')
                          }
                        }}
                      >
                        복사
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="side-actions">
                <div className="field">
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-600)' }}>
                    지시 남기기
                  </label>
                  <textarea
                    rows={2}
                    placeholder="지시사항이나 피드백을 입력하세요."
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
                    placeholder="보완요청 시 사유 필수"
                    value={revisionText}
                    onChange={(e) => setRevisionText(e.target.value)}
                  />
                </div>
                <div className="action-row">
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => confirmReport(selected.report.id)}
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
