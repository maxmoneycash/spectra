import { SpectrumAnalyzer } from './spectrum';
import type { Track } from './detector';

/**
 * Chirp analyzer: tells a LoRa-style chirp from anything else of the same
 * width — PSK, broadcast FM, radar — by the one thing the spectrum cannot
 * show. A 7 ms spectrum frame is filled edge to edge by a 2 ms chirp, so the
 * detector sees a flat block and the classifier has only its width to go on.
 * But in 0.9 ms sub-frames the peak MOVES: up by the sweep rate each
 * sub-frame, then back by (width − step) when it leaves the band. That
 * sawtooth is the signature, and its geometry is the signal's parameters:
 * the fly-back plus the step is the sweep width (the chirp-width challenge's
 * 125 kHz, which the spectral width over-reads to ~148 kHz), and
 * width² / rate is 2^SF.
 *
 * Measured on the chirp-width scene (SF8, 125 kHz): steps +54–55 kHz per
 * 0.889 ms sub-frame, fly-backs ≈ −70 kHz, ⇒ 125 kHz, SF 8.006. Symbol
 * boundaries put a stray step in now and then (the data code jumps the
 * start frequency), which is why consistency is a fraction, not a demand.
 *
 * Reach, at 125 kHz: SF8 and slower. SF7 sweeps 87% of the band inside one
 * sub-frame, so each sub-spectrum is a smear with no peak to follow — on
 * real audio it produces no sawtooth at all (measured 2026-10-09), whatever
 * the alias rule below can do with an ideal sequence. SF11–12 fly back only
 * every 18–36 sub-frames and the ring sees too few wraps to be sure.
 */

export interface ChirpInfo {
  /** Sweep rate, Hz per second; negative for down-chirps. */
  rateHzPerS: number;
  /** Sweep width — the sawtooth's amplitude — snapped to a standard LoRa width when within 15%. */
  bwHz: number;
  /** LoRa spreading factor implied by width and rate (5–12), or null if not a standard combination. */
  sf: number | null;
  /** Fraction of sweep steps within tolerance of their median. */
  consistency: number;
}

export const SUB_N = 1024;
/** Only tracks this wide are candidates; a chirp narrower than this is not a LoRa signal. */
const MIN_TRACK_BW_HZ = 40_000;
const SNR_DB = 13;
/** Recent steps kept per track: ~3 blocks of a packet at SF8, ~1 symbol of SF12. */
const RING = 64;
const MIN_SWEEP_STEPS = 8;
const MIN_WRAPS = 2;
const MIN_CONSISTENCY = 0.6;
/** Once a reading has formed it holds down to this, so the card does not flicker between packets. */
const HOLD_CONSISTENCY = 0.4;
/** A real sweep moves at least this many bins per sub-frame (SF12 at 125 kHz moves 3). */
const MIN_STEP_BINS = 3;
const MIN_CHIRP_BW_HZ = 20_000;
const LORA_BW_HZ = [7_800, 10_400, 15_600, 20_800, 31_250, 41_700, 62_500, 125_000, 250_000, 500_000];

interface ChirpState {
  steps: number[];
  lastPeakHz: number | null;
  /** The current reading, if one has formed. */
  info: ChirpInfo | null;
  /** Blocks since the track was last on the list. */
  unseen: number;
}

/**
 * Blocks a track's state outlives its absence from the list (~2.3 s, the
 * tracker's own grace). A wide bursty emitter sheds fragment tracks that the
 * tracker's dedup keeps instead of it on some frames; dropping the ring the
 * first frame the track was missing meant a reading could never re-form.
 */
const STATE_GRACE_BLOCKS = 160;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
}

/** Nearest standard LoRa bandwidth, or null when the width is not within 15% of one. */
export function snapLoRaBw(bwHz: number): number | null {
  let best = LORA_BW_HZ[0];
  let bestErr = Infinity;
  for (const b of LORA_BW_HZ) {
    const e = Math.abs(b - bwHz) / b;
    if (e < bestErr) {
      bestErr = e;
      best = b;
    }
  }
  return bestErr <= 0.15 ? best : null;
}

/**
 * Sawtooth test on a sequence of peak-frequency steps (Hz per sub-frame).
 * Exported so tests can feed synthetic sequences. A sawtooth has two tight
 * populations: sweep steps of one sign and fly-backs of the other, each
 * consistent in magnitude. A sinusoidal FM deviation (a tone-modulated
 * station) has both signs too, but their magnitudes spread across a cosine,
 * and a drifting carrier never flies back.
 */
export function evaluateSteps(
  steps: number[],
  subSec: number,
  binHz: number,
  minConsistency = MIN_CONSISTENCY,
): ChirpInfo | null {
  if (steps.length < MIN_SWEEP_STEPS + MIN_WRAPS) return null;
  const pos = steps.filter((d) => d > 0);
  const neg = steps.filter((d) => d < 0).map((d) => -d);
  const up = pos.length >= neg.length;
  const sweep = up ? pos : neg;
  const wraps = up ? neg : pos;
  if (sweep.length < MIN_SWEEP_STEPS || wraps.length < MIN_WRAPS) return null;
  const step = median(sweep);
  if (step < MIN_STEP_BINS * binHz) return null;
  const tight = (xs: number[], mid: number) => {
    const tol = Math.max(0.2 * mid, 1.5 * binHz);
    return xs.filter((d) => Math.abs(d - mid) <= tol).length / xs.length;
  };
  const consistency = tight(sweep, step);
  if (consistency < minConsistency) return null;
  const wrap = median(wraps);
  // Fly-backs are few per window at slow sweeps (SF10 at 125 kHz: ~6 of 64
  // steps) and a symbol boundary now and then adds an opposite-sign jump, so
  // their agreement is counted, not averaged: enough fly-backs near the
  // median, not most of the opposite-sign steps. A 60% fraction of six
  // samples flickered off on one stray jump (measured 2026-10-09).
  const wrapTol = Math.max(0.2 * wrap, 1.5 * binHz);
  if (wraps.filter((d) => Math.abs(d - wrap) <= wrapTol).length < MIN_WRAPS) return null;
  const bw = wrap + step;
  if (bw < MIN_CHIRP_BW_HZ) return null;
  const std = snapLoRaBw(bw);
  const sfOf = (rateAbs: number): number | null => {
    if (!std) return null;
    const raw = Math.log2((std * std) / rateAbs);
    const r = Math.round(raw);
    return Math.abs(raw - r) <= 0.35 && r >= 5 && r <= 12 ? r : null;
  };
  let rate = (step / subSec) * (up ? 1 : -1);
  let sf = sfOf(Math.abs(rate));
  if (!up) {
    // A sweep covering more than half the band per sub-frame aliases into a
    // slower one the other way, as a wagon wheel spins backwards on film:
    // SF7 at 125 kHz steps +108 kHz but reads as −17 kHz. The width survives
    // either reading (17 + 108 = 125); only the rate is ambiguous. LoRa
    // payloads are up-chirps, so when the down reading's up-chirp alias has
    // a valid spreading factor, that is the signal. A real down-chirp keeps
    // its reading: its alias lands between integers.
    const altRate = wrap / subSec;
    const altSf = sfOf(altRate);
    if (altSf !== null) {
      rate = altRate;
      sf = altSf;
    }
  }
  return { rateHzPerS: rate, bwHz: std ?? bw, sf, consistency };
}

export class ChirpAnalyzer {
  private readonly an = new SpectrumAnalyzer(SUB_N, 'hann');
  private readonly db = new Float32Array(SUB_N);
  private readonly floorScratch = new Float32Array(SUB_N >> 2);
  private readonly state = new Map<string, ChirpState>();
  private readonly binHz: number;
  private readonly subSec: number;

  constructor(sampleRate: number) {
    this.binHz = sampleRate / SUB_N;
    this.subSec = SUB_N / sampleRate;
  }

  /** Annotate each wide track with `chirp` (or clear it) from this block's sub-frames. */
  update(re: Float32Array, im: Float32Array, len: number, tracks: Track[]): void {
    const live = new Set(tracks.map((t) => t.id));
    for (const [id, st] of this.state) {
      if (live.has(id)) {
        st.unseen = 0;
        continue;
      }
      // Keep the ring, but never compute a step across the gap.
      st.lastPeakHz = null;
      if (++st.unseen > STATE_GRACE_BLOCKS) this.state.delete(id);
    }
    const wide: Track[] = [];
    for (const t of tracks) {
      if (!t.hopping && t.bandwidthHz >= MIN_TRACK_BW_HZ) wide.push(t);
      else delete t.chirp;
    }
    if (wide.length === 0) return;
    for (let s = 0; s + SUB_N <= len; s += SUB_N) {
      this.an.compute(re, im, s, this.db);
      const floor = this.floor();
      for (const t of wide) {
        const st = this.stateFor(t.id);
        const half = t.bandwidthHz * 0.6;
        const lo = Math.max(0, Math.round((t.offsetHz - half) / this.binHz + SUB_N / 2));
        const hi = Math.min(SUB_N - 1, Math.round((t.offsetHz + half) / this.binHz + SUB_N / 2));
        let pk = -Infinity;
        let pkBin = -1;
        for (let k = lo; k <= hi; k++) {
          if (this.db[k] > pk) {
            pk = this.db[k];
            pkBin = k;
          }
        }
        if (pkBin < 0 || pk - floor < SNR_DB) {
          // A step needs two consecutive active sub-frames; isolated noise
          // peaks between packets never form one.
          st.lastPeakHz = null;
          continue;
        }
        const f = (pkBin - SUB_N / 2) * this.binHz;
        if (st.lastPeakHz !== null) {
          st.steps.push(f - st.lastPeakHz);
          if (st.steps.length > RING) st.steps.shift();
        }
        st.lastPeakHz = f;
      }
    }
    for (const t of wide) {
      const st = this.stateFor(t.id);
      // Hysteresis: a reading forms at MIN_CONSISTENCY and holds until the
      // evidence drops well below it, so the card does not flicker between
      // packets or on a symbol boundary's stray step.
      const info = evaluateSteps(st.steps, this.subSec, this.binHz, st.info ? HOLD_CONSISTENCY : MIN_CONSISTENCY);
      st.info = info;
      if (info) t.chirp = info;
      else delete t.chirp;
    }
  }

  reset(): void {
    this.state.clear();
  }

  private stateFor(id: string): ChirpState {
    let st = this.state.get(id);
    if (!st) {
      st = { steps: [], lastPeakHz: null, info: null, unseen: 0 };
      this.state.set(id, st);
    }
    return st;
  }

  /** 40th percentile of every 4th bin: the sub-frame's noise floor, cheaply. */
  private floor(): number {
    const n = this.floorScratch.length;
    for (let i = 0; i < n; i++) this.floorScratch[i] = this.db[i << 2];
    this.floorScratch.sort();
    return this.floorScratch[Math.floor(n * 0.4)];
  }
}
