/**
 * RF CTF QA: challenge list, sheet, flag verification, scoring.
 * Usage: node scripts/qa-ctf.mjs [outdir] [baseUrl]
 */
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '/tmp/spectra-ctf';
const BASE = process.argv[3] ?? 'http://localhost:5173';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

const shot = async (n) => {
  await page.screenshot({ path: `${OUT}/${n}.png` });
  console.log('shot:', n);
};
const scoreText = () =>
  page.evaluate(() => {
    const t = document.body.innerText;
    const m = t.match(/Score\s*\n?\s*(\d+)/i);
    const s = t.match(/Solved\s*\n?\s*(\d+\/\d+)/i);
    return { score: m?.[1] ?? null, solved: s?.[1] ?? null };
  });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.getByRole('tab', { name: 'CTF' }).click();
await page.waitForTimeout(900);
await shot('c1-list');

const count = await page.evaluate(
  () => [...document.querySelectorAll('button')].filter((b) => /pts|^\d+$/.test(b.textContent ?? '')).length,
);
console.log('challenge rows visible:', await page.evaluate(() => document.body.innerText.split('\n').filter(l=>/^\d+$/.test(l.trim())).length));
console.log('before:', JSON.stringify(await scoreText()));

// Open the first challenge.
await page.getByRole('button', { name: /First Light/ }).click();
await page.waitForTimeout(700);
const sheet = await page.evaluate(() => {
  const d = document.querySelector('[role="dialog"]');
  return d ? { label: d.getAttribute('aria-label'), hasInput: !!d.querySelector('input') } : null;
});
console.log('sheet:', JSON.stringify(sheet));
await shot('c2-challenge');

// Wrong answer must be rejected.
await page.locator('[role="dialog"] input').fill('99');
await page.getByRole('button', { name: 'Submit' }).click();
await page.waitForTimeout(600);
const wrong = await page.evaluate(() => /not it/i.test(document.body.innerText));
console.log('wrong rejected:', wrong);

// Correct answer must solve and bank points.
await page.locator('[role="dialog"] input').fill('4');
await page.getByRole('button', { name: 'Submit' }).click();
await page.waitForTimeout(800);
const solvedMsg = await page.evaluate(() => /solved/i.test(document.body.innerText));
console.log('correct accepted:', solvedMsg);
await shot('c3-solved');

await page.keyboard.press('Escape');
await page.waitForTimeout(600);
console.log('after :', JSON.stringify(await scoreText()));

// Progress must survive a reload.
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('tab', { name: 'CTF' }).click();
await page.waitForTimeout(800);
console.log('after reload:', JSON.stringify(await scoreText()));

console.log('errors:', JSON.stringify(errors));
void count;
await browser.close();
