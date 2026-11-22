'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ClientAction } from './actionTypes'
import type {
  AppSettings,
  AppState,
  DailyReport,
  Employee,
  ManagerAck,
  OooPeriod,
  ReflectStatus,
  ReportStatus,
  RoleView,
  Session,
  WorkItem,
} from './types'
import { createSeed } from './seed'

interface Toast {
  id: number
  message: string
}

type ActionResponse = {
  ok: boolean
  state?: AppState
  session?: Session
  message?: string
  error?: string
  blockerItemId?: string
  employeeId?: string
  name?: string
}

interface StoreValue {
  ready: boolean
  authError: string | null
  authMode: 'cursor' | 'local'
  state: AppState
  session: Session | null
  view: RoleView
  setView: (v: RoleView) => void
  actingAsEmployeeId: string
  setActingAsEmployeeId: (id: string) => void
  toast: Toast | null
  showToast: (message: string) => void
  refresh: () => Promise<void>
  resetSeed: () => Promise<void>
  logout: () => Promise<void> | void
  /** True when signed-in account has a pending join application (no role yet). */
  joinPending: boolean
  localLogin: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; message?: string }>
  localRegister: (input: {
    email: string
    password: string
    displayName: string
    inviteCode: string
  }) => Promise<{ ok: boolean; message?: string }>
  createInviteCode: () => Promise<{ ok: boolean; code?: string; message?: string }>
  getReport: (employeeId: string, date?: string) => DailyReport | undefined
  updateReport: (reportId: string, patch: Partial<DailyReport>) => Promise<void>
  saveDraft: (reportId: string) => Promise<void>
  submitReport: (reportId: string) => Promise<void>
  submitPlan: (reportId: string) => Promise<void>
  submitExecution: (reportId: string) => Promise<{ ok: boolean; blockerItemId?: string }>
  checkPlanItem: (reportId: string, planItemId: string) => Promise<void>
  addPlanItem: (reportId: string, text: string) => Promise<void>
  addAdHocExecution: (reportId: string, text: string) => Promise<void>
  updateWorkItem: (
    reportId: string,
    section: 'plan' | 'execution' | 'carryover',
    itemId: string,
    patch: Partial<WorkItem>,
  ) => Promise<void>
  addAttachmentUrl: (
    reportId: string,
    section: 'plan' | 'execution' | 'carryover',
    itemId: string,
    url: string,
  ) => Promise<void>
  addLocalFileAttachment: (
    reportId: string,
    section: 'plan' | 'execution' | 'carryover',
    itemId: string,
    file: File,
  ) => void
  setInstructionReflect: (
    reportId: string,
    instructionId: string,
    reflect: ReflectStatus,
  ) => Promise<void>
  remind: (employeeId: string) => Promise<void>
  leaveInstruction: (reportId: string, text: string) => Promise<void>
  confirmReport: (reportId: string) => Promise<void>
  requestRevision: (reportId: string, note: string) => Promise<void>
  setReportStatus: (reportId: string, status: ReportStatus) => Promise<void>
  setManagerAck: (reportId: string, ack: ManagerAck) => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  setEmployeeOoo: (employeeId: string, ooo: OooPeriod | null) => Promise<void>
  updateEmployee: (employeeId: string, patch: Partial<Employee>) => Promise<void>
  submitJoinApplication: (input: {
    name: string
    dept: string
    memo: string
  }) => Promise<boolean>
  approveJoinApplication: (id: string) => Promise<{ ok: boolean; name?: string }>
  rejectJoinApplication: (id: string, reason?: string) => Promise<void>
  cancelJoinApplication: (id: string) => Promise<void>
  registerEmployeeDirect: (input: {
    name: string
    dept: string
    role?: string
    email?: string
    password?: string
  }) => Promise<{ ok: boolean; employeeId?: string; message?: string }>
  deleteMember: (employeeId: string) => Promise<{ ok: boolean; message?: string }>
  fetchMembers: () => Promise<
    | {
        ok: true
        members: Array<{
          employeeId: string
          name: string
          dept: string
          role: string
          ooo: boolean
          linked: boolean
          cursorSub: string | null
          email: string | null
          accountRole: 'employee' | 'manager' | null
        }>
      }
    | { ok: false; message?: string }
  >
}

const StoreContext = createContext<StoreValue | null>(null)

async function postAction(action: ClientAction): Promise<ActionResponse> {
  const res = await fetch('/api/actions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  return (await res.json()) as ActionResponse
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<'cursor' | 'local'>('cursor')
  const [state, setState] = useState<AppState>(() => createSeed())
  const [session, setSession] = useState<Session | null>(null)
  const [view, setView] = useState<RoleView>('employee')
  const [actingAsEmployeeId, setActingAsEmployeeId] = useState('e1')
  const [toast, setToast] = useState<Toast | null>(null)
  const [joinPending, setJoinPending] = useState(false)

  const showToast = useCallback((message: string) => {
    const id = Date.now()
    setToast({ id, message })
    window.setTimeout(() => {
      setToast((t) => (t?.id === id ? null : t))
    }, 2800)
  }, [])

  const applySession = useCallback((s: Session) => {
    setSession(s)
    if (s.authMode) setAuthMode(s.authMode)
    if (s.role === 'manager') {
      setView('manager')
    } else if (s.role === 'employee') {
      setView('employee')
      if (s.employeeId) setActingAsEmployeeId(s.employeeId)
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const modeRes = await fetch('/api/auth/mode', { cache: 'no-store' })
      if (modeRes.ok) {
        const modeData = (await modeRes.json()) as { mode?: 'cursor' | 'local' }
        if (modeData.mode === 'local' || modeData.mode === 'cursor') {
          setAuthMode(modeData.mode)
        }
      }
    } catch {
      /* ignore */
    }

    const res = await fetch('/api/state', { cache: 'no-store' })
    if (res.status === 401) {
      let local = false
      try {
        const body = (await res.clone().json()) as { authMode?: string }
        local = body.authMode === 'local'
      } catch {
        /* ignore */
      }
      if (local) {
        setAuthMode('local')
        setAuthError(null)
      } else {
        setAuthError('로그인이 필요합니다. Cursor 계정으로 앱을 열어 주세요.')
      }
      setSession(null)
      setJoinPending(false)
      setReady(true)
      return
    }
    if (!res.ok) {
      setAuthError('세션을 불러오지 못했습니다.')
      setReady(true)
      return
    }
    const data = (await res.json()) as {
      session: Session
      state: AppState | null
      joinPending?: boolean
    }
    setAuthError(null)
    applySession(data.session)
    setJoinPending(Boolean(data.joinPending) && !data.session.role)
    if (data.state) {
      setState(data.state)
      if (!data.session.employeeId && data.state.employees[0]) {
        setActingAsEmployeeId(data.state.employees[0].id)
      }
    }
    setReady(true)
  }, [applySession])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const run = useCallback(
    async (action: ClientAction): Promise<ActionResponse> => {
      const result = await postAction(action)
      if (result.session) applySession(result.session)
      if (result.state) setState(result.state)
      if (result.message) showToast(result.message)
      else if (!result.ok && result.error === 'forbidden') {
        showToast('권한이 없습니다.')
      }
      return result
    },
    [applySession, showToast],
  )

  const localLogin = useCallback(
    async (email: string, password: string) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        session?: Session
        error?: string
        message?: string
      }
      if (!res.ok || !data.ok || !data.session) {
        return {
          ok: false,
          message:
            data.message ??
            (data.error === 'invalid_credentials'
              ? '이메일 또는 비밀번호가 올바르지 않습니다.'
              : '로그인에 실패했습니다.'),
        }
      }
      applySession(data.session)
      setAuthError(null)
      await refresh()
      return { ok: true }
    },
    [applySession, refresh],
  )

  const localRegister = useCallback(
    async (input: {
      email: string
      password: string
      displayName: string
      inviteCode: string
    }) => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = (await res.json()) as {
        ok?: boolean
        session?: Session
        error?: string
        message?: string
      }
      if (!res.ok || !data.ok || !data.session) {
        return {
          ok: false,
          message: data.message ?? '가입에 실패했습니다.',
        }
      }
      applySession(data.session)
      setAuthError(null)
      await refresh()
      return { ok: true }
    },
    [applySession, refresh],
  )

  const createInviteCode = useCallback(async () => {
    const res = await fetch('/api/auth/invite', { method: 'POST' })
    const data = (await res.json()) as {
      ok?: boolean
      code?: string
      error?: string
      message?: string
    }
    if (!res.ok || !data.ok || !data.code) {
      return { ok: false, message: data.message ?? '초대 코드 생성 실패' }
    }
    showToast(`초대 코드: ${data.code}`)
    return { ok: true, code: data.code }
  }, [showToast])

  const logout = useCallback(async () => {
    if (authMode === 'local') {
      try {
        await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' })
      } catch {
        /* still clear client session */
      }
      setSession(null)
      setJoinPending(false)
      setAuthError(null)
      showToast('로그아웃했습니다.')
      return
    }
    showToast('Cursor 앱 접근을 종료하려면 창을 닫아 주세요. (서버 역할은 유지됩니다)')
  }, [authMode, showToast])

  const getReport = useCallback(
    (employeeId: string, date?: string) => {
      const d = date ?? state.currentDate
      return state.reports.find((r) => r.employeeId === employeeId && r.date === d)
    },
    [state.reports, state.currentDate],
  )

  const resetSeed = useCallback(async () => {
    await run({ type: 'resetSeed' })
  }, [run])

  const updateReport = useCallback(
    async (reportId: string, patch: Partial<DailyReport>) => {
      await run({ type: 'updateReport', reportId, patch })
    },
    [run],
  )

  const saveDraft = useCallback(
    async (reportId: string) => {
      await run({ type: 'saveDraft', reportId })
    },
    [run],
  )

  const submitPlan = useCallback(
    async (reportId: string) => {
      await run({ type: 'submitPlan', reportId })
    },
    [run],
  )

  const submitExecution = useCallback(
    async (reportId: string) => {
      const result = await run({ type: 'submitExecution', reportId })
      return { ok: result.ok, blockerItemId: result.blockerItemId }
    },
    [run],
  )

  const submitReport = useCallback(
    async (reportId: string) => {
      await submitExecution(reportId)
    },
    [submitExecution],
  )

  const checkPlanItem = useCallback(
    async (reportId: string, planItemId: string) => {
      await run({ type: 'checkPlanItem', reportId, planItemId })
    },
    [run],
  )

  const addPlanItem = useCallback(
    async (reportId: string, text: string) => {
      await run({ type: 'addPlanItem', reportId, text })
    },
    [run],
  )

  const addAdHocExecution = useCallback(
    async (reportId: string, text: string) => {
      await run({ type: 'addAdHocExecution', reportId, text })
    },
    [run],
  )

  const updateWorkItem = useCallback(
    async (
      reportId: string,
      section: 'plan' | 'execution' | 'carryover',
      itemId: string,
      patch: Partial<WorkItem>,
    ) => {
      await run({ type: 'updateWorkItem', reportId, section, itemId, patch })
    },
    [run],
  )

  const addAttachmentUrl = useCallback(
    async (
      reportId: string,
      section: 'plan' | 'execution' | 'carryover',
      itemId: string,
      url: string,
    ) => {
      await run({ type: 'addAttachmentUrl', reportId, section, itemId, url })
    },
    [run],
  )

  const addLocalFileAttachment = useCallback(
    (_reportId: string, _section: 'plan' | 'execution' | 'carryover', _itemId: string, file: File) => {
      const maxBytes = 5 * 1024 * 1024
      if (file.size > maxBytes) {
        showToast('5MB 이하 파일만 미리보기할 수 있습니다.')
        return
      }
      showToast('로컬 파일 미리보기는 서버 저장 없이 브라우저에서만 가능합니다. URL 첨부를 사용해 주세요.')
    },
    [showToast],
  )

  const setInstructionReflect = useCallback(
    async (reportId: string, instructionId: string, reflect: ReflectStatus) => {
      await run({ type: 'setInstructionReflect', reportId, instructionId, reflect })
    },
    [run],
  )

  const remind = useCallback(
    async (employeeId: string) => {
      await run({ type: 'remind', employeeId })
    },
    [run],
  )

  const leaveInstruction = useCallback(
    async (reportId: string, text: string) => {
      await run({ type: 'leaveInstruction', reportId, text })
    },
    [run],
  )

  const confirmReport = useCallback(
    async (reportId: string) => {
      await run({ type: 'confirmReport', reportId })
    },
    [run],
  )

  const requestRevision = useCallback(
    async (reportId: string, note: string) => {
      await run({ type: 'requestRevision', reportId, note })
    },
    [run],
  )

  const setReportStatus = useCallback(
    async (reportId: string, status: ReportStatus) => {
      await run({ type: 'setReportStatus', reportId, status })
    },
    [run],
  )

  const setManagerAck = useCallback(
    async (reportId: string, ack: ManagerAck) => {
      await run({ type: 'setManagerAck', reportId, ack })
    },
    [run],
  )

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      await run({ type: 'updateSettings', patch })
    },
    [run],
  )

  const setEmployeeOoo = useCallback(
    async (employeeId: string, ooo: OooPeriod | null) => {
      await run({ type: 'setEmployeeOoo', employeeId, ooo })
    },
    [run],
  )

  const updateEmployee = useCallback(
    async (employeeId: string, patch: Partial<Employee>) => {
      await run({ type: 'updateEmployee', employeeId, patch })
    },
    [run],
  )

  const submitJoinApplication = useCallback(
    async (input: { name: string; dept: string; memo: string }) => {
      const result = await run({
        type: 'submitJoin',
        name: input.name,
        dept: input.dept,
        memo: input.memo,
      })
      if (result.ok) setJoinPending(true)
      return result.ok
    },
    [run],
  )

  const approveJoinApplication = useCallback(
    async (id: string) => {
      const result = await run({ type: 'approveJoin', id })
      return { ok: result.ok, name: result.name }
    },
    [run],
  )

  const rejectJoinApplication = useCallback(
    async (id: string, reason?: string) => {
      await run({ type: 'rejectJoin', id, reason })
    },
    [run],
  )

  const cancelJoinApplication = useCallback(
    async (id: string) => {
      await run({ type: 'cancelJoin', id })
    },
    [run],
  )

  const registerEmployeeDirect = useCallback(
    async (input: {
      name: string
      dept: string
      role?: string
      email?: string
      password?: string
    }) => {
      const result = await run({
        type: 'registerEmployee',
        name: input.name,
        dept: input.dept,
        role: input.role,
        email: input.email,
        password: input.password,
      })
      return {
        ok: result.ok,
        employeeId: result.employeeId,
        message: result.message,
      }
    },
    [run],
  )

  const deleteMember = useCallback(
    async (employeeId: string) => {
      const result = await run({ type: 'deleteMember', employeeId })
      return { ok: result.ok, message: result.message }
    },
    [run],
  )

  const fetchMembers = useCallback(async () => {
    const res = await fetch('/api/members', { cache: 'no-store' })
    const data = (await res.json()) as {
      ok?: boolean
      members?: Array<{
        employeeId: string
        name: string
        dept: string
        role: string
        ooo: boolean
        linked: boolean
        cursorSub: string | null
        email: string | null
        accountRole: 'employee' | 'manager' | null
      }>
      error?: string
      message?: string
    }
    if (!res.ok || !data.ok || !data.members) {
      return {
        ok: false as const,
        message: data.message ?? '구성원 목록을 불러오지 못했습니다.',
      }
    }
    return { ok: true as const, members: data.members }
  }, [])

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      authError,
      authMode,
      state,
      session,
      view,
      setView,
      actingAsEmployeeId,
      setActingAsEmployeeId,
      toast,
      joinPending,
      showToast,
      refresh,
      resetSeed,
      logout,
      localLogin,
      localRegister,
      createInviteCode,
      getReport,
      updateReport,
      saveDraft,
      submitReport,
      submitPlan,
      submitExecution,
      checkPlanItem,
      addPlanItem,
      addAdHocExecution,
      updateWorkItem,
      addAttachmentUrl,
      addLocalFileAttachment,
      setInstructionReflect,
      remind,
      leaveInstruction,
      confirmReport,
      requestRevision,
      setReportStatus,
      setManagerAck,
      updateSettings,
      setEmployeeOoo,
      updateEmployee,
      submitJoinApplication,
      approveJoinApplication,
      rejectJoinApplication,
      cancelJoinApplication,
      registerEmployeeDirect,
      deleteMember,
      fetchMembers,
    }),
    [
      ready,
      authError,
      authMode,
      state,
      session,
      view,
      actingAsEmployeeId,
      toast,
      joinPending,
      showToast,
      refresh,
      resetSeed,
      logout,
      localLogin,
      localRegister,
      createInviteCode,
      getReport,
      updateReport,
      saveDraft,
      submitReport,
      submitPlan,
      submitExecution,
      checkPlanItem,
      addPlanItem,
      addAdHocExecution,
      updateWorkItem,
      addAttachmentUrl,
      addLocalFileAttachment,
      setInstructionReflect,
      remind,
      leaveInstruction,
      confirmReport,
      requestRevision,
      setReportStatus,
      setManagerAck,
      updateSettings,
      setEmployeeOoo,
      updateEmployee,
      submitJoinApplication,
      approveJoinApplication,
      rejectJoinApplication,
      cancelJoinApplication,
      registerEmployeeDirect,
      deleteMember,
      fetchMembers,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
