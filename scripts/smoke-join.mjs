/**
 * Smoke against Cursor-identity auth is environment-specific.
 * Locally the first simulated viewer bootstraps as manager.
 * Usage: node scripts/smoke-join.mjs [baseUrl]
 */
import { chromium } from 'playwright'

const BASE = process.argv[2] || 'http://127.0.0.1:5173'

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
    await page.waitForSelector('.app-shell, .login-page', { timeout: 15000 })
    const hasShell = (await page.locator('.app-shell').count()) > 0
    if (hasShell) {
      result.pass('manager-bootstrap', 'simulated viewer became manager')
      await page.getByRole('button', { name: /가입신청/ }).click()
      await page.waitForSelector('text=가입신청', { timeout: 5000 })
      result.pass('join-admin')
    } else {
      result.pass('awaiting-join', 'no role yet — join screen shown')
    }
  } catch (e) {
    result.fail('smoke', e)
  } finally {
    await browser.close()
  }

  console.log(JSON.stringify(result, null, 2))
  process.exit(result.ok ? 0 : 1)
}

main()
