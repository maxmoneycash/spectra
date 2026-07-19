/** Course + Reference QA shots. Dev server on :5173 required. */
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '/tmp/spectra-shots';
const BASE = 'http://localhost:5173';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE ERROR:', m.text()));
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.click('button[role="tab"]:has-text("Academy")');
await page.waitForTimeout(500);

// Course tab.
await page.click('button:has-text("Course")');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/c1-course.png` });
console.log('shot: c1-course');

// Chapter 2-2 (modulated signals — has widgets + try-it chips).
await page.click('nav button:has-text("Audio, Digital and Modulated Signals")');
await page.waitForTimeout(700);
await page.evaluate(() => {
  const el = document.getElementById('course-article');
  if (el) el.scrollTop = el.scrollHeight * 0.55;
});
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/c2-chapter-widgets.png` });
console.log('shot: c2-chapter-widgets');

// Quiz: scroll to bottom, answer first question.
await page.evaluate(() => {
  const el = document.getElementById('course-article');
  if (el) el.scrollTop = el.scrollHeight;
});
await page.waitForTimeout(600);
const opt = page.locator('article button:has-text(""), article button').nth(0);
await page.locator('text=Check yourself').scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/c3-quiz.png` });
console.log('shot: c3-quiz');

// Reference tab: glossary.
await page.click('button:has-text("Reference")');
await page.waitForTimeout(1200);
await page.fill('input[aria-label="Search glossary"]', 'swr');
await page.waitForTimeout(400);
await page.click('details summary:has-text("swr")');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/c4-glossary.png` });
console.log('shot: c4-glossary');

// Playground: clear search, scroll down.
await page.fill('input[aria-label="Search glossary"]', '');
await page.evaluate(() => {
  const el = document.querySelector('.thin-scroll');
  window.scrollTo(0, 0);
});
await page.locator('text=Playground').scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/c5-playground.png` });
console.log('shot: c5-playground');

// Try-it handoff: back to course ch 2-2, click FM broadcast chip.
await page.click('button:has-text("Course")');
await page.waitForTimeout(800);
await page.click('nav button:has-text("Audio, Digital and Modulated Signals")');
await page.waitForTimeout(600);
await page.click('button:has-text("FM broadcast band")');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/c6-tryit-console.png` });
console.log('shot: c6-tryit-console');

// Mobile course.
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
m.on('pageerror', (e) => console.log('MOBILE PAGE ERROR:', e.message));
await m.goto(BASE, { waitUntil: 'networkidle' });
await m.waitForTimeout(700);
await m.tap('button[role="tab"]:has-text("Academy")');
await m.waitForTimeout(400);
await m.tap('button:has-text("Course")');
await m.waitForTimeout(1500);
await m.screenshot({ path: `${OUT}/c7-mobile-course.png` });
console.log('shot: c7-mobile-course');

await browser.close();
console.log('done');
