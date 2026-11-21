'use client'

import { useMemo, useState } from 'react'
import { tryGenerateBrief } from '../lib/integrations'
import {
  deriveTodosForRange,
  deriveTopicsForRange,
  rangeKpi,
} from '../lib/weekly'
import { useStore } from '../store'

export function MonthlySummary() {
  const { state, showToast } = useStore()
  const { start, end } = state.monthRange
  const [brief, setBrief] = useState('')
  const [briefMode, setBriefMode] = useState('')
  const [loading, setLoading] = useState(false)

  const kpi = useMemo(() => rangeKpi(state, start, end), [state, start, end])
  const topics = useMemo(() => deriveTopicsForRange(state, start, end), [state, start, end])
  const todos = useMemo(() => deriveTodosForRange(state, start, end), [state, start, end])

  // Aggregate topics by title for monthly view (collapse by day → by theme)
  const themeRollup = useMemo(() => {
    const map = new Map<string, { count: number; people: Set<string>; blocker: boolean }>()
    for (const t of topics) {
      const cur = map.get(t.title) ?? { count: 0, people: new Set(), blocker: false }
      cur.count += t.count ?? 1
      t.people.forEach((p) => cur.people.add(p))
      if (t.status === 'blocker') cur.blocker = true
      map.set(t.title, cur)
    }
    return [...map.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
  }, [topics])

  const loadBrief = async () => {
    setLoading(true)
    // monthly brief: reuse heuristic with month range temporarily swapped
    const monthState = {
      ...state,
      weekRange: { start, end },
    }
    const result = await tryGenerateBrief(monthState)
    setBrief(
      result.text.startsWith('주간')
        ? result.text.replace('주간 업무 브리프', '월간 업무 브리프')
        : `월간 업무 브리프 초안 (${start} ~ ${end})\n\n` + result.text,
    )
    setBriefMode(result.detail)
    setLoading(false)
    showToast(result.detail)
  }

  return (
    <div className="page page-wide">
      <div className="page-header">
        <div>
          <h1>월간 리포트</h1>
          <p>
            {start.slice(0, 7)} · {start} ~ {end} · 주간과 동일 집계 규칙 (키워드 2+ / 말일 미결)
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          내보내기
        </button>
      </div>

      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
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
        <div className="panel kpi-card">
          <div className="kpi-icon carry">∅</div>
          <div>
            <div className="label">부재 면제</div>
            <div className="value">{kpi.oooExempt} 일</div>
          </div>
        </div>
      </div>

      <div className="review-banner panel panel-pad">
        <div>
          <strong>사람 검토 후 발송</strong>
          <p className="hint" style={{ margin: '4px 0 0' }}>
            {briefMode || 'LLM 설정 시 시도 · 없으면 휴리스틱'} · 시드 월 데이터는 9/14~17 중심
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={loading}
            onClick={loadBrief}
          >
            {loading ? '생성 중…' : '월간 브리프 생성'}
          </button>
          {brief && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(brief)
                  showToast('브리프를 복사했습니다.')
                } catch {
                  showToast('복사 실패 — 텍스트를 선택해 주세요.')
                }
              }}
            >
              복사
            </button>
          )}
        </div>
      </div>
      {brief && (
        <textarea
          className="push-preview panel"
          rows={12}
          readOnly
          value={brief}
          style={{ marginBottom: 16 }}
        />
      )}

      <div className="stack">
        <section className="panel panel-pad">
          <div className="section-title">
            <h2>월간 주제 롤업</h2>
            <span className="hint">키워드 2회+ · 상위 테마</span>
          </div>
          {themeRollup.length === 0 ? (
            <div className="empty">집계할 토픽이 없습니다.</div>
          ) : (
            <div className="topic-timeline" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
              {themeRollup.map(([title, info]) => (
                <div className="panel topic-card" key={title}>
                  <div className="title">{title}</div>
                  {info.blocker ? (
                    <span className="badge badge-blocker">블로커 포함</span>
                  ) : (
                    <span className="badge badge-progress">진행·완료</span>
                  )}
                  <div className="hint" style={{ marginTop: 10 }}>
                    언급 ×{info.count} · 참여 {info.people.size}명
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel" style={{ overflow: 'auto' }}>
          <div className="panel-pad" style={{ paddingBottom: 0 }}>
            <div className="section-title">
              <h2>월말 기준 오픈 TODO</h2>
              <span className="hint">말일 {end}</span>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>우선순위</th>
                <th>할 일</th>
                <th>담당자</th>
                <th>주제</th>
                <th>연속일수</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {todos.length === 0 && (
                <tr>
                  <td colSpan={6}>
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
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}
