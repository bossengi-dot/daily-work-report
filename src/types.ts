export type ItemStatus = 'done' | 'in_progress' | 'blocker'
export type ReportStatus = 'draft' | 'submitted' | 'reviewing' | 'done' | 'revision'
export type ReflectStatus = 'reflected' | 'unreflected'
export type AttachmentKind = 'url' | 'image' | 'file'
export type RoleView =
  | 'employee'
  | 'manager'
  | 'weekly'
  | 'monthly'
  | 'settings'
  | 'join-admin'
export type ManagerAck = 'thumbsup' | 'confirmed' | null
export type SessionRole = 'employee' | 'manager'

export interface OooPeriod {
  start: string
  end: string
  reason?: string
}

export interface Employee {
  id: string
  name: string
  role: string
  dept: string
  initials: string
  ooo?: OooPeriod | null
}

export interface AttachmentLocalMeta {
  name: string
  size: number
  mime: string
  /** object URL is session-only; not durable across reload */
  ephemeral: true
}

export interface Attachment {
  id: string
  kind: AttachmentKind
  label: string
  url: string
  localMeta?: AttachmentLocalMeta
}

export interface WorkItem {
  id: string
  text: string
  status?: ItemStatus
  hours?: number
  attachments: Attachment[]
  blockerReason?: string
  supportRequest?: string
  consecutiveDays?: number
  fromPlanId?: string
  isAdHoc?: boolean
  checked?: boolean
}

export interface CeoInstruction {
  id: string
  date: string
  text: string
  reflect: ReflectStatus
}

export interface DailyReport {
  id: string
  employeeId: string
  date: string
  status: ReportStatus
  plan: WorkItem[]
  /** 진행 — work started but not finished */
  progress: WorkItem[]
  execution: WorkItem[]
  carryover: WorkItem[]
  instructions: CeoInstruction[]
  memo: string
  draftSavedAt?: string
  submittedAt?: string
  planSubmittedAt?: string
  execSubmittedAt?: string
  revisionNote?: string
  managerAck?: ManagerAck
}

export interface TopicCard {
  id: string
  date: string
  weekday: string
  title: string
  status: 'in_progress' | 'done' | 'blocker'
  people: string[]
  extraCount?: number
  count?: number
}

export interface WeeklyTodo {
  id: string
  priority: '높음' | '중간' | '낮음'
  text: string
  assigneeId: string
  topic: string
  startDate: string
  dueDate: string
  consecutiveDays: number
  status: ItemStatus | 'delayed'
}

/** Non-secret client settings only. Webhook secrets live in server env. */
export interface AppSettings {
  /** reserved — secrets are not stored client-side */
  _placeholder?: never
}

export type JoinAppStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface JoinApplication {
  id: string
  name: string
  dept: string
  memo: string
  status: JoinAppStatus
  createdAt: string
  reviewedAt?: string
  rejectReason?: string
  /** Cursor identity sub of the applicant (server-set) */
  applicantSub?: string
  employeeId?: string
}

export interface Session {
  role: SessionRole | null
  employeeId: string | null
  displayName: string
  cursorSub: string
  email: string
  stage: 'production' | 'preview'
  simulated: boolean
  needsJoin: boolean
  kind: 'person' | 'key'
  /** cursor = Cursor SSO; local = NAS email/password */
  authMode?: 'cursor' | 'local'
}

export interface AppState {
  employees: Employee[]
  reports: DailyReport[]
  topics: TopicCard[]
  weeklyTodos: WeeklyTodo[]
  joinApplications: JoinApplication[]
  currentDate: string
  weekRange: { start: string; end: string }
  monthRange: { start: string; end: string }
  settings: AppSettings
}

export function isMorningDone(r: DailyReport): boolean {
  if (r.planSubmittedAt) return true
  if (r.execSubmittedAt) return true
  if (r.submittedAt && ['submitted', 'reviewing', 'done'].includes(r.status)) return true
  return false
}

export function isEveningDone(r: DailyReport): boolean {
  if (r.execSubmittedAt) return true
  if (r.submittedAt && ['submitted', 'reviewing', 'done'].includes(r.status)) return true
  return false
}

export function isOooOn(emp: Employee, date: string): boolean {
  if (!emp.ooo) return false
  return date >= emp.ooo.start && date <= emp.ooo.end
}

export const DEFAULT_SETTINGS: AppSettings = {}
