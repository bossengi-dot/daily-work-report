'use client'

import { EmployeeForm } from './components/EmployeeForm'
import { JoinAdminScreen } from './components/JoinAdminScreen'
import { LoginScreen } from './components/LoginScreen'
import { ManagerBoard } from './components/ManagerBoard'
import { MonthlySummary } from './components/MonthlySummary'
import { SettingsScreen } from './components/SettingsScreen'
import { WeeklySummary } from './components/WeeklySummary'
import { useStore } from './store'

export default function App() {
  const { ready, view, setView, state, toast, session, logout } = useStore()

  if (!ready) {
    return (
      <div className="login-page">
        <div className="hint">불러오는 중…</div>
      </div>
    )
  }

  if (!session || !session.role) {
    return (
      <>
        <LoginScreen />
        {toast && <div className="toast">{toast.message}</div>}
      </>
    )
  }

  const isManager = session.role === 'manager'

  return (
    <div className={`app-shell ${isManager ? 'with-sidenav' : ''}`}>
      {isManager && (
        <aside className="sidenav">
          <div className="sidenav-brand">
            <div className="brand-mark">일</div>
            <span>일일업무</span>
          </div>
          <nav>
            <button
              type="button"
              className={view === 'manager' ? 'active' : ''}
              onClick={() => setView('manager')}
            >
              일일
            </button>
            <button
              type="button"
              className={view === 'weekly' ? 'active' : ''}
              onClick={() => setView('weekly')}
            >
              주간
            </button>
            <button
              type="button"
              className={view === 'monthly' ? 'active' : ''}
              onClick={() => setView('monthly')}
            >
              월간
            </button>
            <button
              type="button"
              className={view === 'join-admin' ? 'active' : ''}
              onClick={() => setView('join-admin')}
            >
              가입신청
              {state.joinApplications.some((j) => j.status === 'pending') && (
                <span className="nav-dot" aria-hidden />
              )}
            </button>
            <button
              type="button"
              className={view === 'settings' ? 'active' : ''}
              onClick={() => setView('settings')}
            >
              설정
            </button>
          </nav>
          <div className="sidenav-foot">
            <div className="hint">{session.displayName}</div>
            {session.simulated && <div className="hint">시뮬 뷰어</div>}
            <button type="button" className="ghost-btn" onClick={logout}>
              안내
            </button>
          </div>
        </aside>
      )}

      <div className="app-main">
        <header className="topnav">
          {!isManager && (
            <>
              <div className="brand">
                <div className="brand-mark">일</div>
                일일업무보고
              </div>
              <nav>
                <button
                  type="button"
                  className={view === 'employee' ? 'active' : ''}
                  onClick={() => setView('employee')}
                >
                  작성
                </button>
                <button
                  type="button"
                  className={view === 'settings' ? 'active' : ''}
                  onClick={() => setView('settings')}
                >
                  설정
                </button>
              </nav>
            </>
          )}
          {isManager && (
            <div className="brand">
              <span className="hint" style={{ color: 'var(--slate-300)' }}>
                {view === 'manager'
                  ? '매니저 보드'
                  : view === 'weekly'
                    ? '주간 요약'
                    : view === 'monthly'
                      ? '월간 리포트'
                      : view === 'join-admin'
                        ? '가입신청'
                        : '설정'}
              </span>
            </div>
          )}
          <div className="spacer" />
          <div className="meta">
            {!isManager && <span>{session.displayName}</span>}
            <span>{state.currentDate}</span>
            {!isManager && (
              <button type="button" className="ghost-btn" onClick={logout}>
                안내
              </button>
            )}
          </div>
        </header>

        {!isManager && view === 'employee' && <EmployeeForm />}
        {isManager && view === 'manager' && <ManagerBoard />}
        {isManager && view === 'weekly' && <WeeklySummary />}
        {isManager && view === 'monthly' && <MonthlySummary />}
        {isManager && view === 'join-admin' && <JoinAdminScreen />}
        {view === 'settings' && <SettingsScreen />}
        {!isManager && view !== 'employee' && view !== 'settings' && <EmployeeForm />}

        {toast && <div className="toast">{toast.message}</div>}
      </div>
    </div>
  )
}
