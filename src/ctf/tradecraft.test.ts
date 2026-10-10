/**
 * Tradecraft missions are about when and how, not which knob. Each is proved
 * on the mechanism it depends on: the schedule gate really silences a net off
 * its window, the log really counts transmissions per station, and a synced
 * hopper really hops a fixed lead ahead of every telemetry burst.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { challengeById, toSceneSpec } from './challenges';
import { checkFlag } from './store';
import { monitor } from '../test/trafficHarness';
import { inScheduleWindow } from '../sim/messages';
import { createEmitter, type EmitterContext } from '../sim/emitters';
import { SpectrumAnalyzer } from '../dsp/spectrum';
import { SAMPLE_RATE, BLOCK_SIZE } from '../engine/protocol';

describe('inScheduleWindow', () => {
  const s = { periodMin: 5, offsetMin: 2, onSec: 45 };
  const at = (min: number, sec: number) => Date.UTC(2026, 9, 9, 12, min, sec);
  it('opens on minutes ≡ offset (mod period) for onSec, and nowhere else', () => {
    expect(inScheduleWindow(s, at(2, 0))).toBe(true);
    expect(inScheduleWindow(s, at(7, 44))).toBe(true);
    expect(inScheduleWindow(s, at(12, 45))).toBe(false);
    expect(inScheduleWindow(s, at(3, 0))).toBe(false);
    expect(inScheduleWindow(s, at(0, 10))).toBe(false);
  });
});

describe('Scheduled Net', () => {
  const c = challengeById('scheduled-net')!;
  const spec = toSceneSpec(c);
  afterEach(() => vi.useRealTimers());

  it('inside the window: net control is heard and names the flag', async () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 9, 9, 12, 2, 0) });
    const ev = monitor(spec, 446_100_000, 12_000, 40);
    const who = new Set(ev.map((e) => e.who));
    expect(who.has('KX6NET')).toBe(true);
    expect(await checkFlag(c.id, 'KX6NET')).toBe(true);
    expect(await checkFlag(c.id, 'KI6LMZ')).toBe(false);
  }, 120_000);

  it('outside the window: nothing from the net frequency at all', () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 9, 9, 12, 0, 0) });
    const ev = monitor(spec, 446_100_000, 12_000, 30);
    expect(ev.filter((e) => e.freqHz === 446_100_000)).toHaveLength(0);
  }, 120_000);
});

describe('Pattern of Life', () => {
  const c = challengeById('pattern-of-life')!;
  it('one full pass on the repeater: the most frequent station is the flag', async () => {
    const ev = monitor(toSceneSpec(c), 146_760_000, 12_000, 110);
    const counts = new Map<string, number>();
    for (const e of ev) if (e.freqHz === 146_760_000) counts.set(e.who, (counts.get(e.who) ?? 0) + 1);
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    expect(ranked.length).toBeGreaterThanOrEqual(3);
    expect(ranked[0][1]).toBeGreaterThan(ranked[1][1]); // a unique maximum
    expect(ranked[0][0]).toBe('KX6RTQ');
    expect(await checkFlag(c.id, ranked[0][0])).toBe(true);
  }, 180_000);
});

describe('Link Pair', () => {
  const c = challengeById('link-pair')!;
  const N = 4096;

  /** Per-block: PSK band power, and each hopper's dominant frequency offset. */
  function timeline(seconds: number) {
    const spec = toSceneSpec(c);
    const ctx: EmitterContext = {
      sampleRate: SAMPLE_RATE,
      centerFreqHz: spec.centerFreqHz,
      scratchRe: new Float32Array(BLOCK_SIZE),
      scratchIm: new Float32Array(BLOCK_SIZE),
    };
    const ems = spec.emitters.map((cfg) => ({ id: cfg.id, em: createEmitter(cfg, SAMPLE_RATE) }));
    const an = new SpectrumAnalyzer(N);
    const db = new Float32Array(N);
    const blocks = Math.round((seconds * SAMPLE_RATE) / BLOCK_SIZE);
    const out: Record<string, number[]> = { tlm: [], ctl: [], oth: [] };
    for (let b = 0; b < blocks; b++) {
      for (const { id, em } of ems) {
        const re = new Float32Array(BLOCK_SIZE);
        const im = new Float32Array(BLOCK_SIZE);
        em.render(re, im, BLOCK_SIZE, ctx);
        if (id === 'tlm') {
          let p = 0;
          for (let i = 0; i < BLOCK_SIZE; i++) p += re[i] * re[i] + im[i] * im[i];
          out.tlm.push(p / BLOCK_SIZE);
        } else {
          an.compute(re, im, 0, db);
          let best = 0;
          for (let k = 1; k < N; k++) if (db[k] > db[best]) best = k;
          out[id].push(((best - N / 2) * SAMPLE_RATE) / N);
        }
      }
    }
    return out;
  }

  const onsets = (power: number[]) => {
    const thr = Math.max(...power) * 0.25;
    const r: number[] = [];
    for (let i = 1; i < power.length; i++) if (power[i] > thr && power[i - 1] <= thr) r.push(i);
    return r;
  };
  const hopChanges = (f: number[]) => {
    const r: number[] = [];
    for (let i = 1; i < f.length; i++) if (Math.abs(f[i] - f[i - 1]) > 5_000) r.push(i);
    return r;
  };
  /** Blocks from the last hop before each burst to the burst. */
  const leadBlocks = (hops: number[], bursts: number[]) =>
    bursts.map((b) => {
      const prior = hops.filter((h) => h <= b);
      return prior.length ? b - prior[prior.length - 1] : NaN;
    });
  const std = (xs: number[]) => {
    const v = xs.filter(Number.isFinite);
    const m = v.reduce((a, x) => a + x, 0) / v.length;
    return Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / v.length);
  };

  it('the telemetry bursts once a second; the control link hops a fixed 50 ms ahead; the other does not', async () => {
    const t = timeline(6);
    const bursts = onsets(t.tlm);
    const blockMs = (BLOCK_SIZE / SAMPLE_RATE) * 1000; // ≈ 14.2 ms
    expect(bursts.length).toBeGreaterThanOrEqual(5);
    const gaps = bursts.slice(1).map((b, i) => (b - bursts[i]) * blockMs);
    for (const g of gaps) expect(Math.abs(g - 1000)).toBeLessThan(2 * blockMs);

    const ctlLead = leadBlocks(hopChanges(t.ctl), bursts);
    const othLead = leadBlocks(hopChanges(t.oth), bursts);
    // Synced: every burst is preceded by a hop ~50 ms earlier, with no jitter.
    // Both edges are seen at block resolution (14 ms) and a burst's first block
    // can fall under the onset threshold, so allow 2.5 blocks of quantisation;
    // the constancy check below is the real signature.
    for (const l of ctlLead) expect(Math.abs(l * blockMs - 50)).toBeLessThan(2.5 * blockMs);
    expect(std(ctlLead)).toBeLessThan(0.6);
    // Free-running: a 45 ms dwell means a hop lands somewhere before each burst, but never at one fixed lead.
    expect(std(othLead) > 0.6 || Math.abs(ctlLead[0] - othLead[0]) > 1).toBe(true);

    expect(await checkFlag(c.id, '2439.700')).toBe(true);
    expect(await checkFlag(c.id, '2440.550')).toBe(false);
  }, 120_000);
});
