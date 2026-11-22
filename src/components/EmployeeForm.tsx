'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { copyText } from '../lib/clipboard'
import { isSafeAttachmentUrl } from '../lib/safeUrl'
import { composeChatSummary } from '../lib/pushMessage'
import { employeeStatusLabel } from '../lib/statusLabels'
import { useStore } from '../store'
import {
  isEveningDone,
  isMorningDone,
  isOooOn,
  type ItemStatus,
  type WorkItem,
} from '../types'

function CarryBadge({ days }: { days?: number }) {
  if (!days || days < 1) return null
  const cls = days >= 5 ? 'danger' : days >= 3 ? 'warn' : ''
  return <span className={`badge badge-carry ${cls}`}>연속 {days}일</span>
}

function AttachmentList({ items }: { items: WorkItem['attachments'] }) {
  if (!items.length) return null
  return (
    <>
      {items.map((a) => {
        const safe = isSafeAttachmentUrl(a.url)
        return (
          <span key={a.id} className="att-wrap">
            {a.kind === 'image' && a.url.startsWith('blob:') && (
              <img src={a.url} alt={a.label} className="att-thumb" />
            )}
            {safe ? (
              <a className="att-chip" href={a.url} target="_blank" rel="noreferrer">
                {a.kind === 'image' ? '이미지' : a.kind === 'file' ? '파일' : '링크'} {a.label}
                {a.localMeta ? ' · 로컬' : ''}
              </a>
            ) : (
              <span className="att-chip" title="안전하지 않은 링크">
                차단됨 {a.label}
              </span>
            )}
          </span>
        )
      })}
    </>
  )
}

function StatusSegment({
  value,
  onChange,
}: {
  value: ItemStatus
  onChange: (s: ItemStatus) => void
}) {
  const opts: { v: ItemStatus; label: string }[] = [
    { v: 'done', label: '완료' },
    { v: 'in_progress', label: '진행' },
    { v: 'blocker', label: '블로커' },
  ]
  return (
    <div className="seg" role="group" aria-label="상태">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          className={`seg-btn ${value === o.v ? `on on-${o.v}` : ''}`}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function AttachPopover({
  reportId,
  section,
  itemId,
  attachments,
}: {
  reportId: string
  section: 'execution' | 'carryover'
  itemId: string
  attachments: WorkItem['attachments']
}) {
  const { addAttachmentUrl, addLocalFileAttachment } = useStore()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="attach-pop" ref={ref}>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>
        ⋯ 첨부{attachments.length ? ` (${attachments.length})` : ''}
      </button>
      {open && (
        <div className="attach-pop-panel">
          <AttachmentList items={attachments} />
          <div className="attach-pop-row">
            <input
              placeholder="URL…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addAttachmentUrl(reportId, section, itemId, url)
                  setUrl('')
                }
              }}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                addAttachmentUrl(reportId, section, itemId, url)
                setUrl('')
              }}
            >
              URL
            </button>
            <label className="btn btn-ghost btn-sm file-label">
              파일
              <input
                type="file"
                accept="image/*,.pdf,.txt,.doc,.docx"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) addLocalFileAttachment(reportId, section, itemId, f)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        </div>
      )}
    </div>
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
  const [pushOpen, setPushOpen] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [moreMenu, setMoreMenu] = useState(false)
  const [highlightBlockerId, setHighlightBlockerId] = useState<string | null>(null)
  const [planCollapsed, setPlanCollapsed] = useState(false)
  const [execCollapsed, setExecCollapsed] = useState(false)
  const instrRef = useRef<HTMLDivElement>(null)
  const pushPreviewRef = useRef<HTMLTextAreaElement>(null)

  const pushText = useMemo(() => {
    if (!employee || !report) return ''
    return composeChatSummary(employee, report)
  }, [employee, report])

  const morning = report ? isMorningDone(report) : false
  const evening = report ? isEveningDone(report) : false

  useEffect(() => {
    // collapse inactive phase by default once morning done
    if (morning && !evening) {
      setPlanCollapsed(true)
      setExecCollapsed(false)
    } else if (!morning) {
      setPlanCollapsed(false)
      setExecCollapsed(true)
    } else {
      setPlanCollapsed(false)
      setExecCollapsed(false)
    }
  }, [morning, evening, actingAsEmployeeId])

  if (!employee || !report) {
    return <div className="empty">선택한 담당자의 당일 보고서가 없습니다.</div>
  }

  const ooo = isOooOn(employee, state.currentDate)
  const unreflected = report.instructions.filter((i) => i.reflect === 'unreflected')
  const phase: 'morning' | 'evening' | 'done' = evening
    ? 'done'
    : morning
      ? 'evening'
      : 'morning'
  const missingBlockerReason = [...report.execution, ...report.carryover].some(
    (i) => i.status === 'blocker' && !i.blockerReason?.trim(),
  )

  const handleExecSubmit = () => {
    void submitExecution(report.id).then((result) => {
      if (!result.ok && result.blockerItemId) {
        setHighlightBlockerId(result.blockerItemId)
        requestAnimationFrame(() => {
          const el = document.querySelector(
            `[data-blocker-item="${result.blockerItemId}"]`,
          )
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
        window.setTimeout(() => setHighlightBlockerId(null), 2800)
      }
    })
  }

  return (
    <div className="page page-employee">
      <div className="page-header">
        <div>
          <h1>일일업무보고</h1>
          <p>
            {employee.name} · {employee.dept} · {state.currentDate} ·{' '}
            {employeeStatusLabel(report)}
          </p>
        </div>
      </div>

      {ooo && (
        <div className="ooo-banner">
          부재 중 ({employee.ooo?.start} ~ {employee.ooo?.end}
          {employee.ooo?.reason ? ` · ${employee.ooo.reason}` : ''}) — 오늘 제출이 면제됩니다.
        </div>
      )}

      {unreflected.length > 0 && (
        <button
          type="button"
          className="sticky-chip"
          onClick={() => instrRef.current?.scrollIntoView({ behavior: 'smooth' })}
        >
          미반영 지시 {unreflected.length}
        </button>
      )}

      {report.status === 'revision' && report.revisionNote && (
        <div className="revision-banner">보완요청: {report.revisionNote}</div>
      )}

      <div className="step-bar panel panel-pad">
        <div className={`step ${morning ? 'done' : 'active'}`}>
          <span className="step-num">1</span>
          <div>
            <strong>오전 계획</strong>
            <div className="hint">
              {report.planSubmittedAt ? `제출 ${report.planSubmittedAt}` : '계획 작성 후 제출'}
            </div>
          </div>
        </div>
        <div className="step-line" />
        <div className={`step ${evening ? 'done' : morning ? 'active' : ''}`}>
          <span className="step-num">2</span>
          <div>
            <strong>저녁 마감</strong>
            <div className="hint">
              {report.execSubmittedAt
                ? `마감 ${report.execSubmittedAt}`
                : morning
                  ? '실행·이월 후 마감'
                  : '오전 제출 후'}
            </div>
          </div>
        </div>
      </div>

      <div className="employee-layout">
        <div className="stack">
          {/* Plan */}
          <section
            className={`panel panel-pad phase-panel ${phase === 'morning' ? 'active-phase' : ''} ${planCollapsed ? 'collapsed' : ''}`}
          >
            <div className="section-title">
              <h2>
                계획{' '}
                <span className="hint" title="체크 시 실행으로 이동">
                  ⓘ
                </span>
              </h2>
              <div className="section-actions">
                <span className="hint">{report.plan.length}개</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPlanCollapsed((c) => !c)}
                >
                  {planCollapsed ? '펼치기' : '접기'}
                </button>
              </div>
            </div>
            {!planCollapsed && (
              <>
                {report.plan.length === 0 && (
                  <div className="empty" style={{ padding: 12 }}>
                    남은 계획 없음
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
              </>
            )}
            {planCollapsed && (
              <div className="hint">계획 {report.plan.length}개 · 클릭해 펼치기</div>
            )}
          </section>

          {/* Execution */}
          <section
            className={`panel panel-pad phase-panel ${phase === 'evening' || phase === 'done' ? 'active-phase' : ''} ${execCollapsed ? 'collapsed' : ''}`}
          >
            <div className="section-title">
              <h2>
                실행 <span className="hint" title="오늘 수행 기록">ⓘ</span>
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setExecCollapsed((c) => !c)}
              >
                {execCollapsed ? '펼치기' : '접기'}
              </button>
            </div>
            {!execCollapsed && (
              <>
                {report.execution.map((item) => (
                  <div
                    key={item.id}
                    className={`exec-row ${highlightBlockerId === item.id ? 'blocker-flash' : ''}`}
                    data-blocker-item={item.status === 'blocker' ? item.id : undefined}
                  >
                    <div className="item-text">
                      {item.text} {item.isAdHoc && <span className="ad-hoc-tag">계획 외</span>}
                    </div>
                    <div className="item-meta">
                      <StatusSegment
                        value={item.status ?? 'in_progress'}
                        onChange={(s) =>
                          updateWorkItem(report.id, 'execution', item.id, { status: s })
                        }
                      />
                      {item.hours != null && <span className="hours">{item.hours}h</span>}
                      <AttachPopover
                        reportId={report.id}
                        section="execution"
                        itemId={item.id}
                        attachments={item.attachments}
                      />
                    </div>
                    <AttachmentList items={item.attachments} />
                    {item.status === 'blocker' && (
                      <div
                        className={`blocker-box ${highlightBlockerId === item.id ? 'blocker-flash' : ''}`}
                        data-blocker-item={item.id}
                      >
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
                            autoFocus={highlightBlockerId === item.id}
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
                ))}
                <div className="add-row">
                  <input
                    placeholder="+ 계획 외 실행…"
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
              </>
            )}
          </section>

          {/* Carryover */}
          <section
            className={`panel panel-pad phase-panel ${phase === 'evening' || phase === 'done' ? 'active-phase' : ''} ${execCollapsed ? 'collapsed' : ''}`}
          >
            <div className="section-title">
              <h2>이월</h2>
            </div>
            {!execCollapsed &&
              report.carryover.map((item) => (
                <div
                  className={`exec-row ${highlightBlockerId === item.id ? 'blocker-flash' : ''}`}
                  key={item.id}
                  data-blocker-item={item.status === 'blocker' ? item.id : undefined}
                >
                  <div className="item-text">{item.text}</div>
                  <div className="item-meta">
                    <CarryBadge days={item.consecutiveDays} />
                    <StatusSegment
                      value={item.status ?? 'in_progress'}
                      onChange={(s) =>
                        updateWorkItem(report.id, 'carryover', item.id, { status: s })
                      }
                    />
                    <AttachPopover
                      reportId={report.id}
                      section="carryover"
                      itemId={item.id}
                      attachments={item.attachments}
                    />
                  </div>
                  {item.status === 'blocker' && (
                    <div
                      className={`blocker-box ${highlightBlockerId === item.id ? 'blocker-flash' : ''}`}
                      data-blocker-item={item.id}
                    >
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
                </div>
              ))}
          </section>

          <div className="form-footer sticky-cta">
            <span className="saved">
              {report.draftSavedAt ? `임시저장 ${report.draftSavedAt}` : ''}
              {report.planSubmittedAt ? ` · 계획 ${report.planSubmittedAt}` : ''}
              {report.execSubmittedAt ? ` · 마감 ${report.execSubmittedAt}` : ''}
            </span>
            <div className="cta-group">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => saveDraft(report.id)}
              >
                임시저장
              </button>
              <div className="more-wrap">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setMoreMenu((m) => !m)}
                  aria-label="더보기"
                >
                  ⋯
                </button>
                {moreMenu && (
                  <div className="more-menu">
                    {morning && (
                      <button
                        type="button"
                        onClick={() => {
                          submitPlan(report.id)
                          setMoreMenu(false)
                        }}
                      >
                        계획 재제출
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setPushOpen(true)
                        setMoreMenu(false)
                        requestAnimationFrame(() =>
                          document
                            .getElementById('push-panel')
                            ?.scrollIntoView({ behavior: 'smooth' }),
                        )
                      }}
                    >
                      채팅 푸시…
                    </button>
                  </div>
                )}
              </div>
              {phase === 'morning' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => submitPlan(report.id)}
                >
                  계획 제출
                </button>
              )}
              {phase === 'evening' && (
                <button
                  type="button"
                  className={`btn btn-primary ${missingBlockerReason ? 'btn-warn-dot' : ''}`}
                  onClick={handleExecSubmit}
                >
                  실행·이월 마감
                </button>
              )}
              {phase === 'done' && (
                <button type="button" className="btn btn-outline" disabled>
                  마감 완료
                </button>
              )}
            </div>
          </div>
        </div>

        <aside className="stack">
          <div ref={instrRef}>
          <section className="panel panel-pad">
            <div className="section-title">
              <h2>사장 지시</h2>
            </div>
            <p className="hint" style={{ marginTop: -6, marginBottom: 12 }}>
              반영 여부를 기록하세요.
            </p>
            {report.instructions.length === 0 && (
              <div className="empty" style={{ padding: 8 }}>
                지시 없음
              </div>
            )}
            {report.instructions.map((ins) => (
              <div className="instruction-card" key={ins.id} id={`instr-${ins.id}`}>
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
          </div>

          <section className="panel panel-pad">
            <div className="section-title">
              <h2>참고 메모</h2>
            </div>
            <div className="field">
              <textarea
                rows={3}
                placeholder="필요 시 메모"
                value={report.memo}
                onChange={(e) => updateReport(report.id, { memo: e.target.value })}
              />
            </div>
          </section>

          <section className="panel panel-pad" id="push-panel">
            <div className="section-title">
              <h2>채팅 푸시</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setPushOpen((o) => !o)}
              >
                {pushOpen ? '접기' : '펼치기'}
              </button>
            </div>
            {pushOpen && (
              <>
                <p className="hint" style={{ marginBottom: 8 }}>
                  요약 복사. 서버 웹훅(NW_WEBHOOK_URL)이 있으면 관리자 API로만 전송합니다.
                </p>
                <textarea
                  ref={pushPreviewRef}
                  className="push-preview"
                  rows={10}
                  readOnly
                  value={pushText}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 8 }}
                  disabled={pushing}
                  onClick={async () => {
                    setPushing(true)
                    const ok = await copyText(pushText, {
                      selectElement: pushPreviewRef.current,
                    })
                    showToast(
                      ok
                        ? '요약을 클립보드에 복사했습니다.'
                        : '복사 실패 — 텍스트를 직접 선택해 주세요.',
                    )
                    setPushing(false)
                  }}
                >
                  {pushing ? '처리 중…' : '요약 복사'}
                </button>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
