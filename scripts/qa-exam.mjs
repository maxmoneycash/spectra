/**
 * Exam reels QA driver (mobile viewport).
 * Usage: node scripts/qa-exam.mjs [outdir] [baseUrl]
 */
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '/tmp/spectra-exam';
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

const shot = async (n) => {
  await page.screenshot({ path: `${OUT}/${n}.png` });
  console.log('shot:', n);
};

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.getByRole('tab', { name: 'Exam' }).click();
await page.waitForTimeout(1800);
await shot('e1-reel');

const first = await page.evaluate(() => {
  const id = document.querySelector('.font-mono')?.textContent?.trim();
  const q = document.querySelector('p')?.textContent?.trim().slice(0, 70);
  const answers = [...document.querySelectorAll('button')]
    .map((b) => b.textContent.trim())
    .filter((t) => t.length > 20).length;
  return { id, q, answers };
});
console.log('first card:', JSON.stringify(first));

// Answer the first card by pressing "A", then check feedback appeared.
await page.keyboard.press('a');
await page.waitForTimeout(600);
await shot('e2-answered');

const feedback = await page.evaluate(() => {
  const t = document.body.innerText;
  return {
    hasVerdict: /Correct\.|Answer: [ABCD]\./.test(t),
    hasNext: /\bNext\b/.test(t),
  };
});
console.log('feedback:', JSON.stringify(feedback));

// Advance and confirm the card changed.
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(700);
const second = await page.evaluate(() => document.querySelector('.font-mono')?.textContent?.trim());
console.log('advanced to:', second, '(changed:', second !== first.id, ')');
await shot('e3-next');

// Switch pool to General (lazy chunk load).
await page.getByRole('tab', { name: 'General' }).click();
await page.waitForTimeout(1800);
const gen = await page.evaluate(() => document.querySelector('.font-mono')?.textContent?.trim());
console.log('general card id:', gen);
await shot('e4-general');

// Touch-target audit for this view.
const audit = await page.evaluate(() => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const btns = [...document.querySelectorAll('button')].filter(vis);
  const small = btns.filter((b) => {
    const r = b.getBoundingClientRect();
    return r.height < 44;
  });
  return {
    buttons: btns.length,
    under44: small.length,
    samples: small.slice(0, 6).map((b) => {
      const r = b.getBoundingClientRect();
      return `${(b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 20)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    }),
    overflow: document.body.scrollWidth > window.innerWidth,
  };
});
console.log('AUDIT:', JSON.stringify(audit));
console.log('errors:', JSON.stringify(errors));
await browser.close();
