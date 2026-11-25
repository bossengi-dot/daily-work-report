import type {
  AppSettings,
  DailyReport,
  Employee,
  ManagerAck,
  OooPeriod,
  ReflectStatus,
  ReportStatus,
  WorkItem,
} from './types'

export type ClientAction =
  | { type: 'resetSeed' }
  | { type: 'submitJoin'; name: string; dept: string; memo: string }
  | { type: 'approveJoin'; id: string }
  | { type: 'rejectJoin'; id: string; reason?: string }
  | { type: 'cancelJoin'; id: string }
  | {
      type: 'registerEmployee'
      name: string
      dept: string
      role?: string
      /** Local AUTH_MODE only — creates login + employee role immediately */
      email?: string
      password?: string
    }
  | { type: 'deleteMember'; employeeId: string }
  | { type: 'updateReport'; reportId: string; patch: Partial<DailyReport> }
  | { type: 'saveDraft'; reportId: string }
  | { type: 'submitPlan'; reportId: string }
  | { type: 'submitExecution'; reportId: string }
  | { type: 'checkPlanItem'; reportId: string; planItemId: string }
  | { type: 'addPlanItem'; reportId: string; text: string }
  | { type: 'addAdHocExecution'; reportId: string; text: string }
  | {
      type: 'moveWorkItem'
      reportId: string
      itemId: string
      to: 'plan' | 'progress' | 'execution' | 'carryover'
    }
  | {
      type: 'updateWorkItem'
      reportId: string
      section: 'plan' | 'progress' | 'execution' | 'carryover'
      itemId: string
      patch: Partial<WorkItem>
    }
  | {
      type: 'addAttachmentUrl'
      reportId: string
      section: 'plan' | 'progress' | 'execution' | 'carryover'
      itemId: string
      url: string
    }
  | {
      type: 'setInstructionReflect'
      reportId: string
      instructionId: string
      reflect: ReflectStatus
    }
  | { type: 'remind'; employeeId: string }
  | { type: 'leaveInstruction'; reportId: string; text: string }
  | { type: 'confirmReport'; reportId: string }
  | { type: 'requestRevision'; reportId: string; note: string }
  | { type: 'setReportStatus'; reportId: string; status: ReportStatus }
  | { type: 'setManagerAck'; reportId: string; ack: ManagerAck }
  | { type: 'updateSettings'; patch: Partial<AppSettings> }
  | { type: 'setEmployeeOoo'; employeeId: string; ooo: OooPeriod | null }
  | {
      type: 'updateEmployee'
      employeeId: string
      /** Profile fields to update (name/dept/role). Omitted keys keep current values. */
      patch: Partial<Pick<Employee, 'name' | 'dept' | 'role'>>
      /** Local AUTH_MODE: change or attach login email */
      email?: string
      /** Local AUTH_MODE: optional password reset / set (8+ chars). Empty = no change. */
      password?: string
    }
