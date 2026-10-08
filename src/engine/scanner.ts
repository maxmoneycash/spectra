/**
 * Squelch scanner, the way a handheld scanner works: step across the band on
 * a channel raster, sample each channel's level, stop when a transmission
 * breaks squelch, hold while it's active, resume after a hang time.
 *
 * Driven by the receiver's per-block level readings (~70 Hz), so it needs no
 * timer of its own: each block either settles a fresh retune, samples a
 * channel, or watches a held one. The receiver resets its level smoothing on
 * a channel change, so two blocks per channel is enough (~35 channels/s).
 *
 * The threshold is learned: the median of recent readings on idle channels is
 * the noise floor, and a hit has to clear it by a margin — or the operator's
 * own squelch setting, if that's set higher.
 */
import { SAMPLE_RATE } from './protocol';

export type ScanStatus = 'idle' | 'scanning' | 'hold';

export interface ScanHit {
  id: string;
  at: number;
  /** Absolute channel frequency, Hz. */
  freqHz: number;
  peakDb: number;
  /** How many separate times this channel has come up. */
  count: number;
}

export interface ScanSnapshot {
  status: ScanStatus;
  stepHz: number;
  /** Absolute frequency being sampled or held. */
  freqHz: number;
  loHz: number;
  hiHz: number;
  levelDb: number;
  thresholdDb: number;
  hits: ScanHit[];
  lockouts: number[];
}

export interface ScannerIO {
  centerHz(): number;
  setTuning(offsetHz: number): void;
  squelchDb(): number;
  publish(s: ScanSnapshot): void;
  /** A new hold began on freqHz. */
  onHold?(freqHz: number): void;
}

const MARGIN_DB = 9;
const HANG_MS = 2200;
const EDGE_HZ = 14_000;

export class Scanner {
  private status: ScanStatus = 'idle';
  stepHz = 12_500;
  private chan = 0; // channel index on the raster
  private settle = 0;
  private confirm = 0;
  private lastAbove = 0;
  private level = -140;
  private noise: number[] = [];
  private hits: ScanHit[] = [];
  private lockouts = new Set<number>();
  private holdPeak = -140;

  constructor(private readonly io: ScannerIO) {}

  get active(): boolean {
    return this.status !== 'idle';
  }

  private range() {
    const c = this.io.centerHz();
    const lo = Math.ceil((c - SAMPLE_RATE / 2 + EDGE_HZ) / this.stepHz);
    const hi = Math.floor((c + SAMPLE_RATE / 2 - EDGE_HZ) / this.stepHz);
    return { lo, hi };
  }

  private threshold(): number {
    if (this.noise.length < 6) return Math.max(this.io.squelchDb(), -200);
    const sorted = [...this.noise].sort((a, b) => a - b);
    const floor = sorted[Math.floor(sorted.length / 2)];
    return Math.max(floor + MARGIN_DB, this.io.squelchDb());
  }

  private tuneTo(chan: number) {
    this.chan = chan;
    this.io.setTuning(chan * this.stepHz - this.io.centerHz());
    this.settle = 2;
    this.confirm = 0;
  }

  private advance(dir = 1) {
    const { lo, hi } = this.range();
    if (hi < lo) return;
    let c = this.chan;
    for (let guard = 0; guard <= hi - lo + 1; guard++) {
      c += dir;
      if (c > hi) c = lo;
      if (c < lo) c = hi;
      if (!this.lockouts.has(c)) break;
    }
    this.tuneTo(c);
  }

  start(fromOffsetHz: number): void {
    const { lo, hi } = this.range();
    const here = Math.round((this.io.centerHz() + fromOffsetHz) / this.stepHz);
    this.chan = Math.min(hi, Math.max(lo, here));
    this.status = 'scanning';
    this.advance(1);
    this.emit();
  }

  stop(): void {
    this.status = 'idle';
    this.emit();
  }

  setStep(hz: number): void {
    const freq = this.chan * this.stepHz;
    this.stepHz = hz;
    this.chan = Math.round(freq / hz);
    this.lockouts.clear();
    this.noise = [];
    if (this.status !== 'idle') this.tuneTo(this.chan);
    this.emit();
  }

  /** Skip the held channel from now on and keep scanning. */
  lockout(): void {
    this.lockouts.add(this.chan);
    if (this.status === 'hold') {
      this.status = 'scanning';
      this.advance(1);
    }
    this.emit();
  }

  clearLockouts(): void {
    this.lockouts.clear();
    this.emit();
  }

  /** Skip past a held signal without locking it out. */
  next(): void {
    if (this.status === 'idle') return;
    this.status = 'scanning';
    this.advance(1);
    this.emit();
  }

  /** Band changed (new mission): forget learned noise and hits. */
  reset(): void {
    this.status = 'idle';
    this.noise = [];
    this.hits = [];
    this.lockouts.clear();
    this.emit();
  }

  /** One receiver block's channel level. */
  onLevel(db: number): void {
    this.level = db;
    if (this.status === 'idle') return;
    if (this.settle > 0) {
      this.settle--;
      return;
    }
    const thr = this.threshold();
    const now = Date.now();

    if (this.status === 'scanning') {
      if (db > thr) {
        // Two consecutive readings, so one noise spike can't stop the sweep.
        if (++this.confirm >= 2) {
          this.status = 'hold';
          this.lastAbove = now;
          this.holdPeak = db;
          this.recordHit(db);
          this.io.onHold?.(this.chan * this.stepHz);
          this.emit();
        }
        return;
      }
      this.noise.push(db);
      if (this.noise.length > 48) this.noise.shift();
      this.advance(1);
      // Publishing every step would re-render 35×/s; the sweep bar animates
      // between snapshots, so a few per second is plenty.
      if (this.chan % 3 === 0) this.emit();
      return;
    }

    // hold
    if (db > thr - 3) {
      this.lastAbove = now;
      if (db > this.holdPeak) this.holdPeak = db;
    } else if (now - this.lastAbove > HANG_MS) {
      this.status = 'scanning';
      this.advance(1);
      this.emit();
    }
  }

  private recordHit(db: number) {
    const freqHz = this.chan * this.stepHz;
    const existing = this.hits.find((h) => h.freqHz === freqHz);
    if (existing) {
      existing.count++;
      existing.at = Date.now();
      existing.peakDb = Math.max(existing.peakDb, db);
      this.hits = [existing, ...this.hits.filter((h) => h !== existing)];
    } else {
      this.hits = [{ id: `${freqHz}-${Date.now()}`, at: Date.now(), freqHz, peakDb: db, count: 1 }, ...this.hits].slice(0, 60);
    }
  }

  private emit() {
    const { lo, hi } = this.range();
    this.io.publish({
      status: this.status,
      stepHz: this.stepHz,
      freqHz: this.chan * this.stepHz,
      loHz: lo * this.stepHz,
      hiHz: hi * this.stepHz,
      levelDb: this.level,
      thresholdDb: this.threshold(),
      hits: this.hits,
      lockouts: [...this.lockouts].map((c) => c * this.stepHz),
    });
  }
}
