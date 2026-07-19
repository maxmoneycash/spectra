/** Theme + new-UI QA shots. Dev server on :5173 required. */
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '/tmp/spectra-shots';
const BASE = 'http://localhost:5173';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE ERROR:', m.text()));
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/t1-light-idle.png` });
console.log('shot: t1-light-idle');

// Start + let signals appear.
await page.click('button[aria-label="Start the simulation"]');
await page.waitForTimeout(4500);
await page.screenshot({ path: `${OUT}/t2-light-running.png` });
console.log('shot: t2-light-running');

// Expand a detection row.
const row = page.locator('.divide-y > div[role="button"]').first();
if (await row.count()) {
  await row.click();
  await page.waitForTimeout(900);
}
await page.screenshot({ path: `${OUT}/t3-light-tuned.png` });
console.log('shot: t3-light-tuned');

// Dark theme via toggle.
await page.click('button[aria-label*="theme"]');
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/t4-dark-running.png` });
console.log('shot: t4-dark-running');

// Academy in dark, then light.
await page.click('button[role="tab"]:has-text("Academy")');
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/t5-dark-academy.png` });
console.log('shot: t5-dark-academy');
await page.click('button[aria-label*="theme"]');
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/t6-light-academy.png` });
console.log('shot: t6-light-academy');

// Mobile, light.
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
m.on('pageerror', (e) => console.log('MOBILE PAGE ERROR:', e.message));
await m.goto(BASE, { waitUntil: 'networkidle' });
await m.waitForTimeout(900);
await m.tap('button[aria-label="Start the simulation"]');
await m.waitForTimeout(4500);
await m.screenshot({ path: `${OUT}/t7-mobile-light.png` });
console.log('shot: t7-mobile-light');
await m.tap('button[aria-label="Open panels"]');
await m.waitForTimeout(800);
await m.screenshot({ path: `${OUT}/t8-mobile-sheet.png` });
console.log('shot: t8-mobile-sheet');

await browser.close();
console.log('done');
