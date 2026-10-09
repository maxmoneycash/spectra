import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest';
import { Scene } from '../sim/scene';
import { Receiver } from '../dsp/receiver';
import { Scanner, type ScanSnapshot } from '../engine/scanner';
import { SAMPLE_RATE } from '../engine/protocol';
import type { BankSetMsg, TxEvent } from '../engine/protocol';
import { setVoiceBank, clearVoiceBank, onTx } from '../sim/voicebank';
import { lessonById } from './lessons';
import { MODE_BW, DEFAULT_SQUELCH_DB } from '../store/modes';

/**
 * The scan lesson claims: a scanner steps the band, stops on a transmission
 * that breaks squelch, holds while it's active, and moves on once the channel
 * goes quiet — and everything heard is logged. lessons.test.ts checks the step
 * predicates against hand-written scanStatus values, so it cannot see whether
 * the SCANNER does any of that on this receiver. This runs the lesson's own
 * scene through scene → receiver → scanner, the way the store wires them
 * (`engine.on('meter', db => scanner.onLevel(db))`), with a fake clock
 * advanced per block so the hang-time resume is real.
 *
 * The lesson's stations are speech emitters that key voice-bank lines the
 * main thread normally supplies; in Node the bank is empty and they stay
 * silent, so a synthetic set is installed: 2.5 s voice-like bursts with the
 * emitter's own PTT gaps and rests around them.
 */
const BLOCK = 16384;
const BLOCK_MS = (BLOCK / SAMPLE_RATE) * 1000;
const MSG_RATE = 24_000;
const lesson = lessonById('scan')!;
const stations = lesson.scene.emitters.map((e) => e.freqHz);

function syntheticLine(who: string, seconds: number): BankSetMsg['lines'][number] {
  const pcm = new Float32Array(Math.round(seconds * MSG_RATE));
  for (let i = 0; i < pcm.length; i++) {
    const t = i / MSG_RATE;
    // A 420 Hz "voice" with a 3 Hz syllable swell, well inside an NFM channel.
    pcm[i] = 0.5 * Math.sin(2 * Math.PI * 420 * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 3 * t));
  }
  return { pcm, who, text: 'radio check' };
}

interface Timeline {
  snapshots: ScanSnapshot[];
  holds: number[];
  /** TxEvents that began while the scanner was holding that very channel. */
  heard: TxEvent[];
  resumedAfterHold: boolean;
}

function runLesson(seconds: number): Timeline {
  const spec = lesson.scene;
  const scene = new Scene({ sampleRate: SAMPLE_RATE, centerFreqHz: spec.centerFreqHz, noiseSigma: spec.noiseSigma });
  for (const e of spec.emitters) scene.add(e);
  const rx = new Receiver(SAMPLE_RATE);
  const mode = lesson.startMode ?? 'nfm';
  rx.setMode(mode);
  rx.setBandwidth(MODE_BW[mode]);
  rx.setSquelch(lesson.startSquelchDb ?? DEFAULT_SQUELCH_DB);

  const tl: Timeline = { snapshots: [], holds: [], heard: [], resumedAfterHold: false };
  let tunedHz = spec.centerFreqHz;
  let status: ScanSnapshot['status'] = 'idle';
  const scanner = new Scanner({
    centerHz: () => spec.centerFreqHz,
    setTuning: (off) => {
      tunedHz = spec.centerFreqHz + off;
      rx.setTuning(off);
    },
    squelchDb: () => lesson.startSquelchDb ?? DEFAULT_SQUELCH_DB,
    publish: (s) => {
      if (status === 'hold' && s.status === 'scanning') tl.resumedAfterHold = true;
      status = s.status;
      tl.snapshots.push(s);
    },
    onHold: (hz) => tl.holds.push(hz),
  });
  onTx((e) => {
    // The store logs an intercept when the receiver is on the transmission.
    if (status === 'hold' && Math.abs(tunedHz - e.freqHz) <= Math.max(1500, MODE_BW[mode] / 2)) tl.heard.push(e);
  });

  const re = new Float32Array(BLOCK);
  const im = new Float32Array(BLOCK);
  const audio = new Float32Array(4096);
  const t0 = Date.now();
  scanner.stepHz = 12_500; // what the store uses for NFM
  scanner.start(0);
  for (let b = 0, n = Math.round((seconds * SAMPLE_RATE) / BLOCK); b < n; b++) {
    vi.setSystemTime(t0 + b * BLOCK_MS);
    scene.generate(re, im, BLOCK);
    rx.process(re, im, BLOCK, audio);
    scanner.onLevel(rx.level);
  }
  onTx(null);
  return tl;
}

describe('scan lesson: the scanner does what the lesson says, on this receiver', () => {
  let tl: Timeline;

  beforeAll(() => {
    vi.useFakeTimers({ now: 1_760_000_000_000 });
    clearVoiceBank();
    const set = (courtesy: boolean): BankSetMsg => ({
      lines: [syntheticLine('K6XYZ', 2.5), syntheticLine('N0CALL', 2.5)],
      courtesy,
      continuous: false,
    });
    setVoiceBank({ 'simplex-2m': set(false), 'repeater-2m': set(true) });
    tl = runLesson(60);
  });

  afterAll(() => {
    clearVoiceBank();
    vi.useRealTimers();
  });

  it('stops on a transmission within a minute', () => {
    expect(tl.holds.length, 'never held').toBeGreaterThan(0);
  });

  it('only ever holds on a channel where a station is actually transmitting', () => {
    for (const hz of tl.holds) {
      const nearest = Math.min(...stations.map((s) => Math.abs(s - hz)));
      expect(nearest, `held on ${hz} Hz, no station within a channel step`).toBeLessThanOrEqual(12_500);
    }
  });

  it('moves on once the channel goes quiet', () => {
    expect(tl.resumedAfterHold).toBe(true);
  });

  it('hears a transmission through while holding, so the intercept log has something to stamp', () => {
    expect(tl.heard.length).toBeGreaterThan(0);
  });
});
