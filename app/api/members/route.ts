import {
  jsonNoStore,
  listRoles,
  requireManagerSession,
  type UserRoleRow,
} from '../../../src/server/auth'
import { authMode, findAccountById } from '../../../src/server/localAuth'
import { loadAppState } from '../../../src/server/stateRepo'

export const dynamic = 'force-dynamic'

export type MemberRow = {
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

/** Manager-only: employees with linked login/role metadata. */
export async function GET(request: Request) {
  const gated = await requireManagerSession(request)
  if (gated instanceof Response) return gated

  const { session } = gated
  const state = await loadAppState(session.stage)
  const roles = await listRoles(session.stage)
  const byEmployee = new Map<string, UserRoleRow>(
    roles
      .filter((r): r is UserRoleRow & { employee_id: string } => Boolean(r.employee_id))
      .map((r) => [r.employee_id, r]),
  )

  const members: MemberRow[] = []
  for (const emp of state.employees) {
    const role = byEmployee.get(emp.id) ?? null
    let email: string | null = null
    if (role && authMode() === 'local' && role.cursor_sub.startsWith('local:')) {
      const account = await findAccountById(role.cursor_sub)
      email = account?.email ?? null
    }
    members.push({
      employeeId: emp.id,
      name: emp.name,
      dept: emp.dept,
      role: emp.role,
      ooo: Boolean(emp.ooo),
      linked: Boolean(role),
      cursorSub: role?.cursor_sub ?? null,
      email,
      accountRole: role?.role ?? null,
    })
  }

  return jsonNoStore({
    ok: true,
    authMode: authMode(),
    members,
  })
}
