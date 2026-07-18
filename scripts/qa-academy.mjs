/** Academy-view QA shots. Dev server on :5173 required. */
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '/tmp/spectra-shots';
const BASE = 'http://localhost:5173';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE ERROR:', m.text()));
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

// Switch to Academy.
await page.click('.view-seg .seg-item:has-text("Academy")');
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/a1-academy.png` });
console.log('shot: a1-academy');

// Zoom into VHF/UHF: hover mid-right and wheel in several times.
await page.mouse.move(720, 160);
for (let i = 0; i < 10; i++) {
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(90);
}
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/a2-zoomed.png` });
console.log('shot: a2-zoomed');

// Select FM Broadcast via the inspector's sim chip, then tune the simulator.
await page.click('.acad-chip:has-text("FM Broadcast")');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/a3-inspector.png` });
console.log('shot: a3-inspector');

await page.click('.acad-tune-btn');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/a6-tuned-console.png` });
console.log('shot: a6-tuned-console');

// Lessons rail is visible at the bottom of every shot; check a lesson demo card.
// Mobile.
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
m.on('pageerror', (e) => console.log('MOBILE PAGE ERROR:', e.message));
await m.goto(BASE, { waitUntil: 'networkidle' });
await m.waitForTimeout(700);
await m.tap('.view-seg .seg-item:has-text("Academy")');
await m.waitForTimeout(900);
await m.screenshot({ path: `${OUT}/a4-mobile.png` });
console.log('shot: a4-mobile');

// Scroll the rail down to lessons.
await m.evaluate(() => {
  const rail = document.querySelector('.academy-rail');
  if (rail) rail.scrollTop = rail.scrollHeight;
});
await m.waitForTimeout(500);
await m.screenshot({ path: `${OUT}/a5-mobile-lessons.png` });
console.log('shot: a5-mobile-lessons');

await browser.close();
console.log('done');
