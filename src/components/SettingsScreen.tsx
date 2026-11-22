'use client'

import { useState } from 'react'
import { useStore } from '../store'

export function SettingsScreen() {
  const {
    state,
    setEmployeeOoo,
    actingAsEmployeeId,
    setActingAsEmployeeId,
    session,
    showToast,
    resetSeed,
  } = useStore()

  const targetId =
    session?.role === 'employee'
      ? (session.employeeId ?? actingAsEmployeeId)
      : actingAsEmployeeId
  const target = state.employees.find((e) => e.id === targetId)

  const [oooStart, setOooStart] = useState(target?.ooo?.start ?? '')
  const [oooEnd, setOooEnd] = useState(target?.ooo?.end ?? '')
  const [oooReason, setOooReason] = useState(target?.ooo?.reason ?? '')

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>설정</h1>
          <p>
            역할·데이터는 서버에서 관리됩니다. 웹훅 등 비밀값은 앱 시크릿으로만 설정하세요.
          </p>
        </div>
      </div>

      <div className="stack" style={{ maxWidth: 640 }}>
        <section className="panel panel-pad">
          <div className="section-title">
            <h2>계정</h2>
          </div>
          <p className="hint">
            {session?.displayName}
            {session?.email ? ` · ${session.email}` : ''}
            {session?.role ? ` · ${session.role === 'manager' ? '관리자' : '직원'}` : ''}
            {session?.simulated ? ' · 로컬 시뮬 뷰어' : ''}
          </p>
        </section>

        <section className="panel panel-pad">
          <div className="section-title">
            <h2>부재(OOO) 설정</h2>
          </div>
          {session?.role === 'manager' && (
            <div className="chip-row" style={{ marginBottom: 10 }}>
              {state.employees.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className={`filter-chip ${targetId === e.id ? 'active' : ''}`}
                  onClick={() => {
                    setActingAsEmployeeId(e.id)
                    setOooStart(e.ooo?.start ?? '')
                    setOooEnd(e.ooo?.end ?? '')
                    setOooReason(e.ooo?.reason ?? '')
                  }}
                >
                  {e.name}
                  {e.ooo ? ' · 부재' : ''}
                </button>
              ))}
            </div>
          )}
          <p className="hint" style={{ marginBottom: 10 }}>
            대상: {target?.name ?? '—'} · 해당일 제출 면제 · 매니저 리마인드 스킵
          </p>
          {target?.ooo && (
            <div className="ooo-banner" style={{ marginBottom: 10 }}>
              현재 부재: {target.ooo.start} ~ {target.ooo.end}
              {target.ooo.reason ? ` · ${target.ooo.reason}` : ''}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ marginLeft: 8 }}
                onClick={() => {
                  if (!target) return
                  void setEmployeeOoo(target.id, null).then(() => {
                    setOooStart('')
                    setOooEnd('')
                    setOooReason('')
                    showToast('부재를 해제했습니다.')
                  })
                }}
              >
                해제
              </button>
            </div>
          )}
          <div className="field" style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>시작</label>
                <input
                  type="date"
                  value={oooStart}
                  onChange={(e) => setOooStart(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>종료</label>
                <input type="date" value={oooEnd} onChange={(e) => setOooEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>사유</label>
              <input
                value={oooReason}
                onChange={(e) => setOooReason(e.target.value)}
                placeholder="휴가 / 출장 등"
              />
            </div>
            <button
              type="button"
              className="btn btn-outline"
              disabled={!targetId || !oooStart || !oooEnd}
              onClick={() => {
                if (!targetId) return
                void setEmployeeOoo(targetId, {
                  start: oooStart,
                  end: oooEnd,
                  reason: oooReason || undefined,
                }).then(() => showToast('부재 기간을 저장했습니다.'))
              }}
            >
              부재 저장
            </button>
          </div>
        </section>

        <section className="panel panel-pad">
          <div className="section-title">
            <h2>첨부 안내</h2>
          </div>
          <p className="hint">
            첨부 링크는 http(s)만 허용됩니다. javascript·data 스킴은 차단합니다.
          </p>
        </section>

        {session?.role === 'manager' && (
          <section className="panel panel-pad">
            <div className="section-title">
              <h2>데모 데이터</h2>
            </div>
            <p className="hint" style={{ marginBottom: 10 }}>
              시드(직원 10명·5영업일)로 초기화합니다. 사용자 역할(관리자/직원)은 유지됩니다.
            </p>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => void resetSeed()}
            >
              시드 리셋
            </button>
          </section>
        )}
      </div>
    </div>
  )
}
