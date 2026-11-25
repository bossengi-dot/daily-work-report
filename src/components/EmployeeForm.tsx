'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { WorkSection } from '../lib/carryover'
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

/** Local-buffered text so server round-trips do not steal focus/cursor. */
function EditableItemText({
  value,
  onCommit,
  placeholder,
}: {
  value: string
  onCommit: (text: string) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState(value)
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setDraft(value)
  }, [value])

  return (
    <input
      className="item-text-input"
      value={draft}
      placeholder={placeholder ?? '업무 내용'}
      onFocus={() => {
        focused.current = true
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        focused.current = false
        const next = draft.trim()
        if (next && next !== value) onCommit(next)
        else setDraft(value)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          ;(e.target as HTMLInputElement).blur()
        }
      }}
    />
  )
}

function BlockerFields({
  reason,
  support,
  onCommitReason,
  onCommitSupport,
  highlight,
  autoFocus,
}: {
  reason: string
  support: string
  onCommitReason: (v: string) => void
  onCommitSupport: (v: string) => void
  highlight?: boolean
  autoFocus?: boolean
}) {
  const [reasonDraft, setReasonDraft] = useState(reason)
  const [supportDraft, setSupportDraft] = useState(support)
  const reasonFocused = useRef(false)
  const supportFocused = useRef(false)

  useEffect(() => {
    if (!reasonFocused.current) setReasonDraft(reason)
  }, [reason])
  useEffect(() => {
    if (!supportFocused.current) setSupportDraft(support)
  }, [support])

  return (
    <div className={`blocker-box ${highlight ? 'blocker-flash' : ''}`}>
      <label>
        사유 (필수)
        <input
          value={reasonDraft}
          autoFocus={autoFocus}
          placeholder="왜 막혔는지 한 줄로"
          onFocus={() => {
            reasonFocused.current = true
          }}
          onChange={(e) => setReasonDraft(e.target.value)}
          onBlur={() => {
            reasonFocused.current = false
            if (reasonDraft !== reason) onCommitReason(reasonDraft)
          }}
        />
      </label>
      <label>
        지원 요청 (선택)
        <input
          value={supportDraft}
          placeholder="사장/동료에게 요청할 내용"
          onFocus={() => {
            supportFocused.current = true
          }}
          onChange={(e) => setSupportDraft(e.target.value)}
          onBlur={() => {
            supportFocused.current = false
            if (supportDraft !== support) onCommitSupport(supportDraft)
          }}
        />
      </label>
    </div>
  )
}

type SectionTarget = 'plan' | 'progress' | 'execution'

function StatusControls({
  section,
  status,
  onSection,
  onBlocker,
}: {
  section: WorkSection
  status?: ItemStatus
  onSection: (to: SectionTarget) => void
  onBlocker: () => void
}) {
  const opts: { v: SectionTarget | 'blocker'; label: string; active: boolean }[] = [
    { v: 'plan', label: '계획', active: section === 'plan' && status !== 'blocker' },
    {
      v: 'progress',
      label: '진행',
      active: section === 'progress' && status !== 'blocker',
    },
    {
      v: 'execution',
      label: '완료',
      active: section === 'execution' && status === 'done',
    },
    { v: 'blocker', label: '블로커', active: status === 'blocker' },
  ]
  return (
    <div className="seg" role="group" aria-label="상태">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          className={`seg-btn ${o.active ? `on on-${o.v === 'execution' ? 'done' : o.v === 'progress' ? 'in_progress' : o.v}` : ''}`}
          onClick={() => {
            if (o.v === 'blocker') onBlocker()
            else onSection(o.v)
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function MoveMenu({
  section,
  onMove,
}: {
  section: WorkSection
  onMove: (to: WorkSection) => void
}) {
  const targets: { to: WorkSection; label: string }[] = [
    { to: 'plan', label: '계획' },
    { to: 'progress', label: '진행' },
    { to: 'execution', label: '실행' },
    { to: 'carryover', label: '이월' },
  ]
  return (
    <div className="move-menu" role="group" aria-label="섹션 이동">
      {targets
        .filter((t) => t.to !== section)
        .map((t) => (
          <button
            key={t.to}
            type="button"
            className="btn btn-ghost btn-sm move-btn"
            onClick={() => onMove(t.to)}
            title={`${t.label}(으)로 이동`}
          >
            →{t.label}
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
  section: WorkSection
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

function WorkItemRow({
  reportId,
  section,
  item,
  highlight,
}: {
  reportId: string
  section: WorkSection
  item: WorkItem
  highlight?: boolean
}) {
  const { updateWorkItem, moveWorkItem } = useStore()

  const setBlocker = () => {
    const target = section === 'plan' || section === 'execution' ? 'progress' : section
    if (target !== section) {
      void moveWorkItem(reportId, item.id, target).then(() =>
        updateWorkItem(reportId, target, item.id, { status: 'blocker' }),
      )
    } else {
      void updateWorkItem(reportId, section, item.id, { status: 'blocker' })
    }
  }

  return (
    <div
      className={`exec-row ${highlight ? 'blocker-flash' : ''}`}
      data-blocker-item={item.status === 'blocker' ? item.id : undefined}
    >
      <EditableItemText
        value={item.text}
        onCommit={(text) => updateWorkItem(reportId, section, item.id, { text })}
      />
      {item.isAdHoc && <span className="ad-hoc-tag">계획 외</span>}
      <div className="item-meta">
        {section === 'carryover' && <CarryBadge days={item.consecutiveDays} />}
        <StatusControls
          section={section}
          status={item.status}
          onSection={(to) => moveWorkItem(reportId, item.id, to)}
          onBlocker={setBlocker}
        />
        <MoveMenu section={section} onMove={(to) => moveWorkItem(reportId, item.id, to)} />
        <AttachPopover
          reportId={reportId}
          section={section}
          itemId={item.id}
          attachments={item.attachments}
        />
      </div>
      <AttachmentList items={item.attachments} />
      {item.status === 'blocker' && (
        <div data-blocker-item={item.id}>
          <BlockerFields
            reason={item.blockerReason ?? ''}
            support={item.supportRequest ?? ''}
            highlight={highlight}
            autoFocus={highlight}
            onCommitReason={(blockerReason) =>
              updateWorkItem(reportId, section, item.id, { blockerReason })
            }
            onCommitSupport={(supportRequest) =>
              updateWorkItem(reportId, section, item.id, { supportRequest })
            }
          />
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
    addPlanItem,
    addAdHocExecution,
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
  const [workCollapsed, setWorkCollapsed] = useState(false)
  const instrRef = useRef<HTMLDivElement>(null)
  const pushPreviewRef = useRef<HTMLTextAreaElement>(null)

  const pushText = useMemo(() => {
    if (!employee || !report) return ''
    return composeChatSummary(employee, report)
  }, [employee, report])

  const morning = report ? isMorningDone(report) : false
  const evening = report ? isEveningDone(report) : false

  useEffect(() => {
    if (morning && !evening) {
      setPlanCollapsed(true)
      setWorkCollapsed(false)
    } else if (!morning) {
      setPlanCollapsed(false)
      setWorkCollapsed(true)
    } else {
      setPlanCollapsed(false)
      setWorkCollapsed(false)
    }
  }, [morning, evening, actingAsEmployeeId])

  if (!employee || !report) {
    return <div className="empty">선택한 담당자의 당일 보고서가 없습니다.</div>
  }

  const progress = report.progress ?? []
  const ooo = isOooOn(employee, state.currentDate)
  const unreflected = report.instructions.filter((i) => i.reflect === 'unreflected')
  const phase: 'morning' | 'evening' | 'done' = evening
    ? 'done'
    : morning
      ? 'evening'
      : 'morning'
  const missingBlockerReason = [...progress, ...report.execution, ...report.carryover].some(
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
                  ? '진행·실행·이월 후 마감'
                  : '오전 제출 후'}
            </div>
          </div>
        </div>
      </div>

      <div className="employee-layout">
        <div className="stack">
          <section
            className={`panel panel-pad phase-panel ${phase === 'morning' ? 'active-phase' : ''} ${planCollapsed ? 'collapsed' : ''}`}
          >
            <div className="section-title">
              <h2>
                계획{' '}
                <span className="hint" title="진행/실행으로 자유롭게 이동">
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
                  <WorkItemRow
                    key={item.id}
                    reportId={report.id}
                    section="plan"
                    item={item}
                    highlight={highlightBlockerId === item.id}
                  />
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

          <section
            className={`panel panel-pad phase-panel ${phase === 'evening' || phase === 'done' ? 'active-phase' : ''} ${workCollapsed ? 'collapsed' : ''}`}
          >
            <div className="section-title">
              <h2>
                진행 <span className="hint" title="오늘 진행 중">ⓘ</span>
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setWorkCollapsed((c) => !c)}
              >
                {workCollapsed ? '펼치기' : '접기'}
              </button>
            </div>
            {!workCollapsed && (
              <>
                {progress.length === 0 && (
                  <div className="empty" style={{ padding: 12 }}>
                    진행 항목 없음
                  </div>
                )}
                {progress.map((item) => (
                  <WorkItemRow
                    key={item.id}
                    reportId={report.id}
                    section="progress"
                    item={item}
                    highlight={highlightBlockerId === item.id}
                  />
                ))}
                <div className="add-row">
                  <input
                    placeholder="+ 계획 외 진행…"
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

          <section
            className={`panel panel-pad phase-panel ${phase === 'evening' || phase === 'done' ? 'active-phase' : ''} ${workCollapsed ? 'collapsed' : ''}`}
          >
            <div className="section-title">
              <h2>
                실행 <span className="hint" title="오늘 완료한 업무">ⓘ</span>
              </h2>
            </div>
            {!workCollapsed && (
              <>
                {report.execution.length === 0 && (
                  <div className="empty" style={{ padding: 12 }}>
                    실행 항목 없음
                  </div>
                )}
                {report.execution.map((item) => (
                  <WorkItemRow
                    key={item.id}
                    reportId={report.id}
                    section="execution"
                    item={item}
                    highlight={highlightBlockerId === item.id}
                  />
                ))}
              </>
            )}
          </section>

          <section
            className={`panel panel-pad phase-panel ${phase === 'evening' || phase === 'done' ? 'active-phase' : ''} ${workCollapsed ? 'collapsed' : ''}`}
          >
            <div className="section-title">
              <h2>이월</h2>
            </div>
            {!workCollapsed &&
              (report.carryover.length === 0 ? (
                <div className="empty" style={{ padding: 12 }}>
                  이월 없음
                </div>
              ) : (
                report.carryover.map((item) => (
                  <WorkItemRow
                    key={item.id}
                    reportId={report.id}
                    section="carryover"
                    item={item}
                    highlight={highlightBlockerId === item.id}
                  />
                ))
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
