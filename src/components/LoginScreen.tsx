'use client'

import { useState } from 'react'
import { useStore } from '../store'

export function LoginScreen() {
  const { session, authError, submitJoinApplication, refresh } = useStore()
  const [applyName, setApplyName] = useState(session?.displayName ?? '')
  const [applyDept, setApplyDept] = useState('')
  const [applyMemo, setApplyMemo] = useState('')
  const [applyDone, setApplyDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const doApply = async () => {
    setBusy(true)
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
    }
  }

  if (authError) {
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
            <div className="hint">Cursor 계정으로 인증됩니다</div>
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

        {applyDone ? (
          <div className="apply-done">
            <p style={{ margin: '0 0 8px', fontWeight: 600 }}>신청이 접수되었습니다.</p>
            <p className="hint" style={{ marginBottom: 12 }}>
              관리자 승인 후 직원으로 이용할 수 있습니다.
            </p>
            <button
              type="button"
              className="btn btn-outline"
              style={{ width: '100%' }}
              onClick={() => void refresh()}
            >
              상태 새로고침
            </button>
          </div>
        ) : (
          <>
            <p className="hint" style={{ marginTop: 0, marginBottom: 8 }}>
              아직 역할이 없습니다. 이름·부서로 가입을 신청하거나, 첫 사용자라면 자동으로
              관리자가 됩니다(새로고침).
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
              onClick={() => void refresh()}
            >
              새로고침
            </button>
          </>
        )}
      </div>
    </div>
  )
}
