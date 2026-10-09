import { describe, it, expect } from 'vitest';
import { lessonById } from './lessons';
import { demodAudio, intelligibility } from '../test/audioHarness';
import { syntheticBank } from '../test/detectHarness';
import { VoiceMessage, MSG_RATE } from '../sim/messages';
import { Rng } from '../sim/prng';

/**
 * The modes lesson claims two things about the receiver that no other test
 * runs through it: the AM tower "comes through clean" in AM and "goes quiet or
 * distorted" in NFM. Measured here as how well the demodulated audio's
 * detrended syllable envelope matches the speech the station was keying — 1 is
 * the speech itself, ~0.5 is only its rhythm. A mismatched FM discriminator
 * still carries the rhythm, because its noise output quiets and swells with
 * the AM sidebands' power; that is the "distorted" a listener hears. Each
 * push-to-talk line's edges are trimmed from the reference so an on/off step
 * cannot score (it scored 0.67 before).
 *
 * Measured 2026-10-09: tower in AM 0.945, in NFM 0.561 (USB 0.599, WFM 0.522);
 * the 118.8 station in NFM 0.940, in AM 0.574.
 */
const lesson = lessonById('modes')!;
const bank = syntheticBank();
const tower = lesson.scene.emitters.find((e) => e.id === 'twr')!;
const station = lesson.scene.emitters.find((e) => e.id === 'fm')!;

describe('modes lesson: the matched demodulator is the one that sounds right', () => {
  it('the AM tower comes through clean in AM and only as rhythm in NFM', () => {
    const refs = bank.airband.lines.map((l) => l.pcm);
    const score = (mode: 'am' | 'nfm') =>
      intelligibility(demodAudio({ spec: lesson.scene, tuneHz: tower.freqHz, mode, sec: 30, bank }), refs, MSG_RATE, {
        trimSec: 0.4,
      });
    const am = score('am');
    const nfm = score('nfm');
    expect(am).toBeGreaterThan(0.8);
    expect(nfm).toBeLessThan(0.7);
    expect(am - nfm).toBeGreaterThan(0.25);
  });

  it('the NFM station comes through in NFM, not in AM', () => {
    // Its speech is a procedural message, reproducible from the emitter's seed.
    const ref = new Float32Array(8 * MSG_RATE);
    new VoiceMessage(new Rng(station.seed!)).fill(ref, ref.length);
    const score = (mode: 'am' | 'nfm') =>
      intelligibility(demodAudio({ spec: lesson.scene, tuneHz: station.freqHz, mode, sec: 12, bank }), [ref], MSG_RATE);
    const nfm = score('nfm');
    const am = score('am');
    expect(nfm).toBeGreaterThan(0.8);
    expect(am).toBeLessThan(0.7);
  });
});
