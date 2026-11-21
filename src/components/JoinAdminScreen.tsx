'use client'

import { useMemo, useState } from 'react'
import type { JoinAppStatus } from '../types'
import { useStore } from '../store'

const FILTERS: { id: JoinAppStatus | 'all'; label: string }[] = [
  { id: 'pending', label: '대기' },
  { id: 'approved', label: '승인' },
  { id: 'rejected', label: '거절' },
  { id: 'cancelled', label: '취소' },
  { id: 'all', label: '전체' },
]

function statusBadge(status: JoinAppStatus) {
  switch (status) {
    case 'pending':
      return <span className="badge badge-progress">대기</span>
    case 'approved':
      return <span className="badge badge-done">승인</span>
    case 'rejected':
      return <span className="badge badge-blocker">거절</span>
    case 'cancelled':
      return <span className="badge badge-carry">취소</span>
  }
}

export function JoinAdminScreen() {
  const {
    state,
    approveJoinApplication,
    rejectJoinApplication,
    cancelJoinApplication,
    registerEmployeeDirect,
  } = useStore()

  const [filter, setFilter] = useState<JoinAppStatus | 'all'>('pending')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [directName, setDirectName] = useState('')
  const [directDept, setDirectDept] = useState('')

  const list = useMemo(() => {
    const apps = state.joinApplications
    if (filter === 'all') return apps
    return apps.filter((a) => a.status === filter)
  }, [state.joinApplications, filter])

  const pendingCount = state.joinApplications.filter((a) => a.status === 'pending').length

  const onReject = () => {
    if (!rejectId) return
    void rejectJoinApplication(rejectId, rejectReason)
    setRejectId(null)
    setRejectReason('')
  }

  const onDirect = () => {
    void registerEmployeeDirect({
      name: directName,
      dept: directDept,
    }).then((res) => {
      if (res.ok) {
        setDirectName('')
        setDirectDept('')
      }
    })
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>가입신청</h1>
          <p>
            대기 {pendingCount}건 · 승인 시 Cursor 계정이 직원 역할로 연결됩니다.
          </p>
        </div>
      </div>

      <div className="stack" style={{ gap: 16 }}>
        <section className="panel panel-pad">
          <div className="section-title">
            <h2>직접 등록</h2>
          </div>
          <p className="hint" style={{ marginTop: -6, marginBottom: 10 }}>
            데모용 직원 프로필만 만듭니다. 본인 로그인은 해당 사용자가 가입 신청 후 승인받아야
            합니다.
          </p>
          <div className="join-direct-grid">
            <div className="field">
              <label style={{ fontSize: 12, fontWeight: 600 }}>이름</label>
              <input
                value={directName}
                onChange={(e) => setDirectName(e.target.value)}
                placeholder="이름"
              />
            </div>
            <div className="field">
              <label style={{ fontSize: 12, fontWeight: 600 }}>부서</label>
              <input
                value={directDept}
                onChange={(e) => setDirectDept(e.target.value)}
                placeholder="부서"
              />
            </div>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <label style={{ fontSize: 12, visibility: 'hidden' }}>.</label>
              <button type="button" className="btn btn-primary" onClick={onDirect}>
                등록
              </button>
            </div>
          </div>
        </section>

        <section className="panel panel-pad">
          <div className="section-title" style={{ marginBottom: 12 }}>
            <h2>신청 목록</h2>
          </div>
          <div className="filter-row" style={{ marginBottom: 12 }}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`filter-chip ${filter === f.id ? 'active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
                {f.id === 'pending' && pendingCount > 0 && (
                  <span className="count">{pendingCount}</span>
                )}
              </button>
            ))}
          </div>

          {list.length === 0 ? (
            <div className="empty" style={{ padding: 24 }}>
              해당 상태의 신청이 없습니다.
            </div>
          ) : (
            <div className="join-app-list">
              {list.map((app) => (
                <article key={app.id} className="join-app-row">
                  <div className="join-app-main">
                    <div className="join-app-title">
                      <strong>{app.name}</strong>
                      {statusBadge(app.status)}
                    </div>
                    <div className="hint">
                      {app.dept}
                      {' · '}
                      {app.createdAt}
                    </div>
                    {app.memo && <div className="join-app-memo">{app.memo}</div>}
                    {app.rejectReason && (
                      <div className="hint" style={{ color: 'var(--red-600)' }}>
                        거절 사유: {app.rejectReason}
                      </div>
                    )}
                    {app.status === 'approved' && app.employeeId && (
                      <div className="hint">직원 ID: {app.employeeId}</div>
                    )}
                  </div>
                  {app.status === 'pending' && (
                    <div className="join-app-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => void approveJoinApplication(app.id)}
                      >
                        승인
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger-outline btn-sm"
                        onClick={() => {
                          setRejectId(app.id)
                          setRejectReason('')
                        }}
                      >
                        거절
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => void cancelJoinApplication(app.id)}
                      >
                        대기 취소
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {rejectId && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <h3 style={{ margin: '0 0 8px' }}>거절 사유</h3>
            <p className="hint" style={{ marginBottom: 10 }}>
              선택 사항입니다. 비워도 거절할 수 있습니다.
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="예: 소속 확인 필요"
              style={{ width: '100%', marginBottom: 12 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setRejectId(null)}
              >
                닫기
              </button>
              <button type="button" className="btn btn-danger-outline" onClick={onReject}>
                거절 확정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
