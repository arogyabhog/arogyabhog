import { chromium } from 'playwright-core';

const targets = [
  ['/', 'home'],
  ['/shop', 'shop'],
  ['/shop/high-protein-atta', 'pdp'],
  ['/shop/sharbati-wheat-atta', 'single'],
  ['/lab', 'lab'],
];
const sizes = [
  [390, 844, 'mobile'],
  [1050, 900, 'mid'],
  [1440, 900, 'desktop'],
];

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
for (const [w, h, label] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  for (const [path, tag] of targets) {
    await page.goto(`http://localhost:3000${path}`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const d = document.documentElement;
      const bad = [...document.querySelectorAll('*')]
        .filter((el) => el.getBoundingClientRect().right > d.clientWidth + 1)
        .slice(0, 5)
        .map((el) => `${el.tagName}.${String(el.className).slice(0, 70)}`);
      return { scrollW: d.scrollWidth, clientW: d.clientWidth, bad };
    });
    console.log(`${label} ${path} scrollW=${m.scrollW} clientW=${m.clientW} overflowers=${JSON.stringify(m.bad)}`);
    await page.screenshot({ path: `shots/${label}-${tag}.png` });
  }
  await page.close();
}
await browser.close();
console.log('SHOTS DONE');
