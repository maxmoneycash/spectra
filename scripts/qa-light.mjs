/**
 * Light/dark parity check for the stage (spectrum + waterfall).
 * Usage: node scripts/qa-light.mjs [outdir] [baseUrl]
 */
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '/tmp/spectra-light';
const BASE = process.argv[3] ?? 'http://localhost:5173';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

/** Mean luminance of the waterfall canvas — the honest "is it light?" test. */
const stageLuma = () =>
  page.evaluate(() => {
    const cs = [...document.querySelectorAll('canvas')];
    // The waterfall is the tallest canvas on the stage.
    const wf = cs.sort((a, b) => b.height - a.height)[0];
    if (!wf) return null;
    const ctx = wf.getContext('2d');
    const { data } = ctx.getImageData(0, 0, wf.width, Math.min(wf.height, 120));
    let sum = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      n++;
    }
    return { luma: Math.round(sum / n), w: wf.width, h: wf.height };
  });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const isDark = () => page.evaluate(() => document.documentElement.classList.contains('dark'));
console.log('initial theme dark?', await isDark());

await page.getByRole('button', { name: /start the simulation/i }).first().click();
await page.waitForTimeout(4000);

await page.screenshot({ path: `${OUT}/light-console.png` });
console.log('LIGHT stage:', JSON.stringify(await stageLuma()));

// Flip to dark.
await page.getByRole('button', { name: /switch to dark theme/i }).first().click();
await page.waitForTimeout(3500);
await page.screenshot({ path: `${OUT}/dark-console.png` });
console.log('DARK  stage:', JSON.stringify(await stageLuma()));
console.log('now dark?', await isDark());

console.log('errors:', JSON.stringify(errors));
await browser.close();
