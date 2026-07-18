/**
 * Visual QA screenshot driver.
 * Usage: node scripts/qa-shots.mjs [outdir]
 * Requires the dev server on http://localhost:5173.
 */
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? '/tmp/spectra-shots';
const BASE = 'http://localhost:5173';

const browser = await chromium.launch();

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot:', name);
}

// ---- Desktop ----
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
desktop.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text());
});
desktop.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

await desktop.goto(BASE, { waitUntil: 'networkidle' });
await desktop.waitForTimeout(600);
await shot(desktop, 'd1-idle');

// Start the simulation via the big stage play button.
await desktop.click('.start-play');
await desktop.waitForTimeout(4500);
await shot(desktop, 'd2-running');

// Tune to the strongest detection (first Stations card).
const det = desktop.locator('.det-item').first();
if (await det.count()) {
  await det.click();
  await desktop.waitForTimeout(1200);
}
await shot(desktop, 'd3-tuned');

// Levels popover.
await desktop.click('.wfc-btn:last-child');
await desktop.waitForTimeout(400);
await shot(desktop, 'd4-levels');
await desktop.keyboard.press('Escape');
await desktop.click('.spectrum-wrap', { position: { x: 200, y: 100 }, force: true }); // close pop + tune
await desktop.waitForTimeout(600);

// Mission panel.
await desktop.click('.seg-item:has-text("Mission")');
await desktop.waitForTimeout(500);
await shot(desktop, 'd5-mission');

// Library panel.
await desktop.click('.seg-item:has-text("Library")');
await desktop.waitForTimeout(500);
await shot(desktop, 'd6-library');

// Shortcuts popover.
await desktop.click('button[aria-label="Keyboard shortcuts"]');
await desktop.waitForTimeout(400);
await shot(desktop, 'd7-keys');

await desktop.close();

// ---- Mobile ----
const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
mobile.on('console', (m) => {
  if (m.type() === 'error') console.log('MOBILE CONSOLE ERROR:', m.text());
});
mobile.on('pageerror', (e) => console.log('MOBILE PAGE ERROR:', e.message));

await mobile.goto(BASE, { waitUntil: 'networkidle' });
await mobile.waitForTimeout(600);
await shot(mobile, 'm1-idle');

await mobile.tap('.tp-play');
await mobile.waitForTimeout(4500);
await shot(mobile, 'm2-running');

// Open the panel sheet.
await mobile.tap('.panels-btn');
await mobile.waitForTimeout(700);
await shot(mobile, 'm3-sheet');

// Switch to Mission tab in the sheet.
await mobile.tap('.sheet .seg-item:has-text("Mission")');
await mobile.waitForTimeout(500);
await shot(mobile, 'm4-sheet-mission');

await mobile.close();
await browser.close();
console.log('done');
