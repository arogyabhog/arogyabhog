import { chromium } from 'playwright-core';

const base = 'http://localhost:3000';
const b = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await b.newPage({ viewport: { width: 1050, height: 900 } });
const ok = (name, cond) => console.log(`${name} →`, cond ? 'PASS' : 'FAIL');

// 1. register a customer with the owner's referral code
await page.goto(`${base}/register`, { waitUntil: 'networkidle' });
await page.fill('input[name="name"]', 'Test Buyer');
await page.fill('input[name="email"]', `buyer${Date.now()}@arogyabhog.local`);
await page.fill('input[name="password"]', 'buyer-pass-123');
await page.fill('input[name="referral"]', 'OWNER0001');
await page.click('button[type="submit"]');
await page.waitForURL(/\/$/, { timeout: 15000 });
ok('register+login', true);

// 2. add everyday atta 10 kg to cart from the PDP
await page.goto(`${base}/shop/everyday-atta`, { waitUntil: 'networkidle' });
await page.click('text=Add to cart');
await page.waitForTimeout(400);
const badge = await page.locator('header a[href="/checkout"] span').textContent();
ok('cart badge = 1', badge?.trim() === '1');

// 3. checkout with COD
await page.goto(`${base}/checkout`, { waitUntil: 'networkidle' });
ok('checkout line visible', (await page.locator('text=ArogyaBhog Everyday Atta').count()) > 0);
await page.fill('input[name="phone"]', '9876543210');
await page.fill('input[name="pincode"]', '208001');
await page.fill('textarea[name="address"]', '14/2 Civil Lines, near Phool Bagh');
await page.check('input[value="COD"]');
await page.click('button[type="submit"]');
await page.waitForURL(/\/orders\/od_/, { timeout: 20000 });
const codUrl = page.url();
ok('COD order placed', codUrl.includes('/orders/od_'));
ok('COD receipt + note', (await page.locator('text=Cash on delivery: pay our driver').count()) > 0);

// 4. second order with UPI QR → QR + attest
await page.goto(`${base}/shop/sugar-care-atta`, { waitUntil: 'networkidle' });
await page.click('text=Add to cart');
await page.goto(`${base}/checkout`, { waitUntil: 'networkidle' });
await page.fill('input[name="phone"]', '9876543210');
await page.fill('input[name="pincode"]', '208001');
await page.fill('textarea[name="address"]', '14/2 Civil Lines, near Phool Bagh');
await page.check('input[value="UPI_QR"]');
await page.click('button[type="submit"]');
await page.waitForURL(/\/orders\/od_/, { timeout: 20000 });
ok('UPI QR rendered', (await page.locator('img[alt^="UPI QR"]').count()) === 1);
await page.screenshot({ path: 'shots/order-upi.png' });
await page.click('text=I have paid · attest');
await page.locator('text=waiting for our verification').waitFor({ timeout: 15000 });
ok('attested state', true);
await page.screenshot({ path: 'shots/order-attested.png' });

// 5. orders list shows both
await page.goto(`${base}/orders`, { waitUntil: 'networkidle' });
const rows = await page.locator('a[href^="/orders/od_"]').count();
ok('orders list = 2', rows === 2);

await b.close();
console.log('CHECKOUT FLOW DONE', codUrl);
