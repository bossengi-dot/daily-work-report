import { useMemo, useState } from 'react'
import { MANAGER_PIN } from '../seed'
import { useStore } from '../store'

const LAST_LOGIN_KEY = 'daily-report-last-employee-id'

type LoginMode = 'employee' | 'manager' | 'apply'

export function LoginScreen() {
  const { state, loginEmployee, loginManager, submitJoinApplication } = useStore()
  const [mode, setMode] = useState<LoginMode>('employee')
  const [query, setQuery] = useState('')
  const lastId =
    typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_LOGIN_KEY) : null
  const [employeeId, setEmployeeId] = useState(
    () => lastId || state.employees[0]?.id || '',
  )
  const [pin, setPin] = useState('')

  const [applyName, setApplyName] = useState('')
  const [applyDept, setApplyDept] = useState('')
  const [applyPin, setApplyPin] = useState('')
  const [applyMemo, setApplyMemo] = useState('')
  const [applyDone, setApplyDone] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim()
    let list = state.employees
    if (q) {
      list = list.filter(
        (e) =>
          e.name.includes(q) ||
          e.dept.includes(q) ||
          e.role.includes(q),
      )
    }
    if (lastId) {
      list = [...list].sort((a, b) => {
        if (a.id === lastId) return -1
        if (b.id === lastId) return 1
        return 0
      })
    }
    return list
  }, [state.employees, query, lastId])

  const doEmployeeLogin = () => {
    const ok = loginEmployee(employeeId, pin)
    if (ok) localStorage.setItem(LAST_LOGIN_KEY, employeeId)
  }

  const doApply = () => {
    const ok = submitJoinApplication({
      name: applyName,
      dept: applyDept,
      desiredPin: applyPin || undefined,
      memo: applyMemo,
    })
    if (ok) {
      setApplyDone(true)
      setApplyName('')
      setApplyDept('')
      setApplyPin('')
      setApplyMemo('')
    }
  }

  return (
    <div className="login-page">
      <div className="login-card panel">
        <div className="brand" style={{ marginBottom: 8 }}>
          <div className="brand-mark" style={{ width: 36, height: 36 }}>
            일
          </div>
          <div>
            <strong style={{ fontSize: 18 }}>일일업무보고</strong>
            <div className="hint">역할 로그인 (실인증 아님 · UX 스텁)</div>
          </div>
        </div>

        <div className="login-tabs login-tabs-3">
          <button
            type="button"
            className={mode === 'employee' ? 'active' : ''}
            onClick={() => setMode('employee')}
          >
            직원
          </button>
          <button
            type="button"
            className={mode === 'manager' ? 'active' : ''}
            onClick={() => setMode('manager')}
          >
            관리자
          </button>
          <button
            type="button"
            className={mode === 'apply' ? 'active' : ''}
            onClick={() => {
              setMode('apply')
              setApplyDone(false)
            }}
          >
            가입 신청
          </button>
        </div>

        {mode === 'employee' && (
          <>
            <div className="field" style={{ marginTop: 8 }}>
              <input
                placeholder="이름·부서 검색…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="직원 검색"
              />
            </div>
            <div className="employee-pick">
              {filtered.map((e) => (
                <button
                  type="button"
                  key={e.id}
                  className={`pick-card ${employeeId === e.id ? 'on' : ''}`}
                  onClick={() => setEmployeeId(e.id)}
                >
                  <div className="avatar">{e.initials}</div>
                  <div>
                    <div className="name">
                      {e.name}
                      {e.id === lastId && <span className="hint"> · 최근</span>}
                    </div>
                    <div className="role">
                      {e.dept} · PIN 힌트 {e.pin[0]}***
                    </div>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="empty" style={{ padding: 12 }}>
                  검색 결과 없음
                </div>
              )}
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>PIN</label>
              <input
                type="password"
                inputMode="numeric"
                placeholder="4자리 PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') doEmployeeLogin()
                }}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 12 }}
              onClick={doEmployeeLogin}
            >
              직원 로그인
            </button>
            <p className="hint" style={{ marginTop: 10 }}>
              예: 박도형 1111 · 최유진 4444 · 배수아 1010
            </p>
          </>
        )}

        {mode === 'manager' && (
          <>
            <div className="field" style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>관리자 PIN</label>
              <input
                type="password"
                inputMode="numeric"
                placeholder="관리자 PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loginManager(pin)
                }}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 12 }}
              onClick={() => loginManager(pin)}
            >
              관리자 로그인
            </button>
            <p className="hint" style={{ marginTop: 10 }}>
              시드 관리자 PIN: {MANAGER_PIN}
            </p>
          </>
        )}

        {mode === 'apply' && (
          <>
            {applyDone ? (
              <div className="apply-done" style={{ marginTop: 12 }}>
                <p style={{ margin: '0 0 8px', fontWeight: 600 }}>신청이 접수되었습니다.</p>
                <p className="hint" style={{ marginBottom: 12 }}>
                  관리자 승인 후 직원 로그인 목록에 나타납니다.
                </p>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ width: '100%' }}
                  onClick={() => {
                    setApplyDone(false)
                    setMode('employee')
                  }}
                >
                  로그인으로 돌아가기
                </button>
              </div>
            ) : (
              <>
                <p className="hint" style={{ marginTop: 8, marginBottom: 4 }}>
                  이름·부서를 입력하면 대기 상태로 접수됩니다. 희망 PIN은 선택입니다.
                </p>
                <div className="field" style={{ marginTop: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>이름 *</label>
                  <input
                    value={applyName}
                    onChange={(e) => setApplyName(e.target.value)}
                    placeholder="이름"
                  />
                </div>
                <div className="field" style={{ marginTop: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>부서 *</label>
                  <input
                    value={applyDept}
                    onChange={(e) => setApplyDept(e.target.value)}
                    placeholder="부서"
                  />
                </div>
                <div className="field" style={{ marginTop: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>희망 PIN (선택)</label>
                  <input
                    inputMode="numeric"
                    maxLength={4}
                    value={applyPin}
                    onChange={(e) => setApplyPin(e.target.value)}
                    placeholder="숫자 4자리 · 비우면 승인 시 발급"
                  />
                </div>
                <div className="field" style={{ marginTop: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>메모</label>
                  <textarea
                    rows={2}
                    value={applyMemo}
                    onChange={(e) => setApplyMemo(e.target.value)}
                    placeholder="입사일, 담당 업무 등"
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 12 }}
                  onClick={doApply}
                >
                  가입 신청하기
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
