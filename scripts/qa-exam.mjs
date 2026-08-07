/**
 * Exam reels QA (mobile viewport) — snap-scroll feed.
 * Usage: node scripts/qa-exam.mjs [outdir] [baseUrl]
 */
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '/tmp/spectra-exam';
const BASE = process.argv[3] ?? 'http://localhost:5173';

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
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

const shot = async (n) => {
  await page.screenshot({ path: `${OUT}/${n}.png` });
  console.log('shot:', n);
};
const cardId = () =>
  page.evaluate(() => {
    const cards = [...document.querySelectorAll('article[aria-label^="Question"]')];
    const mid = window.innerHeight / 2;
    const hit = cards.find((c) => {
      const r = c.getBoundingClientRect();
      return r.top <= mid && r.bottom >= mid;
    });
    return hit?.getAttribute('aria-label') ?? null;
  });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.getByRole('tab', { name: 'Exam' }).click();
await page.waitForTimeout(2000);
await shot('e1-reel');

const first = await cardId();
console.log('first card :', first);

// Answer the visible card with "A".
await page.keyboard.press('a');
await page.waitForTimeout(500);
const graded = await page.evaluate(() => /correct|answer [abcd]/i.test(document.body.innerText));
console.log('graded     :', graded);
await shot('e2-answered');

// Scroll the feed (this is the core "is it scrollable" check).
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(900);
const second = await cardId();
console.log('after scroll:', second, '| changed:', second !== first);
await shot('e3-scrolled');

// The feed must be a real scroller with height beyond one screen.
const metrics = await page.evaluate(() => {
  const sc = document.querySelector('[aria-label="Exam question reels"]');
  if (!sc) return null;
  return {
    scrollHeight: sc.scrollHeight,
    clientHeight: sc.clientHeight,
    scrollTop: Math.round(sc.scrollTop),
    snap: getComputedStyle(sc).scrollSnapType,
  };
});
console.log('scroller   :', JSON.stringify(metrics));

// Filter sheet (pool + topic).
await page.getByRole('button', { name: /browse questions/i }).click();
await page.waitForTimeout(700);
await shot('e4-sheet');
const sheetHasPools = await page.evaluate(() =>
  ['Technician', 'General', 'Extra'].every((n) => document.body.innerText.includes(n)),
);
console.log('sheet pools:', sheetHasPools);

// Touch-target audit.
const audit = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].filter((b) => {
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  const small = btns.filter((b) => b.getBoundingClientRect().height < 44);
  return {
    buttons: btns.length,
    under44: small.length,
    overflowX: document.body.scrollWidth > window.innerWidth,
  };
});
console.log('audit      :', JSON.stringify(audit));
console.log('errors     :', JSON.stringify(errors));
await browser.close();
