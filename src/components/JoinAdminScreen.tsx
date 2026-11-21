'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { JoinAppStatus } from '../types'
import { useStore } from '../store'

const FILTERS: { id: JoinAppStatus | 'all'; label: string }[] = [
  { id: 'pending', label: '대기' },
  { id: 'approved', label: '승인' },
  { id: 'rejected', label: '거절' },
  { id: 'cancelled', label: '취소' },
  { id: 'all', label: '전체' },
]

type MemberRow = {
  employeeId: string
  name: string
  dept: string
  role: string
  ooo: boolean
  linked: boolean
  cursorSub: string | null
  email: string | null
  accountRole: 'employee' | 'manager' | null
}

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
    authMode,
    approveJoinApplication,
    rejectJoinApplication,
    cancelJoinApplication,
    registerEmployeeDirect,
    deleteMember,
    fetchMembers,
    createInviteCode,
  } = useStore()

  const [filter, setFilter] = useState<JoinAppStatus | 'all'>('pending')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [directName, setDirectName] = useState('')
  const [directDept, setDirectDept] = useState('')
  const [directEmail, setDirectEmail] = useState('')
  const [directPassword, setDirectPassword] = useState('')
  const [registerBusy, setRegisterBusy] = useState(false)
  const [lastInvite, setLastInvite] = useState<string | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MemberRow | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const list = useMemo(() => {
    const apps = state.joinApplications
    if (filter === 'all') return apps
    return apps.filter((a) => a.status === filter)
  }, [state.joinApplications, filter])

  const pendingCount = state.joinApplications.filter((a) => a.status === 'pending').length

  const reloadMembers = useCallback(() => {
    setMembersLoading(true)
    void fetchMembers().then((res) => {
      if (res.ok) setMembers(res.members)
      setMembersLoading(false)
    })
  }, [fetchMembers])

  useEffect(() => {
    reloadMembers()
  }, [reloadMembers, state.employees])

  const onReject = () => {
    if (!rejectId) return
    void rejectJoinApplication(rejectId, rejectReason).then(() => reloadMembers())
    setRejectId(null)
    setRejectReason('')
  }

  const onDirect = () => {
    if (registerBusy) return
    setRegisterBusy(true)
    void registerEmployeeDirect({
      name: directName,
      dept: directDept,
      email: authMode === 'local' ? directEmail : undefined,
      password: authMode === 'local' ? directPassword : undefined,
    }).then((res) => {
      setRegisterBusy(false)
      if (res.ok) {
        setDirectName('')
        setDirectDept('')
        setDirectEmail('')
        setDirectPassword('')
        reloadMembers()
      }
    })
  }

  const onConfirmDelete = () => {
    if (!deleteTarget || deleteBusy) return
    setDeleteBusy(true)
    void deleteMember(deleteTarget.employeeId).then((res) => {
      setDeleteBusy(false)
      if (res.ok) {
        setDeleteTarget(null)
        reloadMembers()
      }
    })
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>구성원 · 가입</h1>
          <p>
            구성원 {members.length}명 · 가입 대기 {pendingCount}건 ·{' '}
            {authMode === 'local'
              ? '로컬 계정을 직접 등록하거나 가입 신청을 승인합니다.'
              : '승인 시 Cursor 계정이 직원 역할로 연결됩니다.'}
          </p>
        </div>
      </div>

      {authMode === 'local' && (
        <div className="panel panel-pad" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>직원 초대 코드</div>
          <p className="hint" style={{ marginTop: 0 }}>
            새 직원이 「계정 만들기」할 때 입력할 1회용 코드를 만듭니다. (공유 INVITE_CODE
            환경변수도 계속 사용 가능)
          </p>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              void createInviteCode().then((r) => {
                if (r.ok && r.code) setLastInvite(r.code)
              })
            }}
          >
            초대 코드 만들기
          </button>
          {lastInvite && (
            <p style={{ marginTop: 10, fontWeight: 600 }}>
              새 코드: <code>{lastInvite}</code>
            </p>
          )}
        </div>
      )}

      <div className="stack" style={{ gap: 16 }}>
        <section className="panel panel-pad">
          <div className="section-title">
            <h2>구성원 등록</h2>
          </div>
          <p className="hint" style={{ marginTop: -6, marginBottom: 10 }}>
            {authMode === 'local'
              ? '이름·부서·이메일·비밀번호로 계정을 만들면 바로 로그인하고 일일보고를 작성할 수 있습니다.'
              : '직원 프로필만 만듭니다. 본인 로그인은 해당 사용자가 Cursor로 가입 신청 후 승인받아야 합니다.'}
          </p>
          <div className={`join-direct-grid ${authMode === 'local' ? 'join-direct-grid-local' : ''}`}>
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
            {authMode === 'local' && (
              <>
                <div className="field">
                  <label style={{ fontSize: 12, fontWeight: 600 }}>이메일</label>
                  <input
                    type="email"
                    autoComplete="off"
                    value={directEmail}
                    onChange={(e) => setDirectEmail(e.target.value)}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="field">
                  <label style={{ fontSize: 12, fontWeight: 600 }}>비밀번호</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={directPassword}
                    onChange={(e) => setDirectPassword(e.target.value)}
                    placeholder="8자 이상"
                  />
                </div>
              </>
            )}
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <label style={{ fontSize: 12, visibility: 'hidden' }}>.</label>
              <button
                type="button"
                className="btn btn-primary"
                disabled={registerBusy}
                onClick={onDirect}
              >
                {registerBusy ? '등록 중…' : '등록'}
              </button>
            </div>
          </div>
        </section>

        <section className="panel panel-pad">
          <div className="section-title" style={{ marginBottom: 12 }}>
            <h2>구성원 목록</h2>
          </div>
          {membersLoading && members.length === 0 ? (
            <div className="empty" style={{ padding: 24 }}>
              불러오는 중…
            </div>
          ) : members.length === 0 ? (
            <div className="empty" style={{ padding: 24 }}>
              등록된 구성원이 없습니다.
            </div>
          ) : (
            <div className="join-app-list">
              {members.map((m) => (
                <article key={m.employeeId} className="join-app-row">
                  <div className="join-app-main">
                    <div className="join-app-title">
                      <strong>{m.name}</strong>
                      {m.linked ? (
                        <span className="badge badge-done">연결됨</span>
                      ) : (
                        <span className="badge badge-carry">미연결</span>
                      )}
                      {m.ooo && <span className="badge badge-revision">부재</span>}
                    </div>
                    <div className="hint">
                      {m.dept}
                      {' · '}
                      {m.role}
                      {m.email ? ` · ${m.email}` : ''}
                      {!m.linked && authMode === 'local'
                        ? ' · 로그인 계정 없음'
                        : !m.linked
                          ? ' · Cursor 가입 승인 대기'
                          : ''}
                    </div>
                  </div>
                  <div className="join-app-actions">
                    <button
                      type="button"
                      className="btn btn-danger-outline btn-sm"
                      disabled={m.accountRole === 'manager'}
                      title={
                        m.accountRole === 'manager'
                          ? '관리자는 삭제할 수 없습니다'
                          : '구성원 삭제'
                      }
                      onClick={() => setDeleteTarget(m)}
                    >
                      삭제
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel panel-pad">
          <div className="section-title" style={{ marginBottom: 12 }}>
            <h2>가입 신청</h2>
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
                        onClick={() =>
                          void approveJoinApplication(app.id).then(() => reloadMembers())
                        }
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
                        onClick={() =>
                          void cancelJoinApplication(app.id).then(() => reloadMembers())
                        }
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

      {deleteTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <h3 style={{ margin: '0 0 8px' }}>구성원 삭제</h3>
            <p className="hint" style={{ marginBottom: 10 }}>
              <strong>{deleteTarget.name}</strong>
              {deleteTarget.email ? ` (${deleteTarget.email})` : ''}을(를) 삭제합니다.
              연결된 로그인 계정·당일 보고·가입 기록이 함께 정리되어, 같은 이메일로 다시
              등록할 수 있습니다.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={deleteBusy}
                onClick={() => setDeleteTarget(null)}
              >
                취소
              </button>
              <button
                type="button"
                className="btn btn-danger-outline"
                disabled={deleteBusy}
                onClick={onConfirmDelete}
              >
                {deleteBusy ? '삭제 중…' : '삭제 확정'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
