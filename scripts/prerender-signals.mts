/**
 * Pre-render the signal library into real, indexable HTML.
 *
 * The app is a single-route SPA, so none of its reference content could be
 * crawled — yet "what does LoRa look like on a waterfall" is a real query with
 * weak answers. This emits one static page per signal type, plus an index and
 * a sitemap, straight into dist/ after the Vite build.
 *
 * Run: npx vite-node scripts/prerender-signals.mts
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_KINDS, KIND_INFO } from '../src/sim/signal-kinds';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');
const ORIGIN = process.env.SITE_ORIGIN ?? 'https://spectra-one.vercel.app';

if (!existsSync(DIST)) {
  console.error('dist/ not found — run `vite build` first.');
  process.exit(1);
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmtBw = (hz: number) =>
  hz >= 1000 ? `${(hz / 1000).toFixed(hz % 1000 ? 1 : 0)} kHz` : `${hz} Hz`;

/** Shared chrome: system fonts, both themes, no external requests. */
const STYLE = `
:root{--bg:#fcfcfb;--fg:#18181b;--muted:#6b6b73;--line:#e6e6e3;--card:#fff;--accent:#c2410c}
@media(prefers-color-scheme:dark){:root{--bg:#09090b;--fg:#fafafa;--muted:#8e8e96;--line:#242427;--card:#131316;--accent:#ff8a5c}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:44rem;margin:0 auto;padding:2.5rem 1.25rem 4rem}
a{color:inherit}
.crumb{font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);text-decoration:none}
h1{font-size:clamp(1.7rem,5vw,2.4rem);line-height:1.15;letter-spacing:-.02em;margin:.6rem 0 .4rem}
.lede{font-size:1.06rem;color:var(--muted);margin:0 0 1.6rem}
dl{display:grid;grid-template-columns:auto 1fr;gap:.5rem 1.25rem;margin:0 0 1.8rem;padding:1rem 1.1rem;border:1px solid var(--line);border-radius:12px;background:var(--card)}
dt{font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
dd{margin:0;font-variant-numeric:tabular-nums}
h2{font-size:1.02rem;letter-spacing:.01em;margin:1.8rem 0 .5rem}
p{margin:0 0 1rem}
.cta{display:inline-block;margin:1.4rem 0 0;padding:.7rem 1.1rem;border-radius:10px;background:var(--fg);color:var(--bg);text-decoration:none;font-size:.92rem;font-weight:500}
nav.more{margin-top:2.5rem;border-top:1px solid var(--line);padding-top:1.2rem}
nav.more ul{list-style:none;padding:0;margin:.6rem 0 0;display:flex;flex-wrap:wrap;gap:.5rem}
nav.more a{display:inline-block;padding:.4rem .7rem;border:1px solid var(--line);border-radius:999px;font-size:.85rem;text-decoration:none;color:var(--muted)}
footer{margin-top:2.5rem;border-top:1px solid var(--line);padding-top:1.2rem;font-size:.85rem;color:var(--muted)}
`.trim();

function page(opts: {
  title: string;
  description: string;
  canonical: string;
  body: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<link rel="canonical" href="${opts.canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.description)}">
<meta property="og:url" content="${opts.canonical}">
<meta property="og:image" content="${ORIGIN}/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="color-scheme" content="light dark">
<style>${STYLE}</style>
</head>
<body><div class="wrap">${opts.body}</div></body>
</html>
`;
}

const others = (current?: string) =>
  `<nav class="more"><strong style="font-size:.9rem">Other signals</strong><ul>${ALL_KINDS.filter(
    (k) => k !== current,
  )
    .map((k) => `<li><a href="/signals/${k}/">${esc(KIND_INFO[k].label)}</a></li>`)
    .join('')}</ul></nav>`;

const FOOT = `<footer>Part of <a href="${ORIGIN}/">SPECTRA</a> — a browser-based software-defined radio lab. Live spectrum, a real DSP receiver, and an RF capture-the-flag. No hardware, no install.</footer>`;

mkdirSync(join(DIST, 'signals'), { recursive: true });
const urls: string[] = [`${ORIGIN}/signals/`];

for (const kind of ALL_KINDS) {
  const info = KIND_INFO[kind];
  const canonical = `${ORIGIN}/signals/${kind}/`;
  const title = `What ${info.label} looks like on a waterfall — SPECTRA`;
  const description = `${info.label}: ${info.blurb} Occupied bandwidth about ${fmtBw(
    info.bandwidthHz,
  )}.`;

  const body = `
<a class="crumb" href="/signals/">← Signal library</a>
<h1>${esc(info.label)}</h1>
<p class="lede">${esc(info.blurb)}</p>
<dl>
  <dt>Bandwidth</dt><dd>~${fmtBw(info.bandwidthHz)}</dd>
  <dt>Category</dt><dd>${esc(info.category)}</dd>
  <dt>Duty</dt><dd>${info.continuous ? 'Continuous' : 'Bursty'}</dd>
  <dt>Best demod</dt><dd>${info.recommendedDemod.toUpperCase()}</dd>
</dl>
<h2>How it looks on a waterfall</h2>
<p>${esc(info.waterfall)}</p>
<h2>Where you'll hear it</h2>
<p>${esc(info.realWorld)}</p>
<h2>See it live</h2>
<p>SPECTRA synthesises ${esc(
    info.label,
  )} in your browser, so you can watch its waterfall signature and hear it demodulated without any radio hardware.</p>
<a class="cta" href="${ORIGIN}/?view=console">Open the live receiver →</a>
${others(kind)}
${FOOT}`.trim();

  mkdirSync(join(DIST, 'signals', kind), { recursive: true });
  writeFileSync(join(DIST, 'signals', kind, 'index.html'), page({ title, description, canonical, body }));
  urls.push(canonical);
}

// Library index.
const indexBody = `
<a class="crumb" href="${ORIGIN}/">← SPECTRA</a>
<h1>Signal library</h1>
<p class="lede">What each radio signal looks like on a waterfall, what it sounds like, and where you'll run into it — ${
  ALL_KINDS.length
} modulations, each one synthesised live in the browser.</p>
<ul style="list-style:none;padding:0;margin:0">
${ALL_KINDS.map((k) => {
  const i = KIND_INFO[k];
  return `<li style="padding:.9rem 0;border-top:1px solid var(--line)"><a href="/signals/${k}/" style="text-decoration:none"><strong>${esc(
    i.label,
  )}</strong><br><span style="color:var(--muted);font-size:.92rem">${esc(
    i.waterfall,
  )}</span></a></li>`;
}).join('\n')}
</ul>
<a class="cta" href="${ORIGIN}/?view=console">Open the live receiver →</a>
${FOOT}`.trim();

writeFileSync(
  join(DIST, 'signals', 'index.html'),
  page({
    title: 'Signal library — what radio signals look like on a waterfall | SPECTRA',
    description: `Identify ${ALL_KINDS.length} radio modulations by their waterfall signature — FM, AM, SSB, CW, LoRa, FSK, OOK, PSK, frequency hoppers and pulsed radar.`,
    canonical: `${ORIGIN}/signals/`,
    body: indexBody,
  }),
);

// Sitemap + robots, so the new pages are actually discoverable.
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[`${ORIGIN}/`, ...urls].map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>
`,
);
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);

// Link the library from the SPA shell so crawlers can reach it from the root.
const shellPath = join(DIST, 'index.html');
const shell = readFileSync(shellPath, 'utf8');
if (!shell.includes('/signals/')) {
  const links = `<noscript><nav><a href="/signals/">Signal library</a>${ALL_KINDS.map(
    (k) => `<a href="/signals/${k}/">${esc(KIND_INFO[k].label)}</a>`,
  ).join('')}</nav></noscript>`;
  writeFileSync(shellPath, shell.replace('</body>', `${links}</body>`));
}

console.log(`prerendered ${ALL_KINDS.length} signal pages + index, sitemap, robots.txt`);
