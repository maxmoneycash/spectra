import { describe, it, expect } from 'vitest';
import { Scene } from '../sim/scene';
import { Receiver } from '../dsp/receiver';
import { MorseDecoder } from '../sim/morse';
import { CwKeyer } from '../dsp/cwKeyer';
import { CHALLENGES, challengeById, toSceneSpec } from './challenges';
import { checkFlag } from './store';
import { lessonById } from '../guide/lessons';
import { CLOSED_SQUELCH_DB, DEFAULT_SQUELCH_DB } from '../store/modes';
import type { SceneSpec } from '../engine/protocol';

const SR = 1_152_000;
const BLOCK = 16384;

/**
 * Why this test runs the DSP: the encode → decode test in ctf.test.ts proves
 * the Morse table can produce each flag, and the lesson test feeds decoded
 * text straight into the step checks. Neither can see the RECEIVER. Split the
 * Pair shipped unsolvable (narrowing the filter was a no-op in the DSP) and
 * Below the Gate shipped trivially solvable (its beacon peaks at -26 dB of
 * gated channel level, 54 dB above the -80 dB gate every challenge opened at)
 * — and both passed every test. This file runs the worker's actual chain:
 * scene → receiver → keyer → decoder.
 */
function copy(spec: SceneSpec, tuneHz: number, squelchDb: number, sec: number) {
  const scene = new Scene({ sampleRate: SR, centerFreqHz: spec.centerFreqHz, noiseSigma: spec.noiseSigma });
  for (const e of spec.emitters) scene.add(e);
  const rx = new Receiver(SR);
  rx.setMode('cw');
  rx.setBandwidth(500);
  rx.setTuning(tuneHz);
  rx.setSquelch(squelchDb);
  const re = new Float32Array(BLOCK);
  const im = new Float32Array(BLOCK);
  const audio = new Float32Array(4096);
  const dec = new MorseDecoder();
  const keyer = new CwKeyer((on, d) => dec.push(on, d));
  const levels: number[] = [];
  const n = Math.round((sec * SR) / BLOCK);
  for (let b = 0; b < n; b++) {
    scene.generate(re, im, BLOCK);
    keyer.process(audio, rx.process(re, im, BLOCK, audio));
    if (b > n / 4) levels.push(rx.level); // past the level filter's settle
  }
  levels.sort((a, b) => a - b);
  return {
    text: dec.output.replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim(),
    /** Peak gated channel level during keying: what a closed squelch must stay above. */
    maxLevel: levels[levels.length - 1],
    medianLevel: levels[levels.length >> 1],
  };
}

/** Does any short run of decoded words validate against the stored flag? */
async function solves(id: string, text: string): Promise<boolean> {
  const words = text.split(' ').filter(Boolean);
  for (let i = 0; i < words.length; i++)
    for (let j = i + 1; j <= Math.min(words.length, i + 4); j++)
      if (await checkFlag(id, words.slice(i, j).join(' '))) return true;
  return false;
}

/** VFO offset that lands on the scene's flag beacon. */
const cwOffset = (spec: SceneSpec) => {
  const e = spec.emitters.find((x) => x.kind === 'cw' && x.text)!;
  return e.freqHz - spec.centerFreqHz;
};

describe('Below the Gate: the gate really sits above the beacon', () => {
  const c = challengeById('squelch-down')!;
  const spec = toSceneSpec(c);
  const tune = cwOffset(spec);

  it('opens with a declared squelch, and at it the decoder prints nothing', async () => {
    expect(c.startSquelchDb).toBe(CLOSED_SQUELCH_DB);
    const r = copy(spec, tune, c.startSquelchDb!, 20);
    expect(r.maxLevel, 'beacon peaks above the gate, so the squelch would open on its own').toBeLessThan(
      c.startSquelchDb!,
    );
    expect(r.text).toBe('');
    expect(await solves(c.id, r.text)).toBe(false);
  });

  it('copies once the squelch is opened', async () => {
    const r = copy(spec, tune, DEFAULT_SQUELCH_DB, 26);
    expect(await solves(c.id, r.text), r.text).toBe(true);
  });
});

describe('the squelch lesson starts silent for the same reason', () => {
  const l = lessonById('squelch')!;
  const tune = cwOffset(l.scene);

  it('declares the raised gate and prints nothing at it', () => {
    expect(l.startSquelchDb).toBe(CLOSED_SQUELCH_DB);
    const r = copy(l.scene, tune, l.startSquelchDb!, 20);
    expect(r.maxLevel).toBeLessThan(l.startSquelchDb!);
    expect(r.text).toBe('');
  });

  it('copies the beacon once the student lowers it', () => {
    const r = copy(l.scene, tune, DEFAULT_SQUELCH_DB, 24);
    expect(r.text).toContain('TRAINEE');
  });
});

describe('every other CW challenge opens with the gate well below its beacon', () => {
  const others = CHALLENGES.filter(
    (x) => x.id !== 'squelch-down' && x.emitters.some((e) => e.kind === 'cw' && e.text),
  );
  for (const c of others) {
    it(c.id, () => {
      const spec = toSceneSpec(c);
      const start = c.startSquelchDb ?? DEFAULT_SQUELCH_DB;
      const r = copy(spec, cwOffset(spec), start, 5);
      // 10 dB of margin: a beacon this close to the gate would stutter.
      expect(start, `gate at ${start} dB vs beacon median ${r.medianLevel.toFixed(1)} dB`).toBeLessThan(
        r.medianLevel - 10,
      );
    });
  }
});
