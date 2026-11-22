'use client'

import { useEffect, useMemo, useState } from 'react'
import { generateWeeklyBrief } from '../lib/aiBrief'
import { tryGenerateBrief } from '../lib/integrations'
import {
  deriveWeeklyTodos,
  deriveWeeklyTopics,
  weekKpi,
} from '../lib/weekly'
import { useStore } from '../store'
import { isEveningDone, isOooOn } from '../types'

export function WeeklySummary() {
  const { state, getReport, showToast } = useStore()
  const { start, end } = state.weekRange
  const [briefOpen, setBriefOpen] = useState(true)
  const [brief, setBrief] = useState(() => generateWeeklyBrief(state))
  const [briefMode, setBriefMode] = useState<'llm' | 'heuristic'>('heuristic')
  const [briefDetail, setBriefDetail] = useState('규칙 기반 초안')

  const kpi = useMemo(() => weekKpi(state), [state])
  const topics = useMemo(() => deriveWeeklyTopics(state), [state])
  const todos = useMemo(() => deriveWeeklyTodos(state), [state])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const result = await tryGenerateBrief(state, { period: 'week' })
      if (!cancelled) {
        setBrief(result.text)
        setBriefMode(result.mode)
        setBriefDetail(result.detail)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [state])

  const todayStatus = (employeeId: string) => {
    const r = getReport(employeeId)
    if (!r) return 'draft'
    if (isEveningDone(r)) return r.status
    if (r.planSubmittedAt) return 'reviewing'
    return r.status
  }

  const statusDot = (employeeId: string) => {
    const emp = state.employees.find((e) => e.id === employeeId)
    if (emp && isOooOn(emp, state.currentDate)) return 'yellow'
    const r = getReport(employeeId)
    if (!r) return 'red'
    if (isEveningDone(r) || r.status === 'done') return 'green'
    if (r.planSubmittedAt && !isEveningDone(r)) return 'yellow'
    return 'red'
  }

  return (
    <div className="page page-wide">
      <div className="page-header">
        <div>
          <h1>주간 요약</h1>
          <p>
            Week {start} ~ {end.slice(5)} · 일일 데이터 자동 집계 (키워드 2회+ / 주말 미결)
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          내보내기
        </button>
      </div>

      <div className="kpi-row">
        <div className="panel kpi-card">
          <div className="kpi-icon ok">✓</div>
          <div>
            <div className="label">제출률</div>
            <div className="value">
              {kpi.submitted}/{kpi.expected} ({kpi.rate}%)
            </div>
          </div>
        </div>
        <div className="panel kpi-card">
          <div className="kpi-icon warn">!</div>
          <div>
            <div className="label">블로커</div>
            <div className="value">{kpi.blockers} 건</div>
          </div>
        </div>
        <div className="panel kpi-card">
          <div className="kpi-icon carry">↻</div>
          <div>
            <div className="label">연속이월</div>
            <div className="value">{kpi.carries} 건</div>
          </div>
        </div>
      </div>

      <div className="review-banner panel panel-pad">
        <div>
          <strong>사람 검토 후 발송</strong>
          <p className="hint" style={{ margin: '4px 0 0' }}>
            {briefMode === 'llm' ? 'LLM' : '휴리스틱'} · {briefDetail}. 검토·수정 후
            공유하세요.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setBriefOpen((o) => !o)}
          >
            {briefOpen ? '브리프 접기' : '브리프 펼치기'}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(brief)
                showToast('브리프를 클립보드에 복사했습니다.')
              } catch {
                showToast('복사 실패 — 텍스트를 직접 선택해 주세요.')
              }
            }}
          >
            브리프 복사
          </button>
        </div>
      </div>
      {briefOpen && (
        <textarea className="push-preview panel" rows={14} readOnly value={brief} style={{ marginBottom: 16 }} />
      )}

      <div className="weekly-layout">
        <aside className="panel assignee-list">
          <h3>담당자 ({state.employees.length})</h3>
          {state.employees.map((emp) => (
            <div className="assignee-item" key={emp.id}>
              <div className="avatar">{emp.initials}</div>
              <div>
                <div className="name" style={{ fontSize: 13 }}>
                  {emp.name}
                </div>
                <div className="role">{emp.dept}</div>
              </div>
              <span className={`dot ${statusDot(emp.id)}`} title={todayStatus(emp.id)} />
            </div>
          ))}
        </aside>

        <div className="stack">
          <section className="panel panel-pad">
            <div className="section-title">
              <h2>자동 주제 타임라인</h2>
              <span className="hint">키워드 2회+ 클러스터 · {topics.length}카드</span>
            </div>
            {topics.length === 0 ? (
              <div className="empty">주간 데이터에서 2회 이상 등장한 토픽이 없습니다.</div>
            ) : (
              <div
                className="topic-timeline"
                style={{ gridTemplateColumns: `repeat(${Math.min(topics.length, 4)}, 1fr)` }}
              >
                {topics.map((t) => {
                  const people = t.people
                    .map((id) => state.employees.find((e) => e.id === id))
                    .filter(Boolean)
                  return (
                    <div className="panel topic-card" key={t.id}>
                      <div className="when">
                        {t.weekday} {t.date.slice(5)}
                      </div>
                      <div className="title">{t.title}</div>
                      {t.status === 'in_progress' && (
                        <span className="badge badge-progress">진행 중</span>
                      )}
                      {t.status === 'done' && <span className="badge badge-done">완료</span>}
                      {t.status === 'blocker' && (
                        <span className="badge badge-blocker">블로커</span>
                      )}
                      <div className="topic-people">
                        {people.map((p) => (
                          <div className="avatar" key={p!.id}>
                            {p!.initials}
                          </div>
                        ))}
                        {(t.extraCount ?? 0) > 0 && (
                          <span className="hint">+{t.extraCount}</span>
                        )}
                        {t.count != null && (
                          <span className="hint" style={{ marginLeft: 4 }}>
                            ×{t.count}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="panel" style={{ overflow: 'auto' }}>
            <div className="panel-pad" style={{ paddingBottom: 0 }}>
              <div className="section-title">
                <h2>진행 중인 오픈 TODO</h2>
                <span className="hint">주말({end}) 미완료·블로커·연속이월</span>
              </div>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>우선순위</th>
                  <th>할 일</th>
                  <th>담당자</th>
                  <th>주제</th>
                  <th>시작일</th>
                  <th>예정일</th>
                  <th>연속일수</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {todos.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty">오픈 TODO 없음</div>
                    </td>
                  </tr>
                )}
                {todos.map((todo) => {
                  const emp = state.employees.find((e) => e.id === todo.assigneeId)
                  const daysCls =
                    todo.consecutiveDays >= 5
                      ? 'consec-danger'
                      : todo.consecutiveDays >= 3
                        ? 'consec-warn'
                        : ''
                  return (
                    <tr key={todo.id}>
                      <td>{todo.priority}</td>
                      <td>{todo.text}</td>
                      <td>{emp?.name}</td>
                      <td>{todo.topic}</td>
                      <td>{todo.startDate.slice(5)}</td>
                      <td>{todo.dueDate.slice(5)}</td>
                      <td className={daysCls}>
                        {todo.consecutiveDays >= 5
                          ? `${todo.consecutiveDays}일+`
                          : `${todo.consecutiveDays}일`}
                      </td>
                      <td>
                        {todo.status === 'blocker' && (
                          <span className="badge badge-blocker">블로커</span>
                        )}
                        {todo.status === 'delayed' && (
                          <span className="badge badge-revision">지연</span>
                        )}
                        {todo.status === 'in_progress' && (
                          <span className="badge badge-progress">진행 중</span>
                        )}
                        {todo.status === 'done' && (
                          <span className="badge badge-done">완료</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  )
}
