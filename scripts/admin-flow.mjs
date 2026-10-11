import { chromium } from 'playwright-core';

const base = 'http://localhost:3000';
const b = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await b.newPage({ viewport: { width: 1050, height: 900 } });

// 1. /admin bounces anonymous visitors to /login
await page.goto(`${base}/admin`, { waitUntil: 'networkidle' });
console.log('anon /admin →', page.url().includes('/login') ? 'PASS redirect' : `FAIL ${page.url()}`);

// 2. wrong password → error banner + audit of failure
await page.fill('input[name="email"]', 'owner@arogyabhog.local');
await page.fill('input[name="password"]', 'wrong-password');
await page.click('button[type="submit"]');
await page.waitForURL(/\/login\?error=1/, { timeout: 15000 });
console.log('bad login →', (await page.locator('text=does not match').count()) > 0 ? 'PASS banner' : 'FAIL banner');

// 3. correct login → /admin overview
await page.fill('input[name="email"]', 'owner@arogyabhog.local');
await page.fill('input[name="password"]', 'arogyabhog-dev-admin');
await page.click('button[type="submit"]');
await page.waitForURL(/\/admin$/, { timeout: 15000 });
console.log('login →', (await page.locator('text=Audit entries').count()) > 0 ? 'PASS overview' : 'FAIL overview');

// 4. audit log shows the login events
await page.goto(`${base}/admin/audit`, { waitUntil: 'networkidle' });
const auditHtml = await page.content();
console.log('audit rows →', auditHtml.includes('auth.login') && auditHtml.includes('auth.login_failed') ? 'PASS events' : 'FAIL events');

// 5. CSV export downloads with header + rows (request context shares cookies)
const resp = await page.request.get(`${base}/admin/audit/export.csv`);
const csv = await resp.text();
console.log('csv →', resp.status() === 200 && csv.startsWith('id,at_iso') && csv.includes('auth.login') ? 'PASS export' : `FAIL ${resp.status()}`);

// 6. sign out → /admin bounces again
await page.goto(`${base}/admin`, { waitUntil: 'networkidle' });
await page.click('text=Sign out');
await page.waitForURL(/\/$/, { timeout: 15000 });
await page.goto(`${base}/admin`, { waitUntil: 'networkidle' });
console.log('post-logout /admin →', page.url().includes('/login') ? 'PASS bounce' : `FAIL ${page.url()}`);

// 7. manager role also gets in (RBAC: staff, store-scoped)
await page.fill('input[name="email"]', 'manager@arogyabhog.local');
await page.fill('input[name="password"]', 'arogyabhog-dev-manager');
await page.click('button[type="submit"]');
await page.waitForURL(/\/admin$/, { timeout: 15000 });
console.log('manager login →', (await page.locator('text=Manager console').count()) > 0 ? 'PASS scoped' : 'FAIL scoped');
await page.screenshot({ path: 'shots/admin.png' });

await b.close();
console.log('ADMIN FLOW DONE');
