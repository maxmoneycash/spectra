/** Morse code alphabet and timing. */
export const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.',
  H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.',
  O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-',
  V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '/': '-..-.', '=': '-...-',
  '-': '-....-', ':': '---...', "'": '.----.', '@': '.--.-.',
};

const REVERSE_MORSE: Record<string, string> = Object.fromEntries(
  Object.entries(MORSE).map(([k, v]) => [v, k]),
);

export interface KeySegment {
  on: boolean;
  durSec: number;
}

/**
 * Encode text into an on/off keying schedule at the given words-per-minute.
 * Uses standard timing: dot=1u, dash=3u, intra-char gap=1u, char gap=3u,
 * word gap=7u, where u = 1.2 / wpm seconds.
 */
export function encodeMorse(text: string, wpm: number): KeySegment[] {
  const unit = 1.2 / wpm;
  const out: KeySegment[] = [];
  const upper = text.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    const ch = upper[i];
    if (ch === ' ') {
      // A word space is 7 units in all, counting the 3-unit gap that already
      // closed the previous letter. Each further space adds another 7.
      const last = out[out.length - 1];
      if (last && !last.on && last.durSec < unit * 7 - 1e-9) last.durSec = unit * 7;
      else out.push({ on: false, durSec: unit * 7 });
      continue;
    }
    const code = MORSE[ch];
    if (!code) continue;
    for (let j = 0; j < code.length; j++) {
      out.push({ on: true, durSec: code[j] === '.' ? unit : unit * 3 });
      out.push({ on: false, durSec: unit }); // intra-char gap
    }
    // Upgrade trailing intra-char gap to a full char gap (3u total).
    if (out.length > 0) out[out.length - 1].durSec = unit * 3;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Decoder

/** Legal lengths in dot units: a mark is a dot or a dash; a gap separates
 *  elements (1), letters (3) or words (7). */
const MARK_UNITS = [1, 3];
const GAP_UNITS = [1, 3, 7];
/** An interval more than 60% off every legal length is an outlier — a noise
 *  blip, an NCDXF one-second dah, the silence between transmissions. Capping
 *  its cost keeps it from dragging the speed fit. */
const OUTLIER_COST = Math.log(1.6) ** 2;
/** How strongly the fit prefers its previous estimate. It only settles genuine
 *  ties, such as "TTT", which reads equally well as dashes at one speed or as
 *  dots at a third of it. */
const PRIOR_WEIGHT = 0.05;
/** Plausible dot lengths: about 100 WPM down to 4 WPM. */
const UNIT_MIN = 0.012;
const UNIT_MAX = 0.3;
/** Recent intervals used to fit the speed. */
const FIT_WINDOW = 48;
/** Intervals kept for re-decoding before the oldest words are frozen. */
const HISTORY_MAX = 600;

interface Interval {
  on: boolean;
  d: number;
}

const legal = (on: boolean) => (on ? MARK_UNITS : GAP_UNITS);

/** Squared log error to the nearest legal length, capped for outliers. */
function intervalCost(x: Interval, unit: number): number {
  let best = OUTLIER_COST;
  for (const k of legal(x.on)) {
    const e = Math.log(x.d / (k * unit));
    if (e * e < best) best = e * e;
  }
  return best;
}

/**
 * Best-fit dot length for the recent intervals. Every multi-element letter
 * contains one-unit gaps, so even all-dash text (M, O, the start of Q) pins
 * the speed — fitting marks alone mistakes those dashes for dots.
 *
 * Each candidate speed is judged on the timing as healed at that speed. That
 * is what separates the true speed from a false one: a dot split by a dropout
 * sums back to one unit at the true speed, while at a speed ~2.6x too fast its
 * two pieces each pass for dots and the real dots for dashes.
 */
function fitUnit(iv: readonly Interval[], prior: number): number {
  const win = iv.slice(Math.max(0, iv.length - FIT_WINDOW));
  const cost = (unit: number) => {
    const { out, heals } = heal(win, unit);
    let c = PRIOR_WEIGHT * Math.log(unit / prior) ** 2 + heals * HEAL_COST;
    for (const x of out) c += intervalCost(x, unit);
    return c;
  };
  let best = prior;
  let bestCost = cost(prior);
  for (const x of win) {
    for (const k of legal(x.on)) {
      const unit = x.d / k;
      if (unit < UNIT_MIN || unit > UNIT_MAX) continue;
      const c = cost(unit);
      if (c < bestCost) {
        bestCost = c;
        best = unit;
      }
    }
  }
  // Polish: average the healed inliers in log space under the winning fit.
  // Word gaps sit out — operators space words loosely, and Farnsworth sending
  // stretches them on purpose — so dots, dashes and in-letter gaps set the speed.
  for (let pass = 0; pass < 2; pass++) {
    let sum = 0;
    let n = 0;
    for (const x of heal(win, best).out) {
      let bestK = 0;
      let bestErr = OUTLIER_COST;
      for (const k of legal(x.on)) {
        const e = Math.log(x.d / (k * best));
        if (e * e < bestErr) {
          bestErr = e * e;
          bestK = k;
        }
      }
      if (bestK && bestK < 7) {
        sum += Math.log(x.d / bestK);
        n++;
      }
    }
    if (n === 0) break;
    const refined = Math.exp(sum / n);
    if (refined < UNIT_MIN || refined > UNIT_MAX) break;
    best = refined;
  }
  return best;
}

/** Shorter than this fraction of a unit is a glitch, not a dot or a gap. */
const GLITCH = 0.45;
/** Healing a glitch costs what one outlier does: it turns three intervals (two
 *  pieces and the glitch) into one, so it pays only when they really were one.
 *  Cheaper and a wrong slow speed can heal away the gaps inside letters;
 *  measured, this value is also where decoding errors bottom out. */
const HEAL_COST = OUTLIER_COST;

/**
 * Heal keying glitches: a sliver of silence inside a dash, or a noise blip
 * inside a gap. Shortest first, each glitch merges with both neighbours — so a
 * dot split in two by a dropout comes back whole instead of folding into the
 * silence on either side.
 */
function heal(iv: readonly Interval[], unit: number): { out: Interval[]; heals: number } {
  const out: Interval[] = [];
  for (const x of iv) {
    const prev = out[out.length - 1];
    if (prev && prev.on === x.on) prev.d += x.d;
    else out.push({ on: x.on, d: x.d });
  }
  const limit = GLITCH * unit;
  let heals = 0;
  for (;;) {
    let k = -1;
    for (let i = 1; i < out.length - 1; i++) {
      if (out[i].d < limit && (k < 0 || out[i].d < out[k].d)) k = i;
    }
    if (k < 0) return { out, heals };
    out[k - 1].d += out[k].d + out[k + 1].d;
    out.splice(k, 2);
    heals++;
  }
}

function decodeIntervals(iv: readonly Interval[], unit: number): string {
  let text = '';
  let symbol = '';
  const flush = () => {
    if (symbol) text += REVERSE_MORSE[symbol] ?? '¿';
    symbol = '';
  };
  for (const x of heal(iv, unit).out) {
    if (x.on) {
      if (x.d >= GLITCH * unit) symbol += x.d < 2 * unit ? '.' : '-';
    } else if (x.d > 5 * unit) {
      flush();
      text += ' ';
    } else if (x.d > 2 * unit) {
      flush();
    }
  }
  // A letter still being keyed shows only once it reads as a real character.
  return text + (REVERSE_MORSE[symbol] ?? '');
}

/**
 * Streaming Morse decoder driven by keying on/off durations. It fits the
 * sender's speed from every recent mark and gap, then re-reads the recent
 * history at that speed — so the first letters, keyed before the speed was
 * known, correct themselves once it is.
 */
export class MorseDecoder {
  private intervals: Interval[] = [];
  private committed = '';
  /** Dot length in seconds. Starts at 20 WPM, then follows the fit. */
  private unit = 1.2 / 20;
  private cached: string | null = null;

  /** Feed one keyed interval. */
  push(on: boolean, durSec: number): void {
    if (!(durSec > 0)) return;
    // The worker drops sub-10 ms blips but still flips state, so the same
    // state can arrive twice in a row: that is one longer interval.
    const last = this.intervals[this.intervals.length - 1];
    if (last && last.on === on) last.d += durSec;
    else this.intervals.push({ on, d: durSec });
    this.unit = fitUnit(this.intervals, this.unit);
    this.cached = null;
    if (this.intervals.length > HISTORY_MAX) this.freezeOldest();
  }

  get output(): string {
    if (this.cached === null) {
      this.cached = (this.committed + decodeIntervals(this.intervals, this.unit))
        .replace(/\s+/g, ' ')
        .trim();
    }
    return this.cached;
  }

  /** The sender's speed as currently fitted, in words per minute. */
  get wpm(): number {
    return 1.2 / this.unit;
  }

  reset(): void {
    this.intervals = [];
    this.committed = '';
    this.cached = null;
  }

  /** Freeze the oldest half of the history at a word (or letter) boundary, so
   *  re-decoding stays cheap and no letter is split. */
  private freezeOldest(): void {
    const half = this.intervals.length >> 1;
    let cut = -1;
    for (const minGap of [5, 2]) {
      for (let i = half; i > 0 && cut < 0; i--) {
        const x = this.intervals[i];
        if (!x.on && x.d > minGap * this.unit) cut = i;
      }
      if (cut >= 0) break;
    }
    if (cut < 0) cut = half;
    this.committed += decodeIntervals(this.intervals.slice(0, cut + 1), this.unit);
    this.intervals = this.intervals.slice(cut + 1);
  }
}
