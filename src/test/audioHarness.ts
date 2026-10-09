import { Scene } from '../sim/scene';
import { Receiver } from '../dsp/receiver';
import { MODE_BW, DEFAULT_SQUELCH_DB } from '../store/modes';
import { setVoiceBank, clearVoiceBank } from '../sim/voicebank';
import { SR, BLOCK } from './cwHarness';
import type { BankSetMsg, SceneSpec } from '../engine/protocol';
import type { DemodMode } from '../sim/signal-kinds';

/**
 * The worker's audio chain — scene → receiver — as one call that returns the
 * demodulated audio, so a test can ask "what does this station SOUND like in
 * this mode?" The CW chain (cwHarness) answers that for keyed carriers; this
 * answers it for voice, which the modes lesson is built on.
 */

export const AUDIO_RATE = 48_000;

export interface DemodOpts {
  spec: SceneSpec;
  /** Absolute VFO frequency, Hz. */
  tuneHz: number;
  mode: DemodMode;
  /** Default: the mode's stock filter width. */
  bw?: number;
  /** Default: wide open. */
  squelchDb?: number;
  /** Seconds of simulated air. */
  sec: number;
  /** Voice sets for `speech:` emitters, which are silent in Node without one. */
  bank?: Record<string, BankSetMsg>;
}

export function demodAudio(o: DemodOpts): Float32Array {
  if (o.bank) {
    clearVoiceBank();
    setVoiceBank(o.bank);
  }
  const scene = new Scene({
    sampleRate: SR,
    centerFreqHz: o.spec.centerFreqHz,
    noiseSigma: o.spec.noiseSigma,
  });
  for (const e of o.spec.emitters) scene.add(e);
  const rx = new Receiver(SR);
  rx.setMode(o.mode);
  rx.setBandwidth(o.bw ?? MODE_BW[o.mode]);
  rx.setTuning(o.tuneHz - o.spec.centerFreqHz);
  rx.setSquelch(o.squelchDb ?? DEFAULT_SQUELCH_DB);
  const re = new Float32Array(BLOCK);
  const im = new Float32Array(BLOCK);
  const audio = new Float32Array(4096);
  const out = new Float32Array(Math.ceil(o.sec * AUDIO_RATE) + audio.length);
  let w = 0;
  const n = Math.round((o.sec * SR) / BLOCK);
  for (let b = 0; b < n; b++) {
    scene.generate(re, im, BLOCK);
    const c = rx.process(re, im, BLOCK, audio);
    if (w + c > out.length) break;
    out.set(audio.subarray(0, c), w);
    w += c;
  }
  if (o.bank) clearVoiceBank();
  return out.subarray(0, w);
}

/**
 * Syllable-rate envelope: mean absolute value per 20 ms hop (a rectifier and
 * box smoother in one), sampled at `rate` Hz. Speech is recognisable in this
 * envelope whatever the receiver's filtering and delay did to the waveform.
 */
export function envelope(x: Float32Array, sampleRate: number, rate = 50): Float32Array {
  const hop = Math.round(sampleRate / rate);
  const n = Math.floor(x.length / hop);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    const end = (i + 1) * hop;
    for (let k = i * hop; k < end; k++) s += Math.abs(x[k]);
    env[i] = s / hop;
  }
  return env;
}

/**
 * Peak normalised cross-correlation of a short reference slid across a long
 * signal: 1 means the reference appears somewhere in the signal exactly (up
 * to gain and offset), ~0 means it never does. Both are envelopes at the same
 * rate.
 */
export function peakNcc(long: Float32Array, short: Float32Array): number {
  const m = short.length;
  if (m === 0 || long.length < m) return 0;
  let sMean = 0;
  for (let i = 0; i < m; i++) sMean += short[i];
  sMean /= m;
  const s = new Float32Array(m);
  let ss = 0;
  for (let i = 0; i < m; i++) {
    s[i] = short[i] - sMean;
    ss += s[i] * s[i];
  }
  const sNorm = Math.sqrt(ss) || 1;
  let best = 0;
  for (let lag = 0; lag + m <= long.length; lag++) {
    let lMean = 0;
    for (let i = 0; i < m; i++) lMean += long[lag + i];
    lMean /= m;
    let dot = 0;
    let ll = 0;
    for (let i = 0; i < m; i++) {
      const l = long[lag + i] - lMean;
      dot += l * s[i];
      ll += l * l;
    }
    const ncc = dot / ((Math.sqrt(ll) || 1) * sNorm);
    if (ncc > best) best = ncc;
  }
  return best;
}

/**
 * Remove the slow component of an envelope (a 1 s moving average at 50 Hz), so
 * that 2–8 Hz syllables remain and a push-to-talk station's on/off step does
 * not. Without this, a mismatched demodulator's loud-noise → quiet → loud box
 * around each line scored 0.67 against the line's speech just by lining its
 * edge up with a burst onset somewhere.
 */
export function detrend(env: Float32Array, win = 50): Float32Array {
  const out = new Float32Array(env.length);
  const half = win >> 1;
  for (let i = 0; i < env.length; i++) {
    const a = Math.max(0, i - half);
    const b = Math.min(env.length, i + half + 1);
    let s = 0;
    for (let k = a; k < b; k++) s += env[k];
    out[i] = env[i] - s / (b - a);
  }
  return out;
}

/**
 * How recognisably a station's speech comes through: the best detrended
 * envelope match between the demodulated audio and any of the reference lines
 * (24 kHz PCM). `trimSec` drops each line's first and last stretch so a
 * push-to-talk edge is not part of the reference.
 */
export function intelligibility(
  audio: Float32Array,
  refs: Float32Array[],
  refRate: number,
  opts: { trimSec?: number } = {},
): number {
  const env = detrend(envelope(audio, AUDIO_RATE));
  const trim = Math.round((opts.trimSec ?? 0) * refRate);
  let best = 0;
  for (const r of refs) {
    const core = r.subarray(trim, Math.max(trim, r.length - trim));
    best = Math.max(best, peakNcc(env, detrend(envelope(core, refRate))));
  }
  return best;
}
