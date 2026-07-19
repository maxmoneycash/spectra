/**
 * Renders public/og.png (1200×630 site OG card) via the app's ?ogcard=1 capture page.
 * Usage: node scripts/make-og.mjs   (dev server on :5173 required)
 */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1240, height: 700 }, deviceScaleFactor: 1 });
await page.goto('http://localhost:5173/?ogcard=1', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelector('canvas')?.dataset.ready === 'true', null, {
  timeout: 10000,
});
const canvas = page.locator('canvas');
await canvas.screenshot({ path: 'public/og.png' });
await browser.close();
console.log('wrote public/og.png');
