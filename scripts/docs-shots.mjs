/**
 * Capture docs/screenshots with the current UI (chanhdai idiom, both themes).
 * Usage: node scripts/docs-shots.mjs   (dev server on :5173 required)
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = new URL('../docs/screenshots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5173';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

async function shot(name) {
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log('docs shot:', name);
}
async function theme(name) {
  await page.click('button[aria-label*="theme"]');
  await page.waitForTimeout(800);
}
async function mission(name) {
  await page.click('.border-l .flex.gap-4 button:has-text("Mission"), aside button:has-text("Mission")');
  await page.waitForTimeout(400);
  await page.click(`button:has-text("${name}")`);
  await page.waitForTimeout(400);
}

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// Light theme, running.
await page.click('button[aria-label="Start the simulation"]');
await page.waitForTimeout(5000);
await shot('analyzer');

// Tuned to the strongest signal with row expanded.
await page.locator('.divide-y > div[role="button"]').first().click();
await page.waitForTimeout(1500);
await shot('fm-broadcast');
await shot('receiver-scopes');
await shot('signals-snr');

// Dark theme console.
await theme('dark');
await page.waitForTimeout(400);
await shot('analyzer-dark');

// Academy, both themes.
await page.click('button[role="tab"]:has-text("Academy")');
await page.waitForTimeout(800);
await shot('academy-dark');
await theme('light');
await page.waitForTimeout(400);
await shot('academy');

// Back to console, light, ISM + wideband scenarios.
await page.click('button[role="tab"]:has-text("Console")');
await page.waitForTimeout(500);
await mission('ISM Sensor Sweep');
await page.waitForTimeout(6000);
await shot('ism-lora');
await mission('Wideband Sandbox');
await page.waitForTimeout(6000);
await shot('wideband');

await page.close();

// Mobile.
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await m.goto(BASE, { waitUntil: 'networkidle' });
await m.waitForTimeout(700);
await m.tap('button[aria-label="Start the simulation"]');
await m.waitForTimeout(5000);
await m.screenshot({ path: `${OUT}mobile.png` });
console.log('docs shot: mobile');
await m.tap('button[aria-label="Open panels"]');
await m.waitForTimeout(900);
await m.screenshot({ path: `${OUT}mobile-sheet.png` });
console.log('docs shot: mobile-sheet');
await m.close();

await browser.close();
console.log('done');
