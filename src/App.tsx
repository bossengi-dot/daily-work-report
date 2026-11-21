import { EmployeeForm } from './components/EmployeeForm'
import { LoginScreen } from './components/LoginScreen'
import { ManagerBoard } from './components/ManagerBoard'
import { MonthlySummary } from './components/MonthlySummary'
import { SettingsScreen } from './components/SettingsScreen'
import { WeeklySummary } from './components/WeeklySummary'
import { useStore } from './store'

export default function App() {
  const { view, setView, state, toast, session, logout } = useStore()

  if (!session) {
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
              className={view === 'settings' ? 'active' : ''}
              onClick={() => setView('settings')}
            >
              설정
            </button>
          </nav>
          <div className="sidenav-foot">
            <div className="hint">{session.displayName}</div>
            <button type="button" className="ghost-btn" onClick={logout}>
              로그아웃
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
                로그아웃
              </button>
            )}
          </div>
        </header>

        {!isManager && view === 'employee' && <EmployeeForm />}
        {isManager && view === 'manager' && <ManagerBoard />}
        {isManager && view === 'weekly' && <WeeklySummary />}
        {isManager && view === 'monthly' && <MonthlySummary />}
        {view === 'settings' && <SettingsScreen />}
        {!isManager && view !== 'employee' && view !== 'settings' && <EmployeeForm />}

        {toast && <div className="toast">{toast.message}</div>}
      </div>
    </div>
  )
}
