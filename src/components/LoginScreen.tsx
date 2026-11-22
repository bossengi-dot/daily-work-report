'use client'

import { useEffect, useState } from 'react'
import { useStore } from '../store'

type LocalTab = 'login' | 'register' | 'join'

export function LoginScreen() {
  const {
    session,
    authError,
    authMode,
    joinPending,
    submitJoinApplication,
    refresh,
    localLogin,
    localRegister,
    logout,
  } = useStore()
  const [tab, setTab] = useState<LocalTab>('login')
  const [applyName, setApplyName] = useState(session?.displayName ?? '')
  const [applyDept, setApplyDept] = useState('')
  const [applyMemo, setApplyMemo] = useState('')
  const [applyDone, setApplyDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  const waitingForRole = applyDone || joinPending

  useEffect(() => {
    if (session?.displayName) setApplyName(session.displayName)
  }, [session?.displayName])

  useEffect(() => {
    if (session && !session.role) setTab('join')
  }, [session])

  useEffect(() => {
    if (!session) {
      setApplyDone(false)
      setFormError(null)
      setTab('login')
    }
  }, [session])

  const doApply = async () => {
    setBusy(true)
    setFormError(null)
    const ok = await submitJoinApplication({
      name: applyName,
      dept: applyDept,
      memo: applyMemo,
    })
    setBusy(false)
    if (ok) {
      setApplyDone(true)
      setApplyDept('')
      setApplyMemo('')
    } else {
      setFormError('가입 신청에 실패했습니다. 입력값을 확인해 주세요.')
    }
  }

  const doLogin = async () => {
    setBusy(true)
    setFormError(null)
    const result = await localLogin(email, password)
    setBusy(false)
    if (!result.ok) {
      setFormError(result.message ?? '로그인에 실패했습니다.')
    }
  }

  const doRegister = async () => {
    setBusy(true)
    setFormError(null)
    const result = await localRegister({
      email,
      password,
      displayName,
      inviteCode,
    })
    setBusy(false)
    if (!result.ok) {
      setFormError(result.message ?? '가입에 실패했습니다.')
      return
    }
    setTab('join')
  }

  const doLogout = async () => {
    setBusy(true)
    setFormError(null)
    await logout()
    setBusy(false)
  }

  if (authMode === 'local' && !session) {
    return (
      <div className="login-page">
        <div className="login-card panel">
          <div className="brand" style={{ marginBottom: 8 }}>
            <div className="brand-mark" style={{ width: 36, height: 36 }}>
              일
            </div>
            <div>
              <strong style={{ fontSize: 18 }}>일일업무보고</strong>
              <div className="hint">NAS 로컬 로그인 (이메일·비밀번호)</div>
            </div>
          </div>

          <div className="login-tabs">
            <button
              type="button"
              className={tab === 'login' ? 'active' : ''}
              onClick={() => {
                setTab('login')
                setFormError(null)
              }}
            >
              로그인
            </button>
            <button
              type="button"
              className={tab === 'register' ? 'active' : ''}
              onClick={() => {
                setTab('register')
                setFormError(null)
              }}
            >
              계정 만들기
            </button>
          </div>

          {formError && (
            <p style={{ marginTop: 12, color: 'var(--danger, #b42318)' }}>{formError}</p>
          )}

          {tab === 'login' && (
            <>
              <div className="field" style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>이메일</label>
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                />
              </div>
              <div className="field" style={{ marginTop: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>비밀번호</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void doLogin()
                  }}
                  placeholder="비밀번호"
                />
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 12 }}
                disabled={busy}
                onClick={() => void doLogin()}
              >
                로그인
              </button>
              <p className="hint" style={{ marginTop: 10 }}>
                첫 관리자는 docker-compose의 BOOTSTRAP_MANAGER_EMAIL / PASSWORD 로
                로그인하세요.
              </p>
            </>
          )}

          {tab === 'register' && (
            <>
              <div className="field" style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>이름</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="홍길동"
                />
              </div>
              <div className="field" style={{ marginTop: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="field" style={{ marginTop: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>비밀번호 (8자 이상)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호"
                />
              </div>
              <div className="field" style={{ marginTop: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>초대 코드 *</label>
                <input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="관리자에게 받은 코드"
                />
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 12 }}
                disabled={busy}
                onClick={() => void doRegister()}
              >
                계정 만들기
              </button>
              <p className="hint" style={{ marginTop: 10 }}>
                계정 만든 뒤 가입 신청 → 관리자 승인 후 이용합니다.
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  if (authError && authMode !== 'local') {
    return (
      <div className="login-page">
        <div className="login-card panel">
          <div className="brand" style={{ marginBottom: 8 }}>
            <div className="brand-mark" style={{ width: 36, height: 36 }}>
              일
            </div>
            <div>
              <strong style={{ fontSize: 18 }}>일일업무보고</strong>
              <div className="hint">Cursor 로그인 필요</div>
            </div>
          </div>
          <p style={{ marginTop: 12 }}>{authError}</p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 12 }}
            onClick={() => void refresh()}
          >
            다시 시도
          </button>
        </div>
      </div>
    )
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
            <div className="hint">
              {authMode === 'local'
                ? '로컬 계정 · 역할 배정 대기'
                : 'Cursor 계정으로 인증됩니다'}
            </div>
          </div>
        </div>

        {session && (
          <div className="panel panel-pad" style={{ marginTop: 8, marginBottom: 12 }}>
            <div className="hint">현재 사용자</div>
            <div style={{ fontWeight: 600 }}>{session.displayName}</div>
            {session.email && <div className="hint">{session.email}</div>}
            {session.simulated && (
              <div className="hint" style={{ marginTop: 6 }}>
                로컬 미리보기: 시뮬레이션된 뷰어입니다.
              </div>
            )}
          </div>
        )}

        {formError && (
          <p style={{ marginBottom: 8, color: 'var(--danger, #b42318)' }}>{formError}</p>
        )}

        {waitingForRole ? (
          <div className="apply-done">
            <p style={{ margin: '0 0 8px', fontWeight: 600 }}>신청이 접수되었습니다.</p>
            <p className="hint" style={{ marginBottom: 12 }}>
              관리자 승인 후 직원으로 이용할 수 있습니다. 승인됐다면 「상태 새로고침」을
              누르세요.
            </p>
            <button
              type="button"
              className="btn btn-outline"
              style={{ width: '100%' }}
              disabled={busy}
              onClick={() => void refresh()}
            >
              상태 새로고침
            </button>
            {authMode === 'local' && (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 8 }}
                  disabled={busy}
                  onClick={() => void doLogout()}
                >
                  로그아웃
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ width: '100%', marginTop: 4 }}
                  disabled={busy}
                  onClick={() => void doLogout()}
                >
                  로그인으로
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <p className="hint" style={{ marginTop: 0, marginBottom: 8 }}>
              아직 역할이 없습니다. 이름·부서로 가입을 신청하세요.
              {authMode !== 'local' &&
                ' (첫 Cursor 사용자는 자동 관리자 — 새로고침)'}
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
              disabled={busy}
              onClick={() => void doApply()}
            >
              가입 신청하기
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: '100%', marginTop: 8 }}
              disabled={busy}
              onClick={() => void refresh()}
            >
              새로고침
            </button>
            {authMode === 'local' && (
              <button
                type="button"
                className="btn btn-outline"
                style={{ width: '100%', marginTop: 8 }}
                disabled={busy}
                onClick={() => void doLogout()}
              >
                로그아웃
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
