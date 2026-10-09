/**
 * CTF solvability bench: every CW-flag challenge, run through the real
 * scene → receiver → keyer → decoder chain exactly as a player would operate
 * it, with the decoded text checked against the stored flag hash.
 *
 *   ./node_modules/.bin/vite-node scripts/ctf-solvability.ts
 *
 * Why this exists: the unit test in src/ctf/ctf.test.ts proves the Morse
 * table can *produce* each flag (encode → decode). It cannot see whether the
 * RECEIVER lets the flag through — Split the Pair shipped unsolvable because
 * narrowing the filter was a no-op in the DSP, and no test ran the DSP. This
 * bench does, and it also checks the opposite failure: a challenge whose
 * "obstacle" the DSP doesn't actually impose (Below the Gate copies at the
 * default squelch ⇒ no operating required ⇒ not a challenge).
 *
 * Takes about a minute.
 */
import { Scene } from '../src/sim/scene';
import { Receiver } from '../src/dsp/receiver';
import { MorseDecoder } from '../src/sim/morse';
import { CwKeyer } from '../src/dsp/cwKeyer';
import { challengeById } from '../src/ctf/challenges';
import { checkFlag } from '../src/ctf/store';
import { DEFAULT_SQUELCH_DB } from '../src/store/modes';

const SR = 1_152_000, BLOCK = 16384;
const blocksFor = (sec: number) => Math.round((sec * SR) / BLOCK);
const clean = (s: string) => s.replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

interface RunOpts {
  id: string;
  /** VFO offset from the challenge's centre, Hz. */
  tune: number;
  mode?: 'cw' | 'nfm' | 'usb' | 'lsb' | 'am';
  bw?: number;
  /** Defaults to the challenge's own starting squelch — what the CTF view applies on open. */
  squelch?: number;
  sec: number;
}

/** Decoded text + the receiver's settled channel level (what squelch compares against). */
function run(o: RunOpts): { text: string; levelDb: number } {
  const c = challengeById(o.id)!;
  const scene = new Scene({ sampleRate: SR, centerFreqHz: c.centerFreqHz, noiseSigma: c.noiseSigma });
  for (const e of c.emitters) scene.add(e);
  const rx = new Receiver(SR);
  rx.setMode(o.mode ?? 'cw');
  rx.setBandwidth(o.bw ?? 500);
  rx.setTuning(o.tune);
  rx.setSquelch(o.squelch ?? c.startSquelchDb ?? DEFAULT_SQUELCH_DB);
  const re = new Float32Array(BLOCK), im = new Float32Array(BLOCK), audio = new Float32Array(4096);
  const dec = new MorseDecoder();
  const keyer = new CwKeyer((on, d) => dec.push(on, d));
  const levels: number[] = [];
  const n = blocksFor(o.sec);
  for (let b = 0; b < n; b++) {
    scene.generate(re, im, BLOCK);
    keyer.process(audio, rx.process(re, im, BLOCK, audio));
    if (b > n / 2) levels.push(rx.level); // settled half
  }
  levels.sort((a, b) => a - b);
  return { text: clean(dec.output), levelDb: levels[Math.floor(levels.length / 2)] ?? NaN };
}

/** Does any run of words in the decoded text validate against the stored hash? */
async function solves(id: string, text: string): Promise<boolean> {
  const words = text.split(' ').filter(Boolean);
  for (let i = 0; i < words.length; i++)
    for (let j = i + 1; j <= Math.min(words.length, i + 4); j++)
      if (await checkFlag(id, words.slice(i, j).join(' '))) return true;
  return false;
}

type Case = { label: string; expect: 'solves' | 'blocked' | 'info'; opts: RunOpts };
const MHZ = 1e6;
const cases: Case[] = [
  // Beacon Traffic: tune the carrier (7.061 from 7.05 centre), stock CW filter.
  { label: 'morse-beacon  tuned, stock 500 Hz', expect: 'solves', opts: { id: 'morse-beacon', tune: 0.011 * MHZ, sec: 24 } },

  // Deep Cut: weak -13 dB beacon at +18 kHz; a -2 dB WFM at -60 kHz spans roughly
  // -150..+30 kHz, i.e. OVER the beacon. The hint says narrow the filter.
  { label: 'deep-cut      tuned, stock 500 Hz', expect: 'info', opts: { id: 'deep-cut', tune: 0.018 * MHZ, sec: 32 } },
  { label: 'deep-cut      tuned, narrowed 200', expect: 'solves', opts: { id: 'deep-cut', tune: 0.018 * MHZ, bw: 200, sec: 32 } },

  // Split the Pair: on the flag carrier with the narrowed filter (the taught path).
  { label: 'split-pair    on flag, narrowed 200', expect: 'solves', opts: { id: 'split-the-pair', tune: 0, bw: 200, sec: 18 } },

  // Working the Input: the player finds the NFM output at +300 kHz; the flag is
  // keyed on the input 600 kHz below it, i.e. at -300 kHz from centre.
  { label: 'repeater      on OUTPUT in NFM (as found)', expect: 'blocked', opts: { id: 'repeater-input', tune: 0.3 * MHZ, mode: 'nfm', bw: 12_000, sec: 20 } },
  { label: 'repeater      on INPUT in CW', expect: 'solves', opts: { id: 'repeater-input', tune: -0.3 * MHZ, sec: 26 } },

  // Below the Gate: the premise is that the default squelch mutes the beacon.
  // At -80 it must NOT copy; opened up it must.
  { label: 'squelch-down  tuned, at its starting squelch', expect: 'blocked', opts: { id: 'squelch-down', tune: 0.005 * MHZ, sec: 26 } },
  { label: 'squelch-down  tuned, squelch -40', expect: 'info', opts: { id: 'squelch-down', tune: 0.005 * MHZ, squelch: -40, sec: 26 } },
  { label: 'squelch-down  tuned, squelch -30', expect: 'info', opts: { id: 'squelch-down', tune: 0.005 * MHZ, squelch: -30, sec: 26 } },
  { label: 'squelch-down  tuned, squelch open (-120)', expect: 'solves', opts: { id: 'squelch-down', tune: 0.005 * MHZ, squelch: -120, sec: 26 } },
];

let failures = 0;
console.log('\n== CTF solvability through the real receiver ==');
for (const k of cases) {
  const r = run(k.opts);
  const ok = await solves(k.opts.id, r.text);
  const verdict =
    k.expect === 'info' ? (ok ? 'copies' : 'no copy') :
    (k.expect === 'solves') === ok ? 'PASS' : 'FAIL';
  if (verdict === 'FAIL') failures++;
  console.log(
    `${verdict.padEnd(8)} ${k.label.padEnd(42)} level ${r.levelDb.toFixed(1).padStart(6)} dB  ${JSON.stringify(r.text.slice(0, 48))}`,
  );
}
console.log(failures ? `\n${failures} case(s) contradict the challenge design.` : '\nEvery challenge behaves as designed.');
process.exit(failures ? 1 : 0);
