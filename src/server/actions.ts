import type { ClientAction } from '../actionTypes'
import { sanitizeAttachmentUrl } from '../lib/safeUrl'
import type {
  AppSettings,
  AppState,
  Attachment,
  CeoInstruction,
  DailyReport,
  Employee,
  JoinApplication,
  WorkItem,
} from '../types'
import { DEFAULT_SETTINGS } from '../types'
import { createSeed } from '../seed'
import type { ViewerSession } from './auth'
import {
  deleteRole,
  listRolesByEmployeeId,
  loadRole,
  upsertRole,
  type AppStage,
} from './auth'
import {
  authMode,
  createLocalAccount,
  deleteLocalAccount,
  findAccountByEmail,
  findAccountById,
  updateLocalAccount,
} from './localAuth'
import { loadAppState, saveAppState } from './stateRepo'

export type { ClientAction }

function nowStamp(date: string) {
  const now = new Date()
  return `${date} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function initialsOf(name: string): string {
  return name.trim().slice(0, 1) || '?'
}

export type ActionResult = {
  ok: boolean
  state?: AppState
  message?: string
  error?: string
  blockerItemId?: string
  employeeId?: string
  name?: string
}

function isManager(session: ViewerSession) {
  return session.role === 'manager'
}

function canEditReport(
  session: ViewerSession,
  state: AppState,
  reportId: string,
): boolean {
  if (isManager(session)) return true
  if (session.role !== 'employee' || !session.employeeId) return false
  const report = state.reports.find((r) => r.id === reportId)
  return report?.employeeId === session.employeeId
}

function canEditEmployee(session: ViewerSession, employeeId: string): boolean {
  if (isManager(session)) return true
  return session.role === 'employee' && session.employeeId === employeeId
}

function mapReport(
  state: AppState,
  reportId: string,
  fn: (r: DailyReport) => DailyReport,
): AppState {
  return {
    ...state,
    reports: state.reports.map((r) => (r.id === reportId ? fn(r) : r)),
  }
}

export async function runAction(
  stage: AppStage,
  session: ViewerSession,
  action: ClientAction,
): Promise<ActionResult> {
  let state = await loadAppState(stage)
  let message: string | undefined
  let blockerItemId: string | undefined
  let employeeId: string | undefined
  let name: string | undefined

  const fail = (error: string, statusMessage?: string): ActionResult => ({
    ok: false,
    error,
    message: statusMessage,
  })

  switch (action.type) {
    case 'resetSeed': {
      if (!isManager(session)) return fail('forbidden')
      state = { ...createSeed(), settings: { ...DEFAULT_SETTINGS } }
      message = '시드 데이터로 초기화했습니다.'
      break
    }
    case 'submitJoin': {
      if (session.role) {
        return fail('already_registered', '이미 역할이 배정되어 있습니다.')
      }
      const joinName = action.name.trim()
      const dept = action.dept.trim()
      if (!joinName || !dept) return fail('invalid', '이름과 부서를 입력해 주세요.')
      if (state.employees.some((e) => e.name === joinName)) {
        return fail('duplicate', '이미 등록된 이름입니다. 관리자에게 문의하세요.')
      }
      if (
        state.joinApplications.some(
          (j) =>
            j.status === 'pending' &&
            (j.applicantSub === session.cursorSub || j.name === joinName),
        )
      ) {
        return fail('pending', '이미 대기 중인 가입 신청이 있습니다.')
      }
      const app: JoinApplication = {
        id: uid('ja'),
        name: joinName,
        dept,
        memo: action.memo.trim(),
        status: 'pending',
        createdAt: nowStamp(state.currentDate),
        applicantSub: session.cursorSub,
      }
      state = { ...state, joinApplications: [app, ...state.joinApplications] }
      message = '가입 신청이 접수되었습니다. 관리자 승인 후 이용할 수 있습니다.'
      break
    }
    case 'approveJoin': {
      if (!isManager(session)) return fail('forbidden')
      const app = state.joinApplications.find((j) => j.id === action.id)
      if (!app || app.status !== 'pending') {
        return fail('invalid', '대기 중인 신청이 아닙니다.')
      }
      if (!app.applicantSub) {
        return fail('invalid', '신청자 계정 정보가 없습니다.')
      }
      const newEmployeeId = uid('e')
      const employee: Employee = {
        id: newEmployeeId,
        name: app.name,
        dept: app.dept,
        role: '팀원',
        initials: initialsOf(app.name),
        ooo: null,
      }
      const stamp = nowStamp(state.currentDate)
      state = {
        ...state,
        employees: [...state.employees, employee],
        joinApplications: state.joinApplications.map((j) =>
          j.id === action.id
            ? {
                ...j,
                status: 'approved' as const,
                reviewedAt: stamp,
                employeeId: newEmployeeId,
              }
            : j,
        ),
        reports: [
          ...state.reports,
          {
            id: uid('r'),
            employeeId: newEmployeeId,
            date: state.currentDate,
            status: 'draft',
            memo: '',
            plan: [],
            execution: [],
            carryover: [],
            instructions: [],
          },
        ],
      }
      await upsertRole({
        stage,
        cursorSub: app.applicantSub,
        role: 'employee',
        employeeId: newEmployeeId,
        displayName: app.name,
      })
      message = `${app.name} 가입을 승인했습니다.`
      employeeId = newEmployeeId
      name = app.name
      break
    }
    case 'rejectJoin': {
      if (!isManager(session)) return fail('forbidden')
      const stamp = nowStamp(state.currentDate)
      state = {
        ...state,
        joinApplications: state.joinApplications.map((j) =>
          j.id === action.id && j.status === 'pending'
            ? {
                ...j,
                status: 'rejected' as const,
                reviewedAt: stamp,
                rejectReason: action.reason?.trim() || undefined,
              }
            : j,
        ),
      }
      message = '가입 신청을 거절했습니다.'
      break
    }
    case 'cancelJoin': {
      if (!isManager(session)) return fail('forbidden')
      const stamp = nowStamp(state.currentDate)
      state = {
        ...state,
        joinApplications: state.joinApplications.map((j) =>
          j.id === action.id && j.status === 'pending'
            ? { ...j, status: 'cancelled' as const, reviewedAt: stamp }
            : j,
        ),
      }
      message = '대기 신청을 취소했습니다.'
      break
    }
    case 'registerEmployee': {
      if (!isManager(session)) return fail('forbidden')
      const empName = action.name.trim()
      const dept = action.dept.trim()
      if (!empName || !dept) return fail('invalid', '이름과 부서를 입력해 주세요.')
      if (state.employees.some((e) => e.name === empName)) {
        return fail('duplicate', '이미 등록된 이름입니다.')
      }

      const email = action.email?.trim().toLowerCase() ?? ''
      const password = action.password ?? ''
      const wantsLocalLogin = Boolean(email || password)

      if (wantsLocalLogin) {
        if (authMode() !== 'local') {
          return fail(
            'cursor_mode',
            '이메일·비밀번호 등록은 로컬(AUTH_MODE=local)에서만 가능합니다. Cursor 사용자는 가입 신청 후 승인하세요.',
          )
        }
        if (!email || !password || password.length < 8) {
          return fail(
            'invalid',
            '이메일과 8자 이상 비밀번호가 필요합니다.',
          )
        }
        const existingAccount = await findAccountByEmail(email)
        if (existingAccount) {
          const existingRole = await loadRole(stage, existingAccount.id)
          if (existingRole) {
            return fail(
              'email_taken',
              '이미 등록된 이메일입니다. 구성원 목록에서 삭제한 뒤 다시 등록하세요.',
            )
          }
          // Invite-created account that never got a role — reclaim email.
          await deleteLocalAccount(existingAccount.id)
          state = {
            ...state,
            joinApplications: state.joinApplications.filter(
              (j) => j.applicantSub !== existingAccount.id,
            ),
          }
        }
      }

      const newEmployeeId = uid('e')
      const employee: Employee = {
        id: newEmployeeId,
        name: empName,
        dept,
        role: action.role?.trim() || '팀원',
        initials: initialsOf(empName),
        ooo: null,
      }
      state = {
        ...state,
        employees: [...state.employees, employee],
        reports: [
          ...state.reports,
          {
            id: uid('r'),
            employeeId: newEmployeeId,
            date: state.currentDate,
            status: 'draft',
            memo: '',
            plan: [],
            execution: [],
            carryover: [],
            instructions: [],
          },
        ],
      }

      if (wantsLocalLogin) {
        const account = await createLocalAccount({
          email,
          password,
          displayName: empName,
        })
        await upsertRole({
          stage,
          cursorSub: account.id,
          role: 'employee',
          employeeId: newEmployeeId,
          displayName: empName,
        })
        message = `${empName} 계정을 등록했습니다. 바로 로그인·일일보고 작성이 가능합니다.`
      } else {
        message =
          authMode() === 'local'
            ? `${empName} 프로필만 등록했습니다. 로그인하려면 이메일·비밀번호를 함께 입력하세요.`
            : `${empName}을(를) 등록했습니다. Cursor 가입 승인 후 본인 계정으로 로그인합니다.`
      }
      employeeId = newEmployeeId
      name = empName
      break
    }
    case 'deleteMember': {
      if (!isManager(session)) return fail('forbidden')
      const targetId = action.employeeId
      const emp = state.employees.find((e) => e.id === targetId)
      if (!emp) return fail('not_found', '구성원을 찾을 수 없습니다.')

      const linkedRoles = await listRolesByEmployeeId(stage, targetId)
      if (linkedRoles.some((r) => r.role === 'manager')) {
        return fail('forbidden', '관리자 계정은 이 화면에서 삭제할 수 없습니다.')
      }
      if (linkedRoles.some((r) => r.cursor_sub === session.cursorSub)) {
        return fail('forbidden', '본인 계정은 삭제할 수 없습니다.')
      }

      for (const role of linkedRoles) {
        await deleteRole(stage, role.cursor_sub)
        if (authMode() === 'local' && role.cursor_sub.startsWith('local:')) {
          await deleteLocalAccount(role.cursor_sub)
        }
      }

      // Orphan local accounts that only had a pending join (no employee_id yet)
      // are not tied here; join cleanup below clears applicant references.

      const removedSubs = new Set(linkedRoles.map((r) => r.cursor_sub))
      state = {
        ...state,
        employees: state.employees.filter((e) => e.id !== targetId),
        reports: state.reports.filter((r) => r.employeeId !== targetId),
        weeklyTodos: state.weeklyTodos.filter((t) => t.assigneeId !== targetId),
        joinApplications: state.joinApplications.filter((j) => {
          if (j.employeeId === targetId) return false
          if (j.applicantSub && removedSubs.has(j.applicantSub)) return false
          return true
        }),
      }
      message = `${emp.name} 구성원과 연결된 계정·보고 데이터를 삭제했습니다.`
      name = emp.name
      employeeId = targetId
      break
    }
    case 'updateReport': {
      if (!canEditReport(session, state, action.reportId)) return fail('forbidden')
      state = mapReport(state, action.reportId, (r) => ({ ...r, ...action.patch }))
      break
    }
    case 'saveDraft': {
      if (!canEditReport(session, state, action.reportId)) return fail('forbidden')
      const stamp = nowStamp(state.currentDate)
      const report = state.reports.find((r) => r.id === action.reportId)
      const patch: Partial<DailyReport> = { draftSavedAt: stamp }
      if (!report || report.status === 'draft' || report.status === 'revision') {
        patch.status = 'draft'
      }
      state = mapReport(state, action.reportId, (r) => ({ ...r, ...patch }))
      message = '임시저장되었습니다.'
      break
    }
    case 'submitPlan': {
      if (!canEditReport(session, state, action.reportId)) return fail('forbidden')
      const report = state.reports.find((r) => r.id === action.reportId)
      if (!report) return fail('not_found')
      const emp = state.employees.find((e) => e.id === report.employeeId)
      if (emp?.ooo && state.currentDate >= emp.ooo.start && state.currentDate <= emp.ooo.end) {
        return fail('ooo', '부재 기간에는 제출이 면제됩니다.')
      }
      if (report.plan.length === 0 && report.execution.length === 0) {
        return fail('invalid', '계획 항목을 하나 이상 추가해 주세요.')
      }
      const stamp = nowStamp(state.currentDate)
      state = mapReport(state, action.reportId, (r) => ({
        ...r,
        planSubmittedAt: stamp,
        status: r.execSubmittedAt ? r.status : 'draft',
      }))
      message = '오전 계획을 제출했습니다.'
      break
    }
    case 'submitExecution': {
      if (!canEditReport(session, state, action.reportId)) return fail('forbidden')
      const report = state.reports.find((r) => r.id === action.reportId)
      if (!report) return fail('not_found')
      const emp = state.employees.find((e) => e.id === report.employeeId)
      if (emp?.ooo && state.currentDate >= emp.ooo.start && state.currentDate <= emp.ooo.end) {
        return fail('ooo', '부재 기간에는 제출이 면제됩니다.')
      }
      if (!report.planSubmittedAt && !report.submittedAt) {
        return fail('invalid', '먼저 오전 계획을 제출해 주세요.')
      }
      const blockers = [...report.execution, ...report.carryover].filter(
        (i) => i.status === 'blocker',
      )
      for (const b of blockers) {
        if (!b.blockerReason?.trim()) {
          return {
            ok: false,
            error: 'blocker_reason',
            message: '블로커 항목에 사유를 입력해 주세요.',
            blockerItemId: b.id,
          }
        }
      }
      const stamp = nowStamp(state.currentDate)
      state = mapReport(state, action.reportId, (r) => ({
        ...r,
        execSubmittedAt: stamp,
        submittedAt: stamp,
        status: 'submitted',
        managerAck: null,
      }))
      message = '실행·이월을 마감 제출했습니다.'
      break
    }
    case 'checkPlanItem': {
      if (!canEditReport(session, state, action.reportId)) return fail('forbidden')
      state = mapReport(state, action.reportId, (r) => {
        const item = r.plan.find((p) => p.id === action.planItemId)
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
          plan: r.plan.filter((p) => p.id !== action.planItemId),
          execution: [...r.execution, moved],
        }
      })
      break
    }
    case 'addPlanItem': {
      if (!canEditReport(session, state, action.reportId)) return fail('forbidden')
      if (!action.text.trim()) return fail('invalid')
      state = mapReport(state, action.reportId, (r) => ({
        ...r,
        plan: [
          ...r.plan,
          {
            id: uid('p'),
            text: action.text.trim(),
            hours: 1,
            attachments: [],
            checked: false,
          },
        ],
      }))
      break
    }
    case 'addAdHocExecution': {
      if (!canEditReport(session, state, action.reportId)) return fail('forbidden')
      if (!action.text.trim()) return fail('invalid')
      state = mapReport(state, action.reportId, (r) => ({
        ...r,
        execution: [
          ...r.execution,
          {
            id: uid('x'),
            text: action.text.trim(),
            status: 'in_progress',
            hours: 1,
            isAdHoc: true,
            attachments: [],
          },
        ],
      }))
      break
    }
    case 'updateWorkItem': {
      if (!canEditReport(session, state, action.reportId)) return fail('forbidden')
      state = mapReport(state, action.reportId, (r) => ({
        ...r,
        [action.section]: r[action.section].map((item) =>
          item.id === action.itemId ? { ...item, ...action.patch } : item,
        ),
      }))
      break
    }
    case 'addAttachmentUrl': {
      if (!canEditReport(session, state, action.reportId)) return fail('forbidden')
      const safe = sanitizeAttachmentUrl(action.url)
      if (!safe) return fail('invalid_url', 'http(s) 링크만 첨부할 수 있습니다.')
      const att: Attachment = {
        id: uid('att'),
        kind: 'url',
        label: safe.slice(0, 40),
        url: safe,
      }
      state = mapReport(state, action.reportId, (r) => ({
        ...r,
        [action.section]: r[action.section].map((item) => {
          if (item.id !== action.itemId) return item
          if (item.attachments.length >= 3) return item
          return { ...item, attachments: [...item.attachments, att] }
        }),
      }))
      break
    }
    case 'setInstructionReflect': {
      if (!canEditReport(session, state, action.reportId)) return fail('forbidden')
      state = mapReport(state, action.reportId, (r) => ({
        ...r,
        instructions: r.instructions.map((i) =>
          i.id === action.instructionId ? { ...i, reflect: action.reflect } : i,
        ),
      }))
      break
    }
    case 'remind': {
      if (!isManager(session)) return fail('forbidden')
      const emp = state.employees.find((e) => e.id === action.employeeId)
      if (
        emp?.ooo &&
        state.currentDate >= emp.ooo.start &&
        state.currentDate <= emp.ooo.end
      ) {
        message = `${emp.name}은(는) 부재 중이라 리마인드를 보내지 않습니다.`
        break
      }
      const report = state.reports.find(
        (r) => r.employeeId === action.employeeId && r.date === state.currentDate,
      )
      const morningOnly =
        report &&
        (report.planSubmittedAt || report.submittedAt) &&
        !report.execSubmittedAt &&
        report.status !== 'submitted' &&
        report.status !== 'reviewing' &&
        report.status !== 'done'
      message = morningOnly
        ? `${emp?.name ?? '직원'}에게 저녁 마감 독촉을 보냈습니다.`
        : `${emp?.name ?? '직원'}에게 오늘 보고 독촉을 보냈습니다.`
      break
    }
    case 'leaveInstruction': {
      if (!isManager(session)) return fail('forbidden')
      if (!action.text.trim()) return fail('invalid', '지시 내용을 입력해 주세요.')
      const instruction: CeoInstruction = {
        id: uid('i'),
        date: state.currentDate,
        text: action.text.trim(),
        reflect: 'unreflected',
      }
      state = mapReport(state, action.reportId, (r) => ({
        ...r,
        instructions: [instruction, ...r.instructions],
      }))
      message = '지시를 남겼습니다.'
      break
    }
    case 'confirmReport': {
      if (!isManager(session)) return fail('forbidden')
      state = mapReport(state, action.reportId, (r) => ({
        ...r,
        status: 'done',
        managerAck: 'confirmed',
      }))
      message = '확인 완료로 표시했습니다.'
      break
    }
    case 'requestRevision': {
      if (!isManager(session)) return fail('forbidden')
      if (!action.note.trim()) return fail('invalid', '보완요청 사유를 입력해 주세요.')
      state = mapReport(state, action.reportId, (r) => ({
        ...r,
        status: 'revision',
        revisionNote: action.note.trim(),
        managerAck: null,
      }))
      message = '보완요청을 보냈습니다.'
      break
    }
    case 'setReportStatus': {
      if (!isManager(session)) return fail('forbidden')
      state = mapReport(state, action.reportId, (r) => ({
        ...r,
        status: action.status,
      }))
      break
    }
    case 'setManagerAck': {
      if (!isManager(session)) return fail('forbidden')
      state = mapReport(state, action.reportId, (r) => ({
        ...r,
        managerAck: action.ack,
        ...(action.ack ? { status: 'done' as const } : {}),
      }))
      if (action.ack === 'thumbsup') message = '👍 반응으로 검토 완료했습니다.'
      else if (action.ack === 'confirmed') message = '확인으로 검토 완료했습니다.'
      break
    }
    case 'updateSettings': {
      if (!isManager(session)) return fail('forbidden')
      // Client may not set secrets; ignore unknown secret-like keys.
      const allowed: AppSettings = {
        ...state.settings,
        ...DEFAULT_SETTINGS,
      }
      state = { ...state, settings: allowed }
      message = '설정은 서버에서 관리합니다. 비밀값은 클라이언트에 저장하지 않습니다.'
      break
    }
    case 'setEmployeeOoo': {
      if (!canEditEmployee(session, action.employeeId)) return fail('forbidden')
      // Employees may only edit their own OOO; managers any.
      state = {
        ...state,
        employees: state.employees.map((e) =>
          e.id === action.employeeId ? { ...e, ooo: action.ooo } : e,
        ),
      }
      break
    }
    case 'updateEmployee': {
      if (!isManager(session)) return fail('forbidden')
      const emp = state.employees.find((e) => e.id === action.employeeId)
      if (!emp) return fail('not_found', '구성원을 찾을 수 없습니다.')

      const nextName =
        action.patch.name !== undefined ? action.patch.name.trim() : emp.name
      const nextDept =
        action.patch.dept !== undefined ? action.patch.dept.trim() : emp.dept
      const nextRole =
        action.patch.role !== undefined
          ? action.patch.role.trim() || '팀원'
          : emp.role

      if (!nextName || !nextDept) {
        return fail('invalid', '이름과 부서를 입력해 주세요.')
      }
      if (
        state.employees.some(
          (e) => e.id !== action.employeeId && e.name === nextName,
        )
      ) {
        return fail('duplicate', '이미 등록된 이름입니다.')
      }

      const linkedRoles = await listRolesByEmployeeId(stage, action.employeeId)
      const isManagerMember = linkedRoles.some((r) => r.role === 'manager')
      const isSelf = linkedRoles.some((r) => r.cursor_sub === session.cursorSub)

      // Keep manager profiles editable for name/dept, but avoid accidental
      // self-lockout via blanking or reclaiming the only manager login.
      const emailRaw = action.email?.trim().toLowerCase() ?? ''
      const passwordRaw = action.password ?? ''
      const wantsEmailChange = Boolean(emailRaw)
      const wantsPasswordChange = Boolean(passwordRaw)

      if (wantsPasswordChange && passwordRaw.length < 8) {
        return fail('invalid', '비밀번호는 8자 이상이어야 합니다.')
      }

      if ((wantsEmailChange || wantsPasswordChange) && authMode() !== 'local') {
        return fail(
          'cursor_mode',
          '이메일·비밀번호 변경은 로컬(AUTH_MODE=local)에서만 가능합니다.',
        )
      }

      let localAccountId: string | null = null
      if (authMode() === 'local') {
        const localRole = linkedRoles.find((r) =>
          r.cursor_sub.startsWith('local:'),
        )
        localAccountId = localRole?.cursor_sub ?? null

        if (wantsEmailChange || wantsPasswordChange) {
          if (localAccountId) {
            const currentAccount = await findAccountById(localAccountId)
            if (!currentAccount) {
              return fail('not_found', '연결된 로그인 계정을 찾을 수 없습니다.')
            }

            if (wantsEmailChange && emailRaw !== currentAccount.email) {
              const existing = await findAccountByEmail(emailRaw)
              if (existing && existing.id !== localAccountId) {
                const existingRole = await loadRole(stage, existing.id)
                if (existingRole) {
                  return fail(
                    'email_taken',
                    '이미 등록된 이메일입니다. 구성원 목록에서 삭제한 뒤 다시 등록하세요.',
                  )
                }
                // Orphan invite account — reclaim email.
                await deleteLocalAccount(existing.id)
                state = {
                  ...state,
                  joinApplications: state.joinApplications.filter(
                    (j) => j.applicantSub !== existing.id,
                  ),
                }
              }
            }

            if (isSelf && isManagerMember && wantsEmailChange) {
              // Allow email change for self-manager, but require a real address.
              if (!emailRaw.includes('@')) {
                return fail('invalid', '올바른 이메일을 입력해 주세요.')
              }
            }

            await updateLocalAccount(localAccountId, {
              email: wantsEmailChange ? emailRaw : undefined,
              password: wantsPasswordChange ? passwordRaw : undefined,
              displayName: nextName,
            })
          } else {
            // No linked login yet — attach a new local account (like register).
            if (!emailRaw || !passwordRaw || passwordRaw.length < 8) {
              return fail(
                'invalid',
                '로그인 계정을 연결하려면 이메일과 8자 이상 비밀번호가 필요합니다.',
              )
            }
            const existingAccount = await findAccountByEmail(emailRaw)
            if (existingAccount) {
              const existingRole = await loadRole(stage, existingAccount.id)
              if (existingRole) {
                return fail(
                  'email_taken',
                  '이미 등록된 이메일입니다. 구성원 목록에서 삭제한 뒤 다시 등록하세요.',
                )
              }
              await deleteLocalAccount(existingAccount.id)
              state = {
                ...state,
                joinApplications: state.joinApplications.filter(
                  (j) => j.applicantSub !== existingAccount.id,
                ),
              }
            }
            if (isManagerMember) {
              return fail(
                'forbidden',
                '관리자 계정 로그인은 이 화면에서 새로 연결할 수 없습니다.',
              )
            }
            const account = await createLocalAccount({
              email: emailRaw,
              password: passwordRaw,
              displayName: nextName,
            })
            await upsertRole({
              stage,
              cursorSub: account.id,
              role: 'employee',
              employeeId: action.employeeId,
              displayName: nextName,
            })
            localAccountId = account.id
          }
        } else if (localAccountId && nextName !== emp.name) {
          await updateLocalAccount(localAccountId, { displayName: nextName })
        }
      }

      // Sync display_name on all linked roles.
      for (const role of linkedRoles) {
        if (role.display_name !== nextName) {
          await upsertRole({
            stage,
            cursorSub: role.cursor_sub,
            role: role.role,
            employeeId: role.employee_id,
            displayName: nextName,
          })
        }
      }
      // Newly created role already has nextName; also sync if we only had create path
      // and linkedRoles was empty before create — already handled in createLocalAccount path.

      state = {
        ...state,
        employees: state.employees.map((e) =>
          e.id === action.employeeId
            ? {
                ...e,
                name: nextName,
                dept: nextDept,
                role: nextRole,
                initials: initialsOf(nextName),
              }
            : e,
        ),
      }

      const parts: string[] = []
      if (nextName !== emp.name || nextDept !== emp.dept || nextRole !== emp.role) {
        parts.push('프로필')
      }
      if (wantsEmailChange) parts.push('이메일')
      if (wantsPasswordChange) parts.push('비밀번호')
      message =
        parts.length > 0
          ? `${nextName} 구성원 ${parts.join('·')}을(를) 수정했습니다.`
          : `${nextName} 구성원 정보를 저장했습니다.`
      employeeId = action.employeeId
      name = nextName
      break
    }
    default:
      return fail('unknown_action')
  }

  await saveAppState(stage, state)
  return {
    ok: true,
    state,
    message,
    blockerItemId,
    employeeId,
    name,
  }
}
