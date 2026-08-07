/**
 * Verify the exam reels actually play pre-rendered narration.
 * Usage: node scripts/qa-narration.mjs [baseUrl]
 *
 * Passes when the page requests the manifest and then the .m4a for the visible
 * question — i.e. it used the rendered file, not the live-synthesis fallback.
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:5173';

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const audioRequests = [];
page.on('request', (r) => {
  const u = r.url();
  if (u.includes('/exam/audio/')) audioRequests.push(u.split('/exam/audio/')[1]);
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.getByRole('tab', { name: 'Exam' }).click();
await page.waitForTimeout(1800);

// Turn narration on.
const toggle = page.getByRole('button', { name: /turn narration on/i });
if (await toggle.count()) {
  await toggle.click();
  await page.waitForTimeout(1500);
} else {
  console.log('FAIL: narration toggle not found');
}

// Advance a couple of cards so we exercise more than the first.
for (let i = 0; i < 2; i++) {
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(1200);
}

const manifest = audioRequests.filter((u) => u.endsWith('manifest.json'));
const clips = audioRequests.filter((u) => u.endsWith('.m4a'));

console.log('manifest requests:', manifest.length, manifest[0] ?? '');
console.log('clip requests    :', clips.length, clips.slice(0, 4).join(', '));
console.log('errors           :', JSON.stringify(errors));
console.log(
  clips.length >= 1 && manifest.length >= 1
    ? 'PASS — reels are playing pre-rendered narration'
    : 'FAIL — no rendered clips requested (fell back to live synthesis)',
);

await browser.close();
