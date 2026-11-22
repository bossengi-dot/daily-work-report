/**
 * API-level smoke: admin register → delete → same-email re-register → submit report.
 *
 * Uses in-memory PGlite (no DATABASE_URL) + AUTH_MODE=local.
 * Usage (from repo root):
 *   npx tsx scripts/smoke-member-reregister.ts
 */
process.env.AUTH_MODE = 'local'
process.env.SESSION_SECRET = 'smoke-member-reregister-secret'
process.env.BOOTSTRAP_MANAGER_EMAIL = 'admin@smoke.test'
process.env.BOOTSTRAP_MANAGER_PASSWORD = 'password12345'
process.env.BOOTSTRAP_MANAGER_NAME = '스모크관리자'
delete process.env.DATABASE_URL

import {
  createLocalAccount,
  ensureBootstrapManager,
  findAccountByEmail,
  localAccountReclaimability,
} from '../src/server/localAuth'
import { loadRole, upsertRole, type ViewerSession } from '../src/server/auth'
import { runAction } from '../src/server/actions'
import { loadAppState } from '../src/server/stateRepo'

const result = {
  ok: true as boolean,
  steps: [] as Array<{ step: string; ok: boolean; detail?: unknown; err?: string }>,
  fail(step: string, err: unknown) {
    this.ok = false
    this.steps.push({ step, ok: false, err: String(err) })
  },
  pass(step: string, detail?: unknown) {
    this.steps.push({ step, ok: true, detail })
  },
}

function managerSession(admin: {
  id: string
  email: string
  display_name: string
}): ViewerSession {
  return {
    role: 'manager',
    employeeId: null,
    displayName: admin.display_name,
    cursorSub: admin.id,
    email: admin.email,
    stage: 'production',
    simulated: false,
    needsJoin: false,
    kind: 'person',
    authMode: 'local',
  }
}

async function main() {
  const live = new Set(['e-live'])
  const cases: Array<[
    { role: 'manager' | 'employee'; employee_id: string | null } | null,
    boolean,
    string,
  ]> = [
    [null, true, 'no_role'],
    [{ role: 'manager', employee_id: null }, false, 'manager'],
    [{ role: 'employee', employee_id: 'e-live' }, false, 'active_employee'],
    [{ role: 'employee', employee_id: 'e-gone' }, true, 'orphan_employee'],
    [{ role: 'employee', employee_id: null }, true, 'orphan_employee'],
  ]
  for (const [role, expect, reason] of cases) {
    const r = localAccountReclaimability(role, live)
    if (r.reclaimable !== expect || r.reason !== reason) {
      result.fail('reclaimability', JSON.stringify({ role, r, expect, reason }))
      console.log(JSON.stringify(result, null, 2))
      process.exit(1)
    }
  }
  result.pass('reclaimability', 'matrix ok')

  await ensureBootstrapManager('production')
  const admin = await findAccountByEmail('admin@smoke.test')
  if (!admin) {
    result.fail('bootstrap', 'manager account missing')
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  }
  const manager = managerSession(admin)

  const email = 'worker@smoke.test'
  const password = 'workerpass99'
  const name = '스모크직원'

  const reg1 = await runAction('production', manager, {
    type: 'registerEmployee',
    name,
    dept: '기술부',
    email,
    password,
  })
  if (!reg1.ok || !reg1.employeeId) {
    result.fail('register-1', reg1.message ?? reg1.error)
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  }
  result.pass('register-1', reg1.employeeId)

  const del = await runAction('production', manager, {
    type: 'deleteMember',
    employeeId: reg1.employeeId,
  })
  if (!del.ok) {
    result.fail('delete', del.message ?? del.error)
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  }
  const leftover = await findAccountByEmail(email)
  if (leftover) {
    result.fail('delete-account-gone', leftover.id)
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  }
  result.pass('delete', 'account+member removed')

  // Orphan role (employee_id points at missing employee) must be reclaimable.
  const orphan = await createLocalAccount({
    email: 'orphan@smoke.test',
    password: 'orphanpass99',
    displayName: '고아',
  })
  await upsertRole({
    stage: 'production',
    cursorSub: orphan.id,
    role: 'employee',
    employeeId: 'e-does-not-exist',
    displayName: '고아',
  })
  const orphanReg = await runAction('production', manager, {
    type: 'registerEmployee',
    name: '고아재등록',
    dept: '기술부',
    email: 'orphan@smoke.test',
    password: 'orphanpass99',
  })
  if (!orphanReg.ok) {
    result.fail('orphan-reclaim', orphanReg.message ?? orphanReg.error)
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  }
  result.pass('orphan-reclaim', orphanReg.employeeId)

  // Unlinked seed demo name should be overwritten, not hard-fail.
  const seedOverwrite = await runAction('production', manager, {
    type: 'registerEmployee',
    name: '박도형',
    dept: '기술부',
    email: 'park@smoke.test',
    password: 'parkpass99',
  })
  if (!seedOverwrite.ok) {
    result.fail('seed-name-reclaim', seedOverwrite.message ?? seedOverwrite.error)
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  }
  result.pass('seed-name-reclaim', seedOverwrite.employeeId)

  const reg2 = await runAction('production', manager, {
    type: 'registerEmployee',
    name,
    dept: '기술부',
    email,
    password,
  })
  if (!reg2.ok || !reg2.employeeId) {
    result.fail('register-2-same-email', reg2.message ?? reg2.error)
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  }
  result.pass('register-2-same-email', reg2.employeeId)

  const state = await loadAppState('production')
  const report = state.reports.find(
    (r) => r.employeeId === reg2.employeeId && r.date === state.currentDate,
  )
  if (!report) {
    result.fail('today-report', 'missing draft report after re-register')
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  }

  const account = await findAccountByEmail(email)
  if (!account) {
    result.fail('recreated-account', 'missing')
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  }

  const employee: ViewerSession = {
    role: 'employee',
    employeeId: reg2.employeeId,
    displayName: name,
    cursorSub: account.id,
    email,
    stage: 'production',
    simulated: false,
    needsJoin: false,
    kind: 'person',
    authMode: 'local',
  }

  const plan = await runAction('production', employee, {
    type: 'addPlanItem',
    reportId: report.id,
    text: '재등록 후 계획 항목',
  })
  if (!plan.ok) {
    result.fail('add-plan', plan.message ?? plan.error)
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  }
  const submitPlan = await runAction('production', employee, {
    type: 'submitPlan',
    reportId: report.id,
  })
  if (!submitPlan.ok) {
    result.fail('submit-plan', submitPlan.message ?? submitPlan.error)
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  }

  const afterPlan = await loadAppState('production')
  const r2 = afterPlan.reports.find((r) => r.id === report.id)
  const planItem = r2?.plan[0]
  if (!planItem) {
    result.fail('plan-item', 'no plan item')
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  }
  await runAction('production', employee, {
    type: 'checkPlanItem',
    reportId: report.id,
    planItemId: planItem.id,
  })
  const submitExec = await runAction('production', employee, {
    type: 'submitExecution',
    reportId: report.id,
  })
  if (!submitExec.ok) {
    result.fail('submit-execution', submitExec.message ?? submitExec.error)
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  }
  result.pass('submit-report', 'plan+execution submitted after re-register')

  const clash = await runAction('production', manager, {
    type: 'registerEmployee',
    name: '다른이름',
    dept: '기술부',
    email,
    password,
  })
  if (clash.ok || clash.error !== 'email_taken') {
    result.fail('active-email-blocked', clash)
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  }
  result.pass('active-email-blocked', 'still refuses live duplicate')

  const role = await loadRole('production', employee.cursorSub)
  if (!role || role.employee_id !== reg2.employeeId) {
    result.fail('role-link', role)
    console.log(JSON.stringify(result, null, 2))
    process.exit(1)
  }
  result.pass('role-link', role.employee_id)

  console.log(JSON.stringify(result, null, 2))
  process.exit(result.ok ? 0 : 1)
}

main().catch((e: unknown) => {
  result.fail('uncaught', e instanceof Error ? e.stack : e)
  console.log(JSON.stringify(result, null, 2))
  process.exit(1)
})
