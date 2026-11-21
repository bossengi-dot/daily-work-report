import { useState } from 'react'
import { MANAGER_PIN } from '../seed'
import { useStore } from '../store'

export function LoginScreen() {
  const { state, loginEmployee, loginManager } = useStore()
  const [mode, setMode] = useState<'employee' | 'manager'>('employee')
  const [employeeId, setEmployeeId] = useState(state.employees[0]?.id ?? '')
  const [pin, setPin] = useState('')

  return (
    <div className="login-page">
      <div className="login-card panel">
        <div className="brand" style={{ marginBottom: 8 }}>
          <div className="brand-mark" style={{ width: 36, height: 36 }}>
            일
          </div>
          <div>
            <strong style={{ fontSize: 18 }}>일일업무보고</strong>
            <div className="hint">간단한 역할 로그인 (실인증 아님 · UX 스텁)</div>
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
            <div className="employee-pick">
              {state.employees.map((e) => (
                <button
                  type="button"
                  key={e.id}
                  className={`pick-card ${employeeId === e.id ? 'on' : ''}`}
                  onClick={() => setEmployeeId(e.id)}
                >
                  <div className="avatar">{e.initials}</div>
                  <div>
                    <div className="name">{e.name}</div>
                    <div className="role">
                      {e.dept} · PIN 힌트 {e.pin[0]}***
                    </div>
                  </div>
                </button>
              ))}
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
                  if (e.key === 'Enter') loginEmployee(employeeId, pin)
                }}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 12 }}
              onClick={() => loginEmployee(employeeId, pin)}
            >
              직원 로그인
            </button>
            <p className="hint" style={{ marginTop: 10 }}>
              시드 PIN 예: 박도형 1111 · 최유진 4444 · 배수아 1010 (카드에 힌트 표시)
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
