import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  createSeed,
  MANAGER_PIN,
  SESSION_KEY,
  SETTINGS_KEY,
  STORAGE_KEY,
} from './seed'
import type {
  AppSettings,
  AppState,
  Attachment,
  CeoInstruction,
  DailyReport,
  Employee,
  JoinApplication,
  ManagerAck,
  OooPeriod,
  ReflectStatus,
  ReportStatus,
  RoleView,
  Session,
  WorkItem,
} from './types'
import { DEFAULT_SETTINGS } from './types'

interface Toast {
  id: number
  message: string
}

function nowStamp(date: string) {
  const now = new Date()
  return `${date} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS }
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) return JSON.parse(raw) as Session
  } catch {
    /* ignore */
  }
  return null
}

function loadState(): AppState {
  const seed = createSeed()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>
      return {
        ...seed,
        ...parsed,
        settings: loadSettings(),
        monthRange: parsed.monthRange ?? seed.monthRange,
        employees: (parsed.employees ?? seed.employees).map((e) => ({
          ...e,
          pin: e.pin || '1111',
        })),
        joinApplications: parsed.joinApplications ?? seed.joinApplications,
      }
    }
  } catch {
    /* ignore */
  }
  seed.settings = loadSettings()
  return seed
}

function randomPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}

function initialsOf(name: string): string {
  return name.trim().slice(0, 1) || '?'
}

interface StoreValue {
  state: AppState
  session: Session | null
  view: RoleView
  setView: (v: RoleView) => void
  actingAsEmployeeId: string
  setActingAsEmployeeId: (id: string) => void
  toast: Toast | null
  showToast: (message: string) => void
  resetSeed: () => void
  loginEmployee: (employeeId: string, pin: string) => boolean
  loginManager: (pin: string) => boolean
  logout: () => void
  getReport: (employeeId: string, date?: string) => DailyReport | undefined
  updateReport: (reportId: string, patch: Partial<DailyReport>) => void
  saveDraft: (reportId: string) => void
  submitReport: (reportId: string) => void
  submitPlan: (reportId: string) => void
  /** returns false + first blocker item id when validation fails */
  submitExecution: (reportId: string) => { ok: boolean; blockerItemId?: string }
  checkPlanItem: (reportId: string, planItemId: string) => void
  addPlanItem: (reportId: string, text: string) => void
  addAdHocExecution: (reportId: string, text: string) => void
  updateWorkItem: (
    reportId: string,
    section: 'plan' | 'execution' | 'carryover',
    itemId: string,
    patch: Partial<WorkItem>,
  ) => void
  addAttachmentUrl: (
    reportId: string,
    section: 'plan' | 'execution' | 'carryover',
    itemId: string,
    url: string,
  ) => void
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
  ) => void
  remind: (employeeId: string) => void
  leaveInstruction: (reportId: string, text: string) => void
  confirmReport: (reportId: string) => void
  requestRevision: (reportId: string, note: string) => void
  setReportStatus: (reportId: string, status: ReportStatus) => void
  setManagerAck: (reportId: string, ack: ManagerAck) => void
  updateSettings: (patch: Partial<AppSettings>) => void
  setEmployeeOoo: (employeeId: string, ooo: OooPeriod | null) => void
  updateEmployee: (employeeId: string, patch: Partial<Employee>) => void
  submitJoinApplication: (input: {
    name: string
    dept: string
    desiredPin?: string
    memo: string
  }) => boolean
  approveJoinApplication: (id: string) => { ok: boolean; pin?: string; name?: string }
  rejectJoinApplication: (id: string, reason?: string) => void
  cancelJoinApplication: (id: string) => void
  registerEmployeeDirect: (input: {
    name: string
    dept: string
    pin?: string
    role?: string
  }) => { ok: boolean; pin?: string; employeeId?: string }
  lastIssuedPin: { name: string; pin: string } | null
  clearLastIssuedPin: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState)
  const [session, setSession] = useState<Session | null>(loadSession)
  const [view, setView] = useState<RoleView>('employee')
  const [actingAsEmployeeId, setActingAsEmployeeId] = useState(
    () => loadSession()?.employeeId ?? 'e1',
  )
  const [toast, setToast] = useState<Toast | null>(null)
  const [lastIssuedPin, setLastIssuedPin] = useState<{
    name: string
    pin: string
  } | null>(null)

  useEffect(() => {
    const { settings: _s, ...rest } = state
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
  }, [state])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings))
  }, [state.settings])

  useEffect(() => {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  }, [session])

  const showToast = useCallback((message: string) => {
    const id = Date.now()
    setToast({ id, message })
    window.setTimeout(() => {
      setToast((t) => (t?.id === id ? null : t))
    }, 2800)
  }, [])

  const resetSeed = useCallback(() => {
    const seed = createSeed()
    seed.settings = loadSettings()
    setState(seed)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...seed, settings: undefined }))
    showToast('시드 데이터로 초기화했습니다. (설정·세션 유지)')
  }, [showToast])

  const loginEmployee = useCallback(
    (employeeId: string, pin: string) => {
      const emp = state.employees.find((e) => e.id === employeeId)
      if (!emp || emp.pin !== pin.trim()) {
        showToast('PIN이 올바르지 않습니다.')
        return false
      }
      const s: Session = {
        role: 'employee',
        employeeId: emp.id,
        displayName: emp.name,
      }
      setSession(s)
      setActingAsEmployeeId(emp.id)
      setView('employee')
      showToast(`${emp.name}님으로 로그인했습니다.`)
      return true
    },
    [state.employees, showToast],
  )

  const loginManager = useCallback(
    (pin: string) => {
      if (pin.trim() !== MANAGER_PIN) {
        showToast('관리자 PIN이 올바르지 않습니다.')
        return false
      }
      const s: Session = {
        role: 'manager',
        employeeId: null,
        displayName: '관리자',
      }
      setSession(s)
      setView('manager')
      showToast('관리자로 로그인했습니다.')
      return true
    },
    [showToast],
  )

  const logout = useCallback(() => {
    setSession(null)
    showToast('로그아웃했습니다.')
  }, [showToast])

  const getReport = useCallback(
    (employeeId: string, date?: string) => {
      const d = date ?? state.currentDate
      return state.reports.find((r) => r.employeeId === employeeId && r.date === d)
    },
    [state.reports, state.currentDate],
  )

  const updateReport = useCallback((reportId: string, patch: Partial<DailyReport>) => {
    setState((s) => ({
      ...s,
      reports: s.reports.map((r) => (r.id === reportId ? { ...r, ...patch } : r)),
    }))
  }, [])

  const saveDraft = useCallback(
    (reportId: string) => {
      const stamp = nowStamp(state.currentDate)
      const report = state.reports.find((r) => r.id === reportId)
      const patch: Partial<DailyReport> = { draftSavedAt: stamp }
      if (!report || report.status === 'draft' || report.status === 'revision') {
        patch.status = 'draft'
      }
      updateReport(reportId, patch)
      showToast('임시저장되었습니다.')
    },
    [state.currentDate, state.reports, updateReport, showToast],
  )

  const submitPlan = useCallback(
    (reportId: string) => {
      const report = state.reports.find((r) => r.id === reportId)
      if (!report) return
      const emp = state.employees.find((e) => e.id === report.employeeId)
      if (emp?.ooo && state.currentDate >= emp.ooo.start && state.currentDate <= emp.ooo.end) {
        showToast('부재 기간에는 제출이 면제됩니다.')
        return
      }
      if (report.plan.length === 0 && report.execution.length === 0) {
        showToast('계획 항목을 하나 이상 추가해 주세요.')
        return
      }
      const stamp = nowStamp(state.currentDate)
      updateReport(reportId, {
        planSubmittedAt: stamp,
        status: report.execSubmittedAt ? report.status : 'draft',
      })
      showToast('오전 계획을 제출했습니다.')
    },
    [state.reports, state.employees, state.currentDate, updateReport, showToast],
  )

  const submitExecution = useCallback(
    (reportId: string): { ok: boolean; blockerItemId?: string } => {
      const report = state.reports.find((r) => r.id === reportId)
      if (!report) return { ok: false }
      const emp = state.employees.find((e) => e.id === report.employeeId)
      if (emp?.ooo && state.currentDate >= emp.ooo.start && state.currentDate <= emp.ooo.end) {
        showToast('부재 기간에는 제출이 면제됩니다.')
        return { ok: false }
      }
      if (!report.planSubmittedAt && !report.submittedAt) {
        showToast('먼저 오전 계획을 제출해 주세요.')
        return { ok: false }
      }
      const blockers = [...report.execution, ...report.carryover].filter(
        (i) => i.status === 'blocker',
      )
      for (const b of blockers) {
        if (!b.blockerReason?.trim()) {
          showToast('블로커 항목에 사유를 입력해 주세요.')
          return { ok: false, blockerItemId: b.id }
        }
      }
      const stamp = nowStamp(state.currentDate)
      updateReport(reportId, {
        execSubmittedAt: stamp,
        submittedAt: stamp,
        status: 'submitted',
        managerAck: null,
      })
      showToast('실행·이월을 마감 제출했습니다.')
      return { ok: true }
    },
    [state.reports, state.employees, state.currentDate, updateReport, showToast],
  )

  const submitReport = useCallback(
    (reportId: string) => {
      submitExecution(reportId)
    },
    [submitExecution],
  )

  const checkPlanItem = useCallback((reportId: string, planItemId: string) => {
    setState((s) => ({
      ...s,
      reports: s.reports.map((r) => {
        if (r.id !== reportId) return r
        const item = r.plan.find((p) => p.id === planItemId)
        if (!item) return r
        const moved: WorkItem = {
          ...item,
          id: uid('x'),
          fromPlanId: item.id,
          status: 'in_progress',
          checked: undefined,
        }
        return {
          ...r,
          plan: r.plan.filter((p) => p.id !== planItemId),
          execution: [...r.execution, moved],
        }
      }),
    }))
  }, [])

  const addPlanItem = useCallback((reportId: string, text: string) => {
    if (!text.trim()) return
    setState((s) => ({
      ...s,
      reports: s.reports.map((r) =>
        r.id !== reportId
          ? r
          : {
              ...r,
              plan: [
                ...r.plan,
                { id: uid('p'), text: text.trim(), hours: 1, attachments: [], checked: false },
              ],
            },
      ),
    }))
  }, [])

  const addAdHocExecution = useCallback((reportId: string, text: string) => {
    if (!text.trim()) return
    setState((s) => ({
      ...s,
      reports: s.reports.map((r) =>
        r.id !== reportId
          ? r
          : {
              ...r,
              execution: [
                ...r.execution,
                {
                  id: uid('x'),
                  text: text.trim(),
                  status: 'in_progress',
                  hours: 1,
                  isAdHoc: true,
                  attachments: [],
                },
              ],
            },
      ),
    }))
  }, [])

  const updateWorkItem = useCallback(
    (
      reportId: string,
      section: 'plan' | 'execution' | 'carryover',
      itemId: string,
      patch: Partial<WorkItem>,
    ) => {
      setState((s) => ({
        ...s,
        reports: s.reports.map((r) => {
          if (r.id !== reportId) return r
          return {
            ...r,
            [section]: r[section].map((item) =>
              item.id === itemId ? { ...item, ...patch } : item,
            ),
          }
        }),
      }))
    },
    [],
  )

  const pushAttachment = useCallback(
    (
      reportId: string,
      section: 'plan' | 'execution' | 'carryover',
      itemId: string,
      att: Attachment,
    ) => {
      setState((s) => ({
        ...s,
        reports: s.reports.map((r) => {
          if (r.id !== reportId) return r
          return {
            ...r,
            [section]: r[section].map((item) => {
              if (item.id !== itemId) return item
              if (item.attachments.length >= 3) return item
              return { ...item, attachments: [...item.attachments, att] }
            }),
          }
        }),
      }))
    },
    [],
  )

  const addAttachmentUrl = useCallback(
    (
      reportId: string,
      section: 'plan' | 'execution' | 'carryover',
      itemId: string,
      url: string,
    ) => {
      if (!url.trim()) return
      pushAttachment(reportId, section, itemId, {
        id: uid('att'),
        kind: 'url',
        label: url.trim().slice(0, 40),
        url: url.trim(),
      })
    },
    [pushAttachment],
  )

  const addLocalFileAttachment = useCallback(
    (
      reportId: string,
      section: 'plan' | 'execution' | 'carryover',
      itemId: string,
      file: File,
    ) => {
      const maxBytes = 5 * 1024 * 1024
      if (file.size > maxBytes) {
        showToast('5MB 이하 파일만 미리보기할 수 있습니다.')
        return
      }
      const objectUrl = URL.createObjectURL(file)
      const kind = file.type.startsWith('image/') ? 'image' : 'file'
      pushAttachment(reportId, section, itemId, {
        id: uid('att'),
        kind: kind as 'image' | 'file',
        label: file.name,
        url: objectUrl,
        localMeta: {
          name: file.name,
          size: file.size,
          mime: file.type || 'application/octet-stream',
          ephemeral: true,
        },
      })
      showToast('로컬 미리보기 첨부됨 (새로고침 시 URL 만료 · 바이너리 미저장)')
    },
    [pushAttachment, showToast],
  )

  const setInstructionReflect = useCallback(
    (reportId: string, instructionId: string, reflect: ReflectStatus) => {
      setState((s) => ({
        ...s,
        reports: s.reports.map((r) => {
          if (r.id !== reportId) return r
          return {
            ...r,
            instructions: r.instructions.map((i) =>
              i.id === instructionId ? { ...i, reflect } : i,
            ),
          }
        }),
      }))
    },
    [],
  )

  const remind = useCallback(
    (employeeId: string) => {
      const emp = state.employees.find((e) => e.id === employeeId)
      if (
        emp?.ooo &&
        state.currentDate >= emp.ooo.start &&
        state.currentDate <= emp.ooo.end
      ) {
        showToast(`${emp.name}은(는) 부재 중이라 리마인드를 보내지 않습니다.`)
        return
      }
      const report = state.reports.find(
        (r) => r.employeeId === employeeId && r.date === state.currentDate,
      )
      const morningOnly =
        report &&
        (report.planSubmittedAt || report.submittedAt) &&
        !report.execSubmittedAt &&
        report.status !== 'submitted' &&
        report.status !== 'reviewing' &&
        report.status !== 'done'
      const msg = morningOnly
        ? `${emp?.name ?? '직원'}에게 저녁 마감 독촉을 보냈습니다.`
        : `${emp?.name ?? '직원'}에게 오늘 보고 독촉을 보냈습니다.`
      showToast(msg)
    },
    [state.employees, state.reports, state.currentDate, showToast],
  )

  const leaveInstruction = useCallback(
    (reportId: string, text: string) => {
      if (!text.trim()) {
        showToast('지시 내용을 입력해 주세요.')
        return
      }
      const instruction: CeoInstruction = {
        id: uid('i'),
        date: state.currentDate,
        text: text.trim(),
        reflect: 'unreflected',
      }
      setState((s) => ({
        ...s,
        reports: s.reports.map((r) =>
          r.id !== reportId
            ? r
            : { ...r, instructions: [instruction, ...r.instructions] },
        ),
      }))
      showToast('지시를 남겼습니다.')
    },
    [state.currentDate, showToast],
  )

  const confirmReport = useCallback(
    (reportId: string) => {
      updateReport(reportId, { status: 'done', managerAck: 'confirmed' })
      showToast('확인 완료로 표시했습니다.')
    },
    [updateReport, showToast],
  )

  const setManagerAck = useCallback(
    (reportId: string, ack: ManagerAck) => {
      const patch: Partial<DailyReport> = { managerAck: ack }
      if (ack) patch.status = 'done'
      updateReport(reportId, patch)
      if (ack === 'thumbsup') showToast('👍 반응으로 검토 완료했습니다.')
      else if (ack === 'confirmed') showToast('확인으로 검토 완료했습니다.')
    },
    [updateReport, showToast],
  )

  const requestRevision = useCallback(
    (reportId: string, note: string) => {
      if (!note.trim()) {
        showToast('보완요청 사유를 입력해 주세요.')
        return
      }
      updateReport(reportId, {
        status: 'revision',
        revisionNote: note.trim(),
        managerAck: null,
      })
      showToast('보완요청을 보냈습니다.')
    },
    [updateReport, showToast],
  )

  const setReportStatus = useCallback(
    (reportId: string, status: ReportStatus) => {
      updateReport(reportId, { status })
    },
    [updateReport],
  )

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
  }, [])

  const setEmployeeOoo = useCallback((employeeId: string, ooo: OooPeriod | null) => {
    setState((s) => ({
      ...s,
      employees: s.employees.map((e) => (e.id === employeeId ? { ...e, ooo } : e)),
    }))
  }, [])

  const updateEmployee = useCallback((employeeId: string, patch: Partial<Employee>) => {
    setState((s) => ({
      ...s,
      employees: s.employees.map((e) => (e.id === employeeId ? { ...e, ...patch } : e)),
    }))
  }, [])

  const clearLastIssuedPin = useCallback(() => setLastIssuedPin(null), [])

  const submitJoinApplication = useCallback(
    (input: { name: string; dept: string; desiredPin?: string; memo: string }) => {
      const name = input.name.trim()
      const dept = input.dept.trim()
      if (!name || !dept) {
        showToast('이름과 부서를 입력해 주세요.')
        return false
      }
      if (state.employees.some((e) => e.name === name)) {
        showToast('이미 등록된 이름입니다. 관리자에게 문의하세요.')
        return false
      }
      if (
        state.joinApplications.some(
          (j) => j.status === 'pending' && j.name === name,
        )
      ) {
        showToast('이미 대기 중인 가입 신청이 있습니다.')
        return false
      }
      const pin = input.desiredPin?.trim()
      if (pin && !/^\d{4}$/.test(pin)) {
        showToast('희망 PIN은 숫자 4자리여야 합니다.')
        return false
      }
      const app: JoinApplication = {
        id: uid('ja'),
        name,
        dept,
        desiredPin: pin || undefined,
        memo: input.memo.trim(),
        status: 'pending',
        createdAt: nowStamp(state.currentDate),
      }
      setState((s) => ({
        ...s,
        joinApplications: [app, ...s.joinApplications],
      }))
      showToast('가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.')
      return true
    },
    [state.employees, state.joinApplications, state.currentDate, showToast],
  )

  const approveJoinApplication = useCallback(
    (id: string): { ok: boolean; pin?: string; name?: string } => {
      const app = state.joinApplications.find((j) => j.id === id)
      if (!app || app.status !== 'pending') {
        showToast('대기 중인 신청이 아닙니다.')
        return { ok: false }
      }
      let pin = app.desiredPin?.trim()
      let generated = false
      if (!pin || !/^\d{4}$/.test(pin)) {
        pin = randomPin()
        generated = true
      }
      const employeeId = uid('e')
      const employee: Employee = {
        id: employeeId,
        name: app.name,
        dept: app.dept,
        role: '팀원',
        initials: initialsOf(app.name),
        pin,
        ooo: null,
      }
      const stamp = nowStamp(state.currentDate)
      setState((s) => ({
        ...s,
        employees: [...s.employees, employee],
        joinApplications: s.joinApplications.map((j) =>
          j.id === id
            ? {
                ...j,
                status: 'approved' as const,
                reviewedAt: stamp,
                issuedPin: generated ? pin : undefined,
                employeeId,
              }
            : j,
        ),
        reports: [
          ...s.reports,
          {
            id: uid('r'),
            employeeId,
            date: s.currentDate,
            status: 'draft',
            memo: '',
            plan: [],
            execution: [],
            carryover: [],
            instructions: [],
          },
        ],
      }))
      setLastIssuedPin({ name: app.name, pin })
      showToast(
        generated
          ? `${app.name} 승인 · 발급 PIN ${pin} (이 화면에서만 확인)`
          : `${app.name} 승인 · 희망 PIN으로 등록됨`,
      )
      return { ok: true, pin, name: app.name }
    },
    [state.joinApplications, state.currentDate, showToast],
  )

  const rejectJoinApplication = useCallback(
    (id: string, reason?: string) => {
      const stamp = nowStamp(state.currentDate)
      setState((s) => ({
        ...s,
        joinApplications: s.joinApplications.map((j) =>
          j.id === id && j.status === 'pending'
            ? {
                ...j,
                status: 'rejected' as const,
                reviewedAt: stamp,
                rejectReason: reason?.trim() || undefined,
              }
            : j,
        ),
      }))
      showToast('가입 신청을 거절했습니다.')
    },
    [state.currentDate, showToast],
  )

  const cancelJoinApplication = useCallback(
    (id: string) => {
      const stamp = nowStamp(state.currentDate)
      setState((s) => ({
        ...s,
        joinApplications: s.joinApplications.map((j) =>
          j.id === id && j.status === 'pending'
            ? { ...j, status: 'cancelled' as const, reviewedAt: stamp }
            : j,
        ),
      }))
      showToast('대기 신청을 취소했습니다.')
    },
    [state.currentDate, showToast],
  )

  const registerEmployeeDirect = useCallback(
    (input: {
      name: string
      dept: string
      pin?: string
      role?: string
    }): { ok: boolean; pin?: string; employeeId?: string } => {
      const name = input.name.trim()
      const dept = input.dept.trim()
      if (!name || !dept) {
        showToast('이름과 부서를 입력해 주세요.')
        return { ok: false }
      }
      if (state.employees.some((e) => e.name === name)) {
        showToast('이미 등록된 이름입니다.')
        return { ok: false }
      }
      let pin = input.pin?.trim()
      let generated = false
      if (!pin) {
        pin = randomPin()
        generated = true
      } else if (!/^\d{4}$/.test(pin)) {
        showToast('PIN은 숫자 4자리여야 합니다.')
        return { ok: false }
      }
      const employeeId = uid('e')
      const employee: Employee = {
        id: employeeId,
        name,
        dept,
        role: input.role?.trim() || '팀원',
        initials: initialsOf(name),
        pin,
        ooo: null,
      }
      setState((s) => ({
        ...s,
        employees: [...s.employees, employee],
        reports: [
          ...s.reports,
          {
            id: uid('r'),
            employeeId,
            date: s.currentDate,
            status: 'draft',
            memo: '',
            plan: [],
            execution: [],
            carryover: [],
            instructions: [],
          },
        ],
      }))
      setLastIssuedPin({ name, pin })
      showToast(
        generated
          ? `${name} 등록 · 발급 PIN ${pin}`
          : `${name}을(를) 등록했습니다.`,
      )
      return { ok: true, pin, employeeId }
    },
    [state.employees, showToast],
  )

  const value = useMemo<StoreValue>(
    () => ({
      state,
      session,
      view,
      setView,
      actingAsEmployeeId,
      setActingAsEmployeeId,
      toast,
      showToast,
      resetSeed,
      loginEmployee,
      loginManager,
      logout,
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
      lastIssuedPin,
      clearLastIssuedPin,
    }),
    [
      state,
      session,
      view,
      actingAsEmployeeId,
      toast,
      showToast,
      resetSeed,
      loginEmployee,
      loginManager,
      logout,
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
      lastIssuedPin,
      clearLastIssuedPin,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
