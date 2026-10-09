import { describe, it, expect } from 'vitest';
import { lessonById, type GuideCtx } from './lessons';
import { MODE_BW, DEFAULT_SQUELCH_DB } from '../store/modes';
import { copyCw } from '../test/cwHarness';

/**
 * The filter lesson claims: at the stock 500 Hz filter the two stations
 * interleave into garbage; narrow the filter and centre one and the copy
 * turns clean. lessons.test.ts feeds decoded text straight into the step
 * checks, so it cannot see whether the RECEIVER makes that true. It did not:
 * at the original 450 Hz spacing a student who dialled exactly 7.030 as step
 * 1 instructed got a clean copy at the stock filter (the keyer rejected the
 * neighbour by pitch) and step 2's explanation contradicted the screen.
 */
const lesson = lessonById('filter')!;
const [p1, p2] = lesson.scene.emitters; // lower station (the one to copy), upper station
const mid = (p1.freqHz + p2.freqHz) / 2;

const copy = (tuneHz: number, bw: number) =>
  copyCw({ spec: lesson.scene, tuneHz, bw, squelchDb: lesson.startSquelchDb, sec: 22 }).text;

const ctxAt = (tunedHz: number): GuideCtx => ({
  running: true,
  tunedHz,
  mode: 'cw',
  bandwidthHz: MODE_BW.cw,
  squelchDb: DEFAULT_SQUELCH_DB,
  morseText: '',
  deckPage: 'mode',
  panel: 'signals',
  scanStatus: 'idle',
  selectedId: null,
  identified: [],
  newIntercepts: 0,
});

describe('filter lesson: the premise holds for a student who did as told', () => {
  it('garbles the copy at the stock filter anywhere within the pair', () => {
    for (const hz of [p1.freqHz, mid, p2.freqHz]) {
      expect(copy(hz, MODE_BW.cw), `clean copy at ${hz} Hz`).not.toContain('PRACTICE COPY');
    }
  });

  it('stays garbled after narrowing until the student centres', () => {
    expect(copy(mid, 200)).not.toContain('PRACTICE COPY');
  });

  it('copies clean once narrowed and centred, at both widths step 3 accepts', () => {
    expect(copy(p1.freqHz, 200)).toContain('PRACTICE COPY');
    expect(copy(p1.freqHz, 250)).toContain('PRACTICE COPY');
  });

  it('step 1 accepts anywhere in the pair and rejects just below it', () => {
    const check = lesson.steps[0].check!;
    expect(check(ctxAt(p1.freqHz))).toBe(true);
    expect(check(ctxAt(mid))).toBe(true);
    expect(check(ctxAt(p2.freqHz))).toBe(true);
    expect(check(ctxAt(p1.freqHz - 150))).toBe(false);
    // The physics behind that rejection: 25 Hz below the lower station the
    // stock filter already copies it clean, so step 2 would be false there.
    expect(copy(p1.freqHz - 25, MODE_BW.cw)).toContain('PRACTICE COPY');
  });
});
