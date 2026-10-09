/**
 * CW keyer bench: the cases behind docs/BACKLOG.md's keyer table, run on
 * identical audio through the real scene → receiver → keyer → decoder chain.
 *
 *   ./node_modules/.bin/vite-node scripts/keyer-bench.ts            # the shipped keyer
 *   ./node_modules/.bin/vite-node scripts/keyer-bench.ts ./my.ts    # a candidate
 *
 * A candidate file default-exports (cb) => { process(audio, n) }. Takes ~1 min.
 */
import { Scene } from '../src/sim/scene';
import { Receiver } from '../src/dsp/receiver';
import { MorseDecoder } from '../src/sim/morse';
import { CwKeyer } from '../src/dsp/cwKeyer';
import { activeBeacon, SLOT_MS } from '../src/sim/ncdxf';

type Cb = (on: boolean, dur: number) => void;
type KeyerLike = { process(a: Float32Array, n: number): void };
let makeKeyer: (cb: Cb) => KeyerLike = (cb) => new CwKeyer(cb);
const variant = process.argv[2];
if (variant) makeKeyer = (await import(variant)).default;

const SR = 1_152_000, BLOCK = 16384, MHZ = 1e6;
const blocksFor = (sec: number) => Math.round((sec * SR) / BLOCK);

function run(opts: { center: number; noise: number; emitters: any[]; tune: number; bw?: number; squelch?: number; sec: number; at?: (sec: number, rx: Receiver) => void }) {
  const scene = new Scene({ sampleRate: SR, centerFreqHz: opts.center, noiseSigma: opts.noise });
  for (const e of opts.emitters) scene.add(e);
  const rx = new Receiver(SR);
  rx.setMode('cw'); rx.setBandwidth(opts.bw ?? 500); rx.setTuning(opts.tune); rx.setSquelch(opts.squelch ?? -120);
  const re = new Float32Array(BLOCK), im = new Float32Array(BLOCK), audio = new Float32Array(4096);
  const dec = new MorseDecoder();
  const keyer = makeKeyer((on, d) => dec.push(on, d));
  const n = blocksFor(opts.sec);
  for (let b = 0; b < n; b++) {
    opts.at?.((b * BLOCK) / SR, rx);
    scene.generate(re, im, BLOCK);
    keyer.process(audio, rx.process(re, im, BLOCK, audio));
  }
  return dec.output;
}
const clean = (s: string) => s.replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const res: Record<string, string> = {};

// 1. Empty channel: phantom letters.
{ const out = run({ center: 7.05 * MHZ, noise: 0.02, emitters: [], tune: 0, sec: 30 });
  const ph = out.replace(/\s/g, '').length; res.empty = `${ph} phantom chars in 30 s  ${JSON.stringify(out.slice(0, 40))}`; }
// 2. Squelch lesson's weak beacon (-26 dB).
{ const out = run({ center: 3.56 * MHZ, noise: 0.02, tune: 5_000, sec: 14, emitters: [{ id: 'qrp', kind: 'cw', freqHz: 3.565 * MHZ, powerDb: -26, wpm: 14, text: 'QRP TEST DE TRAINEE  ', seed: 931 }] });
  res.weakLesson = `${out.includes('TRAINEE') ? 'PASS' : 'FAIL'}  ${JSON.stringify(clean(out))}`; }
// 3. Below the Gate's weak beacon (-26 dB).
{ const out = run({ center: 10.12 * MHZ, noise: 0.02, tune: 5_000, sec: 19, emitters: [{ id: 'weak', kind: 'cw', freqHz: 10.125 * MHZ, powerDb: -26, wpm: 14, text: 'DE SPECTRA OPEN THE GATE  ', seed: 505 }] });
  res.weakCtf = `${out.includes('OPEN THE GATE') ? 'PASS' : 'FAIL'}  ${JSON.stringify(clean(out))}`; }
// 4. Eight power-on carousel starts: does the FIRST callsign copy exactly?
{ const realNow = Date.now; let ok = 0; const detail: string[] = [];
  for (let k = 0; k < 8; k++) {
    const t0 = Math.floor(realNow() / SLOT_MS) * SLOT_MS + k * 500; // 10, 9.5, ... 6.5 s of first beacon
    Date.now = () => t0;
    const want = activeBeacon(0, t0).call;
    const out = run({ center: 14.1 * MHZ, noise: 0.028, tune: 0, squelch: -80, sec: (SLOT_MS - k * 500) / 1000 - 0.3, emitters: [{ id: 'ncdxf-live', kind: 'cw', freqHz: 14.1 * MHZ, powerDb: -4, ncdxfBand: 0 }] });
    Date.now = realNow;
    const got = clean(out).split(' ')[0] ?? '';
    const hit = clean(out).startsWith(want); ok += hit ? 1 : 0; detail.push(`${want}→${got}`);
  }
  res.carousel = `${ok}/8 first callsigns exact  [${detail.join(', ')}]`; }
// 5. Squelch opened mid-stream on the weak beacon.
{ const out = run({ center: 10.12 * MHZ, noise: 0.02, tune: 5_000, sec: 20, squelch: -60, emitters: [{ id: 'weak', kind: 'cw', freqHz: 10.125 * MHZ, powerDb: -26, wpm: 14, text: 'DE SPECTRA OPEN THE GATE  ', seed: 505 }],
    at: (sec, rx) => { if (sec >= 6 && sec < 6.02) rx.setSquelch(-120); } });
  res.squelchMid = `${/SPECTRA|OPEN THE GATE/.test(out) ? 'PASS' : 'FAIL'}  ${JSON.stringify(clean(out))}`; }
// 6-9. Split the Pair, in the order a player meets it. The tracker bridges the
// two carriers into one detection, so a tap lands between them (+175 Hz).
const pair = [{ id: 'flag', kind: 'cw', freqHz: 14.02 * MHZ, powerDb: -5, wpm: 15, text: 'DE SPECTRA NARROW FILTER  ', seed: 501 }, { id: 'decoy', kind: 'cw', freqHz: 14.02035 * MHZ, powerDb: -5, wpm: 15, text: 'VVV VVV TEST DE TEST  ', seed: 502 }];
const pr = (tune: number, bw: number) => clean(run({ center: 14.02 * MHZ, noise: 0.028, tune, bw, sec: 17, emitters: pair })).slice(0, 50);
{ const out = pr(175, 500); res.pairTapStock = `${out.includes('NARROW FILTER') ? 'COPIES (should be garbage)' : 'garbage (as designed)'}  ${JSON.stringify(out)}`; }
{ const out = pr(175, 200); res.pairTapNarrow = `${out.includes('NARROW FILTER') || out.includes('TEST') ? 'copies?!' : 'quiet/garbage (as designed)'}  ${JSON.stringify(out)}`; }
{ const out = pr(0, 200); res.pairCentered = `${out.includes('NARROW FILTER') ? 'PASS' : 'FAIL'}  ${JSON.stringify(out)}`; }
{ const out = pr(0, 500); res.pairOnFlagStock = `(info) ${out.includes('NARROW FILTER') ? 'copies by pitch' : 'garbage'}  ${JSON.stringify(out)}`; }

console.log(`\n== keyer: ${variant ?? 'current (src/dsp/cwKeyer.ts)'} ==`);
for (const [k, v] of Object.entries(res)) console.log(`${k.padEnd(11)} ${v}`);
