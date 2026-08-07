/**
 * Deep-link QA: an incoming URL restores state, and navigation writes it back.
 * Usage: node scripts/qa-links.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:5173';
const browser = await chromium.launch();
const errors = [];
let failures = 0;

const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
};

async function open(path) {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  page.on('pageerror', (e) => errors.push(`${path}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${path}: ${m.text()}`);
  });
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  return page;
}

const activeTab = (page) =>
  page.evaluate(
    () => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() ?? null,
  );

// 1. view param restores the view
for (const [view, label] of [
  ['ctf', 'CTF'],
  ['exam', 'Exam'],
  ['academy', 'Academy'],
]) {
  const p = await open(`/?view=${view}`);
  check(`?view=${view}`, (await activeTab(p)) === label, `tab=${await activeTab(p)}`);
  await p.close();
}

// 2. challenge deep link opens that challenge
{
  const p = await open('/?view=ctf&c=morse-beacon');
  const label = await p.evaluate(
    () => document.querySelector('[role="dialog"]')?.getAttribute('aria-label') ?? null,
  );
  check('?c=morse-beacon opens the challenge', label === 'Beacon Traffic', `dialog=${label}`);
  await p.close();
}

// 3. pool + topic deep link
{
  const p = await open('/?view=exam&pool=general&topic=G5');
  const state = await p.evaluate(() => document.body.innerText);
  check('?pool=general', /General reels/i.test(state));
  check('?topic=G5 applied', /G5/.test(state));
  await p.close();
}

// 4. scenario deep link
{
  const p = await open('/?view=console&scenario=ism-sweep');
  const txt = await p.evaluate(() => document.body.innerText);
  check('?scenario=ism-sweep', /ISM/i.test(txt));
  await p.close();
}

// 5. hostile params must be dropped, not acted on.
// (Invalid percent-encoding like `%%%` is rejected by the dev server itself
// before the app loads; production serves it 200, so it's tested via the
// values the app can actually observe.)
{
  const p = await open('/?view=nope&c=../../etc/passwd&scenario=<script>');
  const alive = await p.evaluate(() => !!document.querySelector('[role="tab"]'));
  const tab = await activeTab(p);
  check('hostile params fall back cleanly', alive && tab === 'Console', `tab=${tab}`);
  await p.close();
}

// 6. navigating writes the URL back
{
  const p = await open('/');
  await p.getByRole('tab', { name: 'CTF' }).click();
  await p.waitForTimeout(700);
  const url = p.url();
  check('navigation updates the URL', url.includes('view=ctf'), url.split('?')[1] ?? '(none)');
  const entries = await p.evaluate(() => history.length);
  await p.getByRole('tab', { name: 'Exam' }).click();
  await p.waitForTimeout(700);
  const after = await p.evaluate(() => history.length);
  check('uses replaceState (no history spam)', after === entries, `${entries} -> ${after}`);
  await p.close();
}

console.log('errors:', JSON.stringify(errors));
console.log(failures === 0 && errors.length === 0 ? 'ALL PASS' : `${failures} FAILURES`);
await browser.close();
process.exit(failures === 0 && errors.length === 0 ? 0 : 1);
