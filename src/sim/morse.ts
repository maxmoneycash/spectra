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
      out.push({ on: false, durSec: unit * 7 });
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

/**
 * Streaming Morse decoder driven by keying on/off durations. Estimates the dot
 * length adaptively from the shortest recent marks so it tracks unknown WPM.
 */
export class MorseDecoder {
  private symbol = '';
  private text = '';
  private dotEst = 0.06; // seconds, adapts
  private marks: number[] = [];

  /** Feed one keyed interval. */
  push(on: boolean, durSec: number): void {
    if (on) {
      // Drop edge artifacts (ramp truncations, noise blips) that would
      // otherwise poison the dot-length estimate.
      if (durSec < this.dotEst * 0.5) return;
      this.marks.push(durSec);
      if (this.marks.length > 12) this.marks.shift();
      // 10th percentile of recent marks: hugs the true dot length — dah-heavy
      // stretches can't drag the estimate long and turn dashes into dots.
      const sorted = [...this.marks].sort((a, b) => a - b);
      const q = sorted[Math.max(0, Math.floor(sorted.length * 0.1))];
      this.dotEst = 0.7 * this.dotEst + 0.3 * q;
      this.symbol += durSec < this.dotEst * 2 ? '.' : '-';
    } else {
      if (durSec > this.dotEst * 5) {
        this.flushSymbol();
        this.text += ' ';
      } else if (durSec > this.dotEst * 2) {
        this.flushSymbol();
      }
    }
  }

  private flushSymbol(): void {
    if (!this.symbol) return;
    this.text += REVERSE_MORSE[this.symbol] ?? '¿';
    this.symbol = '';
  }

  get output(): string {
    return (this.text + (REVERSE_MORSE[this.symbol] ?? '')).trim();
  }

  reset(): void {
    this.symbol = '';
    this.text = '';
    this.marks = [];
  }
}
