/**
 * Mobile-focused visual QA driver.
 * Usage: node scripts/qa-mobile.mjs [outdir] [baseUrl]
 * Uses aria-labels (stable) rather than class names.
 */
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '/tmp/spectra-mobile';
const BASE = process.argv[3] ?? 'http://localhost:5173';

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot:', name);
};

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await shot('m1-idle');

const play = page.getByRole('button', { name: /start the simulation/i }).first();
if (await play.count()) {
  await play.click();
  await page.waitForTimeout(4500);
}
await shot('m2-running');

// Count what's competing for space in the mobile viewport.
const audit = await page.evaluate(() => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const btns = [...document.querySelectorAll('button')].filter(vis);
  const small = btns.filter((b) => {
    const r = b.getBoundingClientRect();
    return r.width < 44 || r.height < 44;
  });
  return {
    visibleButtons: btns.length,
    touchTargetsUnder44px: small.length,
    smallSamples: small.slice(0, 12).map((b) => {
      const r = b.getBoundingClientRect();
      return `${(b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 22)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    }),
    canvases: document.querySelectorAll('canvas').length,
    bodyScrollW: document.body.scrollWidth,
    innerW: window.innerWidth,
  };
});

console.log('AUDIT:', JSON.stringify(audit, null, 2));
console.log('errors:', JSON.stringify(errors));
await browser.close();
