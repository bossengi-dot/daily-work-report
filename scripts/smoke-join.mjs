/**
 * Smoke: join application apply → admin approve → employee on login list
 * Usage: node scripts/smoke-join.mjs [baseUrl]
 */
import { chromium } from 'playwright'

const BASE = process.argv[2] || 'http://127.0.0.1:5173'
const UNIQUE = `스모크${Date.now().toString().slice(-5)}`

const result = {
  ok: true,
  steps: [],
  fail(step, err) {
    this.ok = false
    this.steps.push({ step, ok: false, err: String(err) })
  },
  pass(step, detail) {
    this.steps.push({ step, ok: true, detail })
  },
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()

  try {
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.evaluate(() => {
      localStorage.clear()
      location.reload()
    })
    await page.waitForSelector('.login-page', { timeout: 10000 })
    result.pass('load-login')

    // Apply
    await page.getByRole('button', { name: '가입 신청' }).click()
    await page.getByPlaceholder('이름').fill(UNIQUE)
    await page.getByPlaceholder('부서').fill('스모크부')
    await page.getByPlaceholder(/숫자 4자리/).fill('7777')
    await page.getByPlaceholder(/입사일/).fill('스모크 테스트 신청')
    await page.getByRole('button', { name: '가입 신청하기' }).click()
    await page.waitForSelector('text=신청이 접수되었습니다', { timeout: 5000 })
    result.pass('public-apply', UNIQUE)

    await page.getByRole('button', { name: '로그인으로 돌아가기' }).click()

    // Manager login
    await page.getByRole('button', { name: '관리자', exact: true }).click()
    await page.getByPlaceholder('관리자 PIN').fill('0000')
    await page.getByRole('button', { name: '관리자 로그인' }).click()
    await page.waitForSelector('.sidenav', { timeout: 5000 })
    result.pass('manager-login')

    await page.getByRole('button', { name: /가입신청/ }).click()
    await page.waitForSelector('text=가입신청', { timeout: 5000 })
    // Seed pending + our apply
    const hasNew = await page.locator('.join-app-row', { hasText: UNIQUE }).count()
    if (hasNew < 1) throw new Error('pending apply not listed')
    result.pass('pending-listed')

    const row = page.locator('.join-app-row', { hasText: UNIQUE })
    await row.getByRole('button', { name: '승인' }).click()
    await page.waitForTimeout(400)
    const pinBanner = page.locator('.pin-once-banner')
    const bannerVisible = await pinBanner.isVisible().catch(() => false)
    // desired PIN was set so banner still shows issued pin
    if (!bannerVisible) {
      // toast may mention approve — still ok if employee created
      result.pass('approve', 'banner optional (desired PIN set)')
    } else {
      result.pass('approve', 'pin banner shown')
      await pinBanner.getByRole('button', { name: /확인/ }).click()
    }

    // Direct register
    await page.getByPlaceholder('이름').first().fill(`${UNIQUE}직`)
    await page.getByPlaceholder('부서').first().fill('직접부')
    await page.getByPlaceholder(/비우면 자동/).fill('8888')
    await page.getByRole('button', { name: '등록' }).click()
    await page.waitForTimeout(400)
    result.pass('direct-register')

    // Logout → employee list
    await page.getByRole('button', { name: '로그아웃' }).click()
    await page.waitForSelector('.login-page', { timeout: 5000 })
    await page.getByRole('button', { name: '직원', exact: true }).click()
    await page.getByPlaceholder('이름·부서 검색').fill(UNIQUE)
    await page.waitForTimeout(200)
    const picks = await page.locator('.pick-card', { hasText: UNIQUE }).count()
    if (picks < 1) throw new Error('approved employee missing from login list')
    result.pass('login-list-has-approved', `picks=${picks}`)

    // Login as approved
    await page.locator('.pick-card', { hasText: UNIQUE }).first().click()
    await page.getByPlaceholder('4자리 PIN').fill('7777')
    await page.getByRole('button', { name: '직원 로그인' }).click()
    await page.waitForSelector('text=작성', { timeout: 5000 })
    result.pass('employee-login-after-approve')
  } catch (e) {
    result.fail('exception', e?.message || e)
    try {
      await page.screenshot({ path: '/tmp/smoke-join-fail.png', fullPage: true })
    } catch {
      /* ignore */
    }
  } finally {
    await browser.close()
  }

  console.log(JSON.stringify(result, null, 2))
  process.exit(result.ok ? 0 : 1)
}

main()
