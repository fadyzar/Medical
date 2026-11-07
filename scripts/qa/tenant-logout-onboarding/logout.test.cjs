// LOCAL_QA logout tests. Usage: node logout.test.cjs <baseUrl> [scenario...]
const { chromium } = require('playwright')
const BASE = process.argv[2] || 'http://localhost:3105'
const ONLY = process.argv.slice(3)
const PW = 'CannaQA-Local-2026!'
const LOCK = 'lock:sb-127-auth-token'
const results = []
const log = (name, ok, info = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} [${BASE}] ${name} ${info}`) }

async function login(page, email) {
  await page.goto(`${BASE}/auth/login`)
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', PW)
  await page.click('button[type=submit]')
  await page.waitForURL(/\/dashboard\//, { timeout: 20000 })
}
const sbCookies = async (ctx) => (await ctx.cookies()).filter(c => c.name.startsWith('sb-')).length
async function clickLogout(page) {
  await page.locator('header button[aria-expanded]').first().click()
  await page.getByRole('menuitem', { name: 'התנתקות' }).click()
}
async function protectedRedirects(page) {
  await page.goto(`${BASE}/dashboard/admin/dashboard`)
  await page.waitForLoadState('networkidle').catch(() => {})
  return page.url().includes('/auth/login')
}

const scenarios = {
  async basic(browser) {
    const ctx = await browser.newContext(); const page = await ctx.newPage()
    await login(page, 'admin.a@canna.test')
    const before = await sbCookies(ctx)
    await clickLogout(page)
    await page.waitForURL(/\/auth\/login/, { timeout: 15000 }).catch(() => {})
    log('basic: lands on login', page.url().includes('/auth/login'), page.url())
    log('basic: session cookies cleared', before > 0 && (await sbCookies(ctx)) === 0, `before=${before}`)
    log('basic: protected page redirects', await protectedRedirects(page))
    await page.reload(); await page.waitForLoadState('networkidle').catch(() => {})
    log('basic: refresh does not restore session', page.url().includes('/auth/login'), page.url())
    await login(page, 'doctor.a1@canna.test')
    log('basic: other account can log in', page.url().includes('/dashboard/doctor/'), page.url())
    await ctx.close()
  },
  async lockHeld(browser) {
    // Another tab holds the Supabase auth lock (the suspected production cause).
    const ctx = await browser.newContext(); const page = await ctx.newPage()
    await login(page, 'admin.a@canna.test')
    const other = await ctx.newPage(); await other.goto(`${BASE}/dashboard/admin/dashboard`)
    await other.evaluate((name) => { navigator.locks.request(name, () => new Promise(() => {})) }, LOCK)
    await page.bringToFront()
    await clickLogout(page)
    await page.waitForURL(/\/auth\/login/, { timeout: 25000 }).catch(() => {})
    log('lockHeld: lands on login', page.url().includes('/auth/login'), page.url())
    log('lockHeld: session cookies cleared', (await sbCookies(ctx)) === 0)
    await other.close()
    log('lockHeld: protected page redirects', await protectedRedirects(page))
    await ctx.close()
  },
  async multiTab(browser) {
    const ctx = await browser.newContext()
    const a = await ctx.newPage(); await login(a, 'admin.a@canna.test')
    const b = await ctx.newPage(); await b.goto(`${BASE}/dashboard/admin/users`); await b.waitForLoadState('networkidle').catch(() => {})
    log('multiTab: tab B signed in', b.url().includes('/dashboard/admin/'), b.url())
    await a.bringToFront(); await clickLogout(a)
    await a.waitForURL(/\/auth\/login/, { timeout: 15000 }).catch(() => {})
    await b.waitForURL(/\/auth\/login/, { timeout: 15000 }).catch(() => {})
    log('multiTab: tab A on login', a.url().includes('/auth/login'))
    log('multiTab: tab B left the protected page by itself', b.url().includes('/auth/login'), b.url())
    await b.reload(); await b.waitForLoadState('networkidle').catch(() => {})
    log('multiTab: tab B refresh stays logged out', b.url().includes('/auth/login'))
    await ctx.close()
  },
}

;(async () => {
  const browser = await chromium.launch()
  for (const [name, fn] of Object.entries(scenarios)) {
    if (ONLY.length && !ONLY.includes(name)) continue
    try { await fn(browser) } catch (e) { log(`${name}: threw`, false, String(e.message).split('\n')[0]) }
  }
  await browser.close()
  const failed = results.filter(r => !r.ok).length
  console.log(`== ${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
})()
