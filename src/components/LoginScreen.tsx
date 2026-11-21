import { useMemo, useState } from 'react'
import { MANAGER_PIN } from '../seed'
import { useStore } from '../store'

const LAST_LOGIN_KEY = 'daily-report-last-employee-id'

export function LoginScreen() {
  const { state, loginEmployee, loginManager } = useStore()
  const [mode, setMode] = useState<'employee' | 'manager'>('employee')
  const [query, setQuery] = useState('')
  const lastId =
    typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_LOGIN_KEY) : null
  const [employeeId, setEmployeeId] = useState(
    () => lastId || state.employees[0]?.id || '',
  )
  const [pin, setPin] = useState('')

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
    // last login first
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

        <div className="login-tabs">
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
        </div>

        {mode === 'employee' ? (
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
        ) : (
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
      </div>
    </div>
  )
}
