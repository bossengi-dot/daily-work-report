import { useState } from 'react'
import { useStore } from '../store'

export function SettingsScreen() {
  const {
    state,
    updateSettings,
    setEmployeeOoo,
    actingAsEmployeeId,
    setActingAsEmployeeId,
    session,
    showToast,
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
            연동 URL·키는 이 브라우저 localStorage에만 저장됩니다. 코드에 비밀값을 넣지 않습니다.
          </p>
        </div>
      </div>

      <div className="stack" style={{ maxWidth: 640 }}>
        <section className="panel panel-pad">
          <div className="section-title">
            <h2>NAVER WORKS / 채팅 웹훅</h2>
          </div>
          <p className="hint" style={{ marginTop: -6, marginBottom: 10 }}>
            값이 있으면 푸시 시 POST 시도 → 실패/미설정 시 클립보드 폴백
          </p>
          <div className="field">
            <label style={{ fontSize: 12, fontWeight: 600 }}>Webhook URL</label>
            <input
              type="url"
              placeholder="https://hooks.example.com/..."
              value={state.settings.nwWebhookUrl}
              onChange={(e) => updateSettings({ nwWebhookUrl: e.target.value })}
              autoComplete="off"
            />
          </div>
        </section>

        <section className="panel panel-pad">
          <div className="section-title">
            <h2>LLM API (선택)</h2>
          </div>
          <p className="hint" style={{ marginTop: -6, marginBottom: 10 }}>
            엔드포인트+키가 있으면 주간 브리프 생성 시 호출 → 없거나 실패 시 휴리스틱 폴백
          </p>
          <div className="field" style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Endpoint URL</label>
            <input
              type="url"
              placeholder="https://api.openai.com/v1/chat/completions"
              value={state.settings.llmEndpoint}
              onChange={(e) => updateSettings({ llmEndpoint: e.target.value })}
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label style={{ fontSize: 12, fontWeight: 600 }}>API Key</label>
            <input
              type="password"
              placeholder="sk-... (이 기기에만 저장)"
              value={state.settings.llmApiKey}
              onChange={(e) => updateSettings({ llmApiKey: e.target.value })}
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 10 }}
            onClick={() => {
              updateSettings({ llmApiKey: '', llmEndpoint: '', nwWebhookUrl: '' })
              showToast('연동 설정을 비웠습니다.')
            }}
          >
            연동 설정 모두 지우기
          </button>
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
                  setEmployeeOoo(target.id, null)
                  setOooStart('')
                  setOooEnd('')
                  setOooReason('')
                  showToast('부재를 해제했습니다.')
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
                setEmployeeOoo(targetId, {
                  start: oooStart,
                  end: oooEnd,
                  reason: oooReason || undefined,
                })
                showToast('부재 기간을 저장했습니다.')
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
            로컬 파일 첨부는 object URL로 미리보기만 제공합니다. localStorage에는 파일명·크기·MIME
            메타만 남고, 바이너리는 저장하지 않습니다. 새로고침 시 미리보기 URL은 만료됩니다.
          </p>
        </section>
      </div>
    </div>
  )
}
