/**
 * Capture docs/screenshots with the current UI.
 * Usage: node scripts/docs-shots.mjs   (dev server on :5173 required)
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = new URL('../docs/screenshots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5173';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function shot(name) {
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log('docs shot:', name);
}

async function selectMission(name) {
  await page.click('.rail .seg-item:has-text("Mission")');
  await page.waitForTimeout(400);
  await page.click(`.scenario-card:has-text("${name}")`);
  await page.waitForTimeout(300);
}

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// FM band, running, tuned to a station with a card expanded.
await page.click('.start-play');
await page.waitForTimeout(5000);
await shot('analyzer');

await page.click('.det-item >> nth=0');
await page.waitForTimeout(1500);
await shot('fm-broadcast');
await shot('receiver-scopes');

// Signals + SNR history: same expanded card, scroll rail to show it fully.
await page.locator('.rail-body').evaluate((el) => el.scrollTo({ top: 0 }));
await page.waitForTimeout(300);
await shot('signals-snr');

// ISM band with LoRa chirps.
await selectMission('ISM Sensor Sweep');
await page.waitForTimeout(6000);
await shot('ism-lora');

// Wideband.
await selectMission('Wideband Sandbox');
await page.waitForTimeout(6000);
await shot('wideband');

await page.close();

// Mobile.
const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
await mobile.goto(BASE, { waitUntil: 'networkidle' });
await mobile.waitForTimeout(600);
await mobile.tap('.tp-play');
await mobile.waitForTimeout(5000);
await mobile.screenshot({ path: `${OUT}mobile.png` });
console.log('docs shot: mobile');
await mobile.tap('.panels-btn');
await mobile.waitForTimeout(800);
await mobile.screenshot({ path: `${OUT}mobile-sheet.png` });
console.log('docs shot: mobile-sheet');
await mobile.close();

await browser.close();
console.log('done');
