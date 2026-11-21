import { useMemo, useState } from 'react'
import { tryPushWebhook } from '../lib/integrations'
import { composeChatSummary } from '../lib/pushMessage'
import { useStore } from '../store'
import {
  isEveningDone,
  isMorningDone,
  isOooOn,
  type ItemStatus,
  type WorkItem,
} from '../types'

function StatusBadge({ status }: { status?: ItemStatus }) {
  if (!status) return null
  const map = {
    done: ['완료', 'badge-done'],
    in_progress: ['진행', 'badge-progress'],
    blocker: ['블로커', 'badge-blocker'],
  } as const
  const [label, cls] = map[status]
  return <span className={`badge ${cls}`}>{label}</span>
}

function CarryBadge({ days }: { days?: number }) {
  if (!days || days < 1) return null
  const cls = days >= 5 ? 'danger' : days >= 3 ? 'warn' : ''
  return <span className={`badge badge-carry ${cls}`}>연속 {days}일</span>
}

function AttachmentList({ items }: { items: WorkItem['attachments'] }) {
  if (!items.length) return null
  return (
    <>
      {items.map((a) => (
        <span key={a.id} className="att-wrap">
          {a.kind === 'image' && a.url.startsWith('blob:') && (
            <img src={a.url} alt={a.label} className="att-thumb" />
          )}
          <a className="att-chip" href={a.url} target="_blank" rel="noreferrer">
            {a.kind === 'image' ? '🖼' : a.kind === 'file' ? '📎' : '🔗'} {a.label}
            {a.localMeta ? ' · 로컬' : ''}
          </a>
        </span>
      ))}
    </>
  )
}

export function EmployeeForm() {
  const {
    state,
    actingAsEmployeeId,
    getReport,
    checkPlanItem,
    addPlanItem,
    addAdHocExecution,
    updateWorkItem,
    addAttachmentUrl,
    addLocalFileAttachment,
    setInstructionReflect,
    updateReport,
    saveDraft,
    submitPlan,
    submitExecution,
    showToast,
  } = useStore()

  const employee = state.employees.find((e) => e.id === actingAsEmployeeId)
  const report = getReport(actingAsEmployeeId)
  const [planDraft, setPlanDraft] = useState('')
  const [adHocDraft, setAdHocDraft] = useState('')
  const [urlDrafts, setUrlDrafts] = useState<Record<string, string>>({})
  const [pushOpen, setPushOpen] = useState(false)
  const [pushing, setPushing] = useState(false)

  const pushText = useMemo(() => {
    if (!employee || !report) return ''
    return composeChatSummary(employee, report)
  }, [employee, report])

  if (!employee || !report) {
    return <div className="empty">선택한 담당자의 당일 보고서가 없습니다.</div>
  }

  const statusLabel: Record<string, string> = {
    draft: '임시저장',
    submitted: '제출됨',
    reviewing: '검토중',
    done: '완료',
    revision: '보완요청',
  }
  const morning = isMorningDone(report)
  const evening = isEveningDone(report)
  const ooo = isOooOn(employee, state.currentDate)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>일일업무보고</h1>
          <p>
            담당자: {employee.name} · {employee.dept} · {state.currentDate} ·{' '}
            {statusLabel[report.status]}
          </p>
        </div>
      </div>

      {ooo && (
        <div className="ooo-banner">
          부재 중 ({employee.ooo?.start} ~ {employee.ooo?.end}
          {employee.ooo?.reason ? ` · ${employee.ooo.reason}` : ''}) — 오늘 제출이 면제됩니다.
        </div>
      )}

      <div className="step-bar panel panel-pad">
        <div className={`step ${morning ? 'done' : 'active'}`}>
          <span className="step-num">1</span>
          <div>
            <strong>오전 계획 제출</strong>
            <div className="hint">
              {report.planSubmittedAt ? `제출 ${report.planSubmittedAt}` : '계획 작성 후 제출'}
            </div>
          </div>
        </div>
        <div className="step-line" />
        <div className={`step ${evening ? 'done' : morning ? 'active' : ''}`}>
          <span className="step-num">2</span>
          <div>
            <strong>저녁 실행·이월 마감</strong>
            <div className="hint">
              {report.execSubmittedAt
                ? `마감 ${report.execSubmittedAt}`
                : morning
                  ? '실행·이월 기록 후 마감'
                  : '오전 제출 후 진행'}
            </div>
          </div>
        </div>
      </div>

      {report.status === 'revision' && report.revisionNote && (
        <div className="revision-banner">
          보완요청: {report.revisionNote}
        </div>
      )}

      <div className="employee-layout">
        <div className="stack">
          {/* Plan */}
          <section className="panel panel-pad">
            <div className="section-title">
              <h2>
                계획{' '}
                <span className="hint">계획 항목을 체크하면 실행으로 자동 이동합니다.</span>
              </h2>
              <span className="hint">전체 {report.plan.length}개</span>
            </div>
            {report.plan.length === 0 && (
              <div className="empty" style={{ padding: 12 }}>
                남은 계획 없음 — 체크한 항목은 실행으로 이동했습니다.
              </div>
            )}
            {report.plan.map((item) => (
              <div className="item-row" key={item.id}>
                <input
                  type="checkbox"
                  aria-label={`${item.text} 실행으로 이동`}
                  onChange={() => checkPlanItem(report.id, item.id)}
                />
                <div>
                  <div className="item-text">{item.text}</div>
                  <div className="item-meta">
                    <AttachmentList items={item.attachments} />
                    {item.hours != null && <span className="hours">{item.hours}h</span>}
                  </div>
                </div>
                <span className="hours">예정</span>
              </div>
            ))}
            <div className="add-row">
              <input
                placeholder="계획 항목 추가…"
                value={planDraft}
                onChange={(e) => setPlanDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addPlanItem(report.id, planDraft)
                    setPlanDraft('')
                  }
                }}
              />
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => {
                  addPlanItem(report.id, planDraft)
                  setPlanDraft('')
                }}
              >
                추가
              </button>
            </div>
          </section>

          {/* Execution */}
          <section className="panel panel-pad">
            <div className="section-title">
              <h2>
                실행 <span className="hint">오늘 수행한 업무를 기록하세요.</span>
              </h2>
            </div>
            {report.execution.map((item) => (
              <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--slate-100)' }}>
                <div className="item-row" style={{ border: 'none', padding: 0 }}>
                  <span />
                  <div>
                    <div className="item-text">
                      {item.text}{' '}
                      {item.isAdHoc && <span className="ad-hoc-tag">계획 외</span>}
                    </div>
                    <div className="item-meta">
                      <StatusBadge status={item.status} />
                      <AttachmentList items={item.attachments} />
                      {item.hours != null && <span className="hours">{item.hours}h</span>}
                    </div>
                    <div className="item-meta" style={{ marginTop: 8 }}>
                      <select
                        className="status-select"
                        value={item.status ?? 'in_progress'}
                        onChange={(e) =>
                          updateWorkItem(report.id, 'execution', item.id, {
                            status: e.target.value as ItemStatus,
                          })
                        }
                      >
                        <option value="done">완료</option>
                        <option value="in_progress">진행</option>
                        <option value="blocker">블로커</option>
                      </select>
                      <input
                        style={{ maxWidth: 180, fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--slate-200)' }}
                        placeholder="첨부 URL…"
                        value={urlDrafts[item.id] ?? ''}
                        onChange={(e) =>
                          setUrlDrafts((d) => ({ ...d, [item.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            addAttachmentUrl(report.id, 'execution', item.id, urlDrafts[item.id] ?? '')
                            setUrlDrafts((d) => ({ ...d, [item.id]: '' }))
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          addAttachmentUrl(report.id, 'execution', item.id, urlDrafts[item.id] ?? '')
                          setUrlDrafts((d) => ({ ...d, [item.id]: '' }))
                        }}
                      >
                        URL 첨부
                      </button>
                      <label className="btn btn-ghost btn-sm file-label">
                        파일
                        <input
                          type="file"
                          accept="image/*,.pdf,.txt,.doc,.docx"
                          hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) addLocalFileAttachment(report.id, 'execution', item.id, f)
                            e.target.value = ''
                          }}
                        />
                      </label>
                    </div>
                    {item.status === 'blocker' && (
                      <div className="blocker-box">
                        <label>
                          사유 (필수)
                          <input
                            value={item.blockerReason ?? ''}
                            onChange={(e) =>
                              updateWorkItem(report.id, 'execution', item.id, {
                                blockerReason: e.target.value,
                              })
                            }
                            placeholder="왜 막혔는지 한 줄로"
                          />
                        </label>
                        <label>
                          지원 요청 (선택)
                          <input
                            value={item.supportRequest ?? ''}
                            onChange={(e) =>
                              updateWorkItem(report.id, 'execution', item.id, {
                                supportRequest: e.target.value,
                              })
                            }
                            placeholder="사장/동료에게 요청할 내용"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="add-row">
              <input
                placeholder="+ 계획 외 실행 추가…"
                value={adHocDraft}
                onChange={(e) => setAdHocDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addAdHocExecution(report.id, adHocDraft)
                    setAdHocDraft('')
                  }
                }}
              />
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => {
                  addAdHocExecution(report.id, adHocDraft)
                  setAdHocDraft('')
                }}
              >
                계획 외
              </button>
            </div>
          </section>

          {/* Carryover */}
          <section className="panel panel-pad">
            <div className="section-title">
              <h2>
                이월 <span className="hint">다음으로 이월된 업무를 관리하세요.</span>
              </h2>
            </div>
            {report.carryover.map((item) => (
              <div className="item-row" key={item.id}>
                <span />
                <div>
                  <div className="item-text">{item.text}</div>
                  <div className="item-meta">
                    <CarryBadge days={item.consecutiveDays} />
                    <StatusBadge status={item.status} />
                    <AttachmentList items={item.attachments} />
                  </div>
                  {item.status === 'blocker' && (
                    <div className="blocker-box">
                      <label>
                        사유
                        <input
                          value={item.blockerReason ?? ''}
                          onChange={(e) =>
                            updateWorkItem(report.id, 'carryover', item.id, {
                              blockerReason: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        지원 요청
                        <input
                          value={item.supportRequest ?? ''}
                          onChange={(e) =>
                            updateWorkItem(report.id, 'carryover', item.id, {
                              supportRequest: e.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                  )}
                  <div className="item-meta" style={{ marginTop: 8 }}>
                    <select
                      className="status-select"
                      value={item.status ?? 'in_progress'}
                      onChange={(e) =>
                        updateWorkItem(report.id, 'carryover', item.id, {
                          status: e.target.value as ItemStatus,
                        })
                      }
                    >
                      <option value="done">완료</option>
                      <option value="in_progress">진행</option>
                      <option value="blocker">블로커</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <div className="form-footer">
            <span className="saved">
              {report.draftSavedAt
                ? `마지막 임시저장: ${report.draftSavedAt}`
                : '아직 임시저장 없음'}
              {report.planSubmittedAt ? ` · 계획: ${report.planSubmittedAt}` : ''}
              {report.execSubmittedAt ? ` · 마감: ${report.execSubmittedAt}` : ''}
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-outline" onClick={() => saveDraft(report.id)}>
                임시저장
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => submitPlan(report.id)}
              >
                {morning ? '계획 재제출' : '계획 제출'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => submitExecution(report.id)}
              >
                실행·이월 마감
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="stack">
          <section className="panel panel-pad">
            <div className="section-title">
              <h2>사장 지시</h2>
            </div>
            <p className="hint" style={{ marginTop: -6, marginBottom: 12 }}>
              오늘 지시사항 반영 여부를 기록하세요.
            </p>
            {report.instructions.length === 0 && (
              <div className="empty" style={{ padding: 8 }}>
                지시 없음
              </div>
            )}
            {report.instructions.map((ins) => (
              <div className="instruction-card" key={ins.id}>
                <div className="date">{ins.date}</div>
                <div className="text">{ins.text}</div>
                <div className="reflect-toggle">
                  <button
                    type="button"
                    className={ins.reflect === 'reflected' ? 'on-reflected' : ''}
                    onClick={() => setInstructionReflect(report.id, ins.id, 'reflected')}
                  >
                    반영됨
                  </button>
                  <button
                    type="button"
                    className={ins.reflect === 'unreflected' ? 'on-unreflected' : ''}
                    onClick={() => setInstructionReflect(report.id, ins.id, 'unreflected')}
                  >
                    미반영
                  </button>
                </div>
              </div>
            ))}
          </section>

          <section className="panel panel-pad">
            <div className="section-title">
              <h2>참고 메모</h2>
            </div>
            <div className="field">
              <textarea
                rows={4}
                placeholder="필요 시 메모를 남겨주세요."
                value={report.memo}
                onChange={(e) => updateReport(report.id, { memo: e.target.value })}
              />
            </div>
          </section>

          <section className="panel panel-pad">
            <div className="section-title">
              <h2>채팅 푸시 초안</h2>
            </div>
            <p className="hint" style={{ marginTop: -4, marginBottom: 10 }}>
              웹훅 설정 시 POST 시도 · 없거나 실패 시 복사 폴백
            </p>
            <button
              type="button"
              className="btn btn-outline"
              style={{ width: '100%', marginBottom: 8 }}
              onClick={() => setPushOpen((o) => !o)}
            >
              {pushOpen ? '미리보기 닫기' : '메시지 미리보기'}
            </button>
            {pushOpen && (
              <>
                <textarea className="push-preview" rows={12} readOnly value={pushText} />
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 8 }}
                  disabled={pushing}
                  onClick={async () => {
                    setPushing(true)
                    const result = await tryPushWebhook(state.settings, pushText)
                    try {
                      await navigator.clipboard.writeText(pushText)
                    } catch {
                      /* ignore */
                    }
                    showToast(result.detail)
                    setPushing(false)
                  }}
                >
                  {pushing ? '전송 중…' : '웹훅 시도 + 복사'}
                </button>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
