import { EmployeeForm } from './components/EmployeeForm'
import { LoginScreen } from './components/LoginScreen'
import { ManagerBoard } from './components/ManagerBoard'
import { MonthlySummary } from './components/MonthlySummary'
import { SettingsScreen } from './components/SettingsScreen'
import { WeeklySummary } from './components/WeeklySummary'
import { useStore } from './store'

export default function App() {
  const {
    view,
    setView,
    state,
    toast,
    resetSeed,
    session,
    logout,
  } = useStore()

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
    <div className="app-shell">
      <header className="topnav">
        <div className="brand">
          <div className="brand-mark">일</div>
          일일업무보고
        </div>
        <nav>
          {!isManager && (
            <button
              type="button"
              className={view === 'employee' ? 'active' : ''}
              onClick={() => setView('employee')}
            >
              직원 작성
            </button>
          )}
          {isManager && (
            <>
              <button
                type="button"
                className={view === 'manager' ? 'active' : ''}
                onClick={() => setView('manager')}
              >
                매니저 보드
              </button>
              <button
                type="button"
                className={view === 'weekly' ? 'active' : ''}
                onClick={() => setView('weekly')}
              >
                주간 요약
              </button>
              <button
                type="button"
                className={view === 'monthly' ? 'active' : ''}
                onClick={() => setView('monthly')}
              >
                월간 리포트
              </button>
            </>
          )}
          <button
            type="button"
            className={view === 'settings' ? 'active' : ''}
            onClick={() => setView('settings')}
          >
            설정
          </button>
        </nav>
        <div className="spacer" />
        <div className="meta">
          <span>
            {session.displayName}
            {session.role === 'manager' ? ' · 관리자' : ''}
          </span>
          <span>{state.currentDate}</span>
          <button type="button" className="ghost-btn" onClick={resetSeed}>
            시드 리셋
          </button>
          <button type="button" className="ghost-btn" onClick={logout}>
            로그아웃
          </button>
        </div>
      </header>

      {!isManager && view === 'employee' && <EmployeeForm />}
      {isManager && view === 'manager' && <ManagerBoard />}
      {isManager && view === 'weekly' && <WeeklySummary />}
      {isManager && view === 'monthly' && <MonthlySummary />}
      {view === 'settings' && <SettingsScreen />}
      {/* fallback if employee lands on manager-only view */}
      {!isManager && view !== 'employee' && view !== 'settings' && <EmployeeForm />}

      {toast && <div className="toast">{toast.message}</div>}
    </div>
  )
}
