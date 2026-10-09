import { describe, it, expect } from 'vitest';
import { encodeMorse, MorseDecoder } from './morse';

/** Decode a keying schedule from scratch. */
function decode(segs: { on: boolean; durSec: number }[]): MorseDecoder {
  const d = new MorseDecoder();
  for (const s of segs) d.push(s.on, s.durSec);
  return d;
}

/** Seeded RNG so degraded-timing tests are reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  const next = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const gauss = () => {
    const u = Math.max(next(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  return { next, gauss };
}

function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

// Texts that broke the old decoder: messages that open with dashes (Q, T, C),
// all-dash letters (M, O) that taught it a dash was a dot, and all-dot runs.
const TEXTS = ['QRP TEST DE TRAINEE', 'TEST', 'EEEE', 'MMMM', 'O SOS', 'CQ DE SPECTRA', 'H5 TEST', 'J TEST'];

describe('MorseDecoder', () => {
  it('copies clean keying exactly at every speed from 5 to 40 WPM, first letter included', () => {
    for (const wpm of [5, 8, 10, 12, 14, 16, 18, 20, 22, 25, 30, 35, 40]) {
      for (const text of TEXTS) {
        expect(decode(encodeMorse(text + '  ', wpm)).output, `${text} @ ${wpm} WPM`).toBe(text);
      }
    }
  });

  it('fits the sender speed', () => {
    for (const wpm of [6, 13, 22, 35]) {
      expect(decode(encodeMorse('CQ CQ DE W6CX K  ', wpm)).wpm).toBeCloseTo(wpm, 0);
    }
  });

  it('merges the same state arriving twice in a row into one interval', () => {
    // The worker drops sub-10 ms blips but still flips state, so a dash can
    // arrive as two consecutive marks. That is still one dash: T, not EE.
    const d = new MorseDecoder();
    for (const [on, s] of [[false, 0.5], [true, 0.09], [true, 0.09], [false, 0.42]] as const) d.push(on, s);
    // ...with E (a dot) after it to pin the speed.
    d.push(true, 0.06);
    d.push(false, 0.42);
    expect(d.output).toBe('T E');
  });

  it('heals a dot split by a dropout and ignores a blip inside a gap', () => {
    const u = 0.1; // 12 WPM
    const d = new MorseDecoder();
    // "EE TT EE" with the second E's dot split by a 20 ms dropout, and a 15 ms
    // noise blip in the middle of the word gap.
    const seq: [boolean, number][] = [
      [true, u], [false, 3 * u], [true, 0.045], [false, 0.02], [true, 0.035], [false, 3.5 * u],
      [true, 0.015], [false, 3.5 * u],
      [true, 3 * u], [false, 3 * u], [true, 3 * u], [false, 7 * u],
      [true, u], [false, 3 * u], [true, u], [false, 7 * u],
    ];
    for (const [on, s] of seq) d.push(on, s);
    expect(d.output).toBe('EE TT EE');
  });

  it('keeps its speed lock through a burst of dropouts (12 WPM regression)', () => {
    // Real timing (ms) from a degraded 12 WPM "QRP TEST DE TRAINEE". A cluster
    // of split dots near the end once pulled the fit to ~32 WPM — at that speed
    // the ~40 ms pieces pass for dots — and garbled the whole message.
    const ms =
      'M278 g98 M308 g92 M96 g100 M285 g320 M95 g101 M268 g99 M91 g317 M102 g105 M311 g100 M173 g14 M102 ' +
      'g106 M104 g287 g700 M101 g17 M152 g301 M99 g287 M93 g103 M105 g48 M14 g35 M41 g18 M47 g302 M297 ' +
      'g316 g666 M294 g114 M99 g97 M46 g21 M28 g268 M106 g294 g761 M294 g307 M98 g108 M292 g99 M102 g300 ' +
      'M96 g100 M335 g307 M109 g104 M104 g289 M325 g98 M100 g301 M38 g20 M47 g289 M47 g16 M39 g289 g665 g691';
    const d = new MorseDecoder();
    for (const tok of ms.split(' ')) d.push(tok[0] === 'M', Number(tok.slice(1)) / 1000);
    expect(d.wpm).toBeGreaterThan(10);
    expect(d.wpm).toBeLessThan(14);
    expect(lev(d.output, 'QRP TEST DE TRAINEE')).toBeLessThanOrEqual(2);
  });

  it('stays accurate under realistic timing jitter and envelope smear', () => {
    const { gauss } = rng(7);
    let errors = 0;
    let chars = 0;
    for (const wpm of [10, 15, 20, 25, 30]) {
      for (const text of ['CQ CQ DE W6CX W6CX K', 'PARIS PARIS', 'MMMM OOOO TTTT']) {
        const u = 1.2 / wpm;
        const d = new MorseDecoder();
        for (const s of encodeMorse(text + '  ', wpm)) {
          // 10% proportional jitter, plus the envelope detector's smear:
          // marks run long and gaps short by a tenth of a unit.
          const dur = s.durSec * (1 + 0.1 * gauss()) + (s.on ? 0.1 : -0.1) * u;
          d.push(s.on, Math.max(0.011, dur));
        }
        errors += lev(d.output, text);
        chars += text.length;
      }
    }
    expect(errors / chars).toBeLessThan(0.02);
  });

  it('corrects its first letters once the speed is known', () => {
    // A lone mark is ambiguous: the opening T of a 40 WPM message reads as E
    // until the rest of the message pins the speed, then it is re-read.
    const segs = encodeMorse('TEST  ', 40);
    const d = new MorseDecoder();
    d.push(segs[0].on, segs[0].durSec);
    expect(d.output).toBe('E'); // one 90 ms mark alone reads as a dot
    for (const s of segs.slice(1)) d.push(s.on, s.durSec);
    expect(d.output).toBe('TEST');
  });

  it('keeps copying correctly through a long session', () => {
    // A beacon loops for minutes in the app, so the oldest history gets frozen
    // into fixed text. 30 words is ~900 intervals, past the re-decode window.
    const words = Array.from({ length: 30 }, (_, i) => (i % 3 === 2 ? 'W6CX' : 'PARIS'));
    const d = decode(encodeMorse(words.join(' ') + '  ', 20));
    expect(d.output).toBe(words.join(' '));
  });

  it('reset clears the copy', () => {
    const d = decode(encodeMorse('CQ  ', 18));
    expect(d.output).toBe('CQ');
    d.reset();
    expect(d.output).toBe('');
  });
});
