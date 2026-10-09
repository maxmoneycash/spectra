import { Scene } from '../sim/scene';
import { Receiver } from '../dsp/receiver';
import { MorseDecoder } from '../sim/morse';
import { CwKeyer } from '../dsp/cwKeyer';
import { MODE_BW, DEFAULT_SQUELCH_DB } from '../store/modes';
import type { SceneSpec } from '../engine/protocol';
import type { DemodMode } from '../sim/signal-kinds';

/**
 * The worker's CW chain — scene → receiver → keyer → decoder — as one call, so
 * a test can ask "does this flag/lesson actually copy on this receiver?"
 *
 * Why tests run the DSP: three CTF challenges and two lessons shipped with a
 * premise the receiver did not impose (unsolvable, or solvable with no
 * operating at all), and every test passed, because the tests ran
 * encode → decode or fed decoded text straight into step checks. Anything
 * that claims the receiver behaves a certain way gets pinned through here.
 */

export const SR = 1_152_000;
export const BLOCK = 16384;

export interface CopyOpts {
  spec: SceneSpec;
  /** Absolute VFO frequency, Hz. */
  tuneHz: number;
  /** Default: CW, the mode the decoder runs in. */
  mode?: DemodMode;
  /** Default: the mode's stock filter width. */
  bw?: number;
  /** Default: wide open. */
  squelchDb?: number;
  /** Seconds of simulated air. CW at 15 wpm needs ~0.8 s per character. */
  sec: number;
}

export interface CopyResult {
  /** The decoder's output, letters, digits and single spaces only. */
  text: string;
  /** Peak gated channel level once settled: what a closed squelch must stay above. */
  maxLevel: number;
  medianLevel: number;
}

export const cleanMorse = (s: string) =>
  s
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export function copyCw(o: CopyOpts): CopyResult {
  const mode = o.mode ?? 'cw';
  const scene = new Scene({
    sampleRate: SR,
    centerFreqHz: o.spec.centerFreqHz,
    noiseSigma: o.spec.noiseSigma,
  });
  for (const e of o.spec.emitters) scene.add(e);
  const rx = new Receiver(SR);
  rx.setMode(mode);
  rx.setBandwidth(o.bw ?? MODE_BW[mode]);
  rx.setTuning(o.tuneHz - o.spec.centerFreqHz);
  rx.setSquelch(o.squelchDb ?? DEFAULT_SQUELCH_DB);
  const re = new Float32Array(BLOCK);
  const im = new Float32Array(BLOCK);
  const audio = new Float32Array(4096);
  const dec = new MorseDecoder();
  const keyer = new CwKeyer((on, d) => dec.push(on, d));
  const levels: number[] = [];
  const n = Math.round((o.sec * SR) / BLOCK);
  for (let b = 0; b < n; b++) {
    scene.generate(re, im, BLOCK);
    keyer.process(audio, rx.process(re, im, BLOCK, audio));
    if (b > n / 4) levels.push(rx.level); // past the level filter's settle
  }
  levels.sort((a, b) => a - b);
  return {
    text: cleanMorse(dec.output),
    maxLevel: levels[levels.length - 1] ?? NaN,
    medianLevel: levels[levels.length >> 1] ?? NaN,
  };
}

/** Absolute frequency of the scene's flag beacon: its first CW emitter with text. */
export function cwBeaconHz(spec: SceneSpec): number {
  const e = spec.emitters.find((x) => x.kind === 'cw' && x.text);
  if (!e) throw new Error('scene has no keyed CW beacon');
  return e.freqHz;
}
