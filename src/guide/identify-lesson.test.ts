import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { Scene } from '../sim/scene';
import { SpectrumAnalyzer, smoothSpectrum } from '../dsp/spectrum';
import { detectEmissions, EmissionTracker, type Track } from '../dsp/detector';
import { classify, type ClassResult } from '../id/classifier';
import { VoiceMessage, MSG_RATE } from '../sim/messages';
import { Rng } from '../sim/prng';
import { setVoiceBank, clearVoiceBank } from '../sim/voicebank';
import { SAMPLE_RATE, BLOCK_SIZE, FFT_SIZE } from '../engine/protocol';
import type { BankSetMsg } from '../engine/protocol';
import type { SignalKind } from '../sim/signal-kinds';
import { lessonById } from './lessons';

/**
 * The identify lesson says: the Signals list shows everything the receiver
 * found, with a guess per signal; pick one, name it, and the confirmation is
 * graded against the truth. lessons.test.ts checks the step predicates with a
 * hand-written `identified: ['wfm']`, so it cannot see whether the DETECTOR
 * finds the lesson's stations or whether the CLASSIFIER offers their true
 * kind to pick. This runs the lesson's own scene through the worker's chain —
 * scene → spectrum → detector → tracker → classifier — including the
 * worker's rule that a track's guess is refreshed only on frames the signal
 * is present, so a resting station keeps the name it had on the air.
 *
 * What it found (2026-10-09): the NFM repeater read as AM whenever it talked
 * (its residual carrier scored like AM's real one) and as CW whenever it
 * rested (its bandwidth had collapsed to the carrier during the hang). Both
 * are fixed in the classifier, tracker and worker; this pins the result.
 *
 * Two of the stations use default speech sets, which are silent in Node
 * without the main thread's voice bank; voice-shaped synthetic lines (the
 * simulator's own procedural VoiceMessage) are installed so the NFM and AM
 * stations key up the way they do in the app.
 */
const lesson = lessonById('identify')!;
const spec = lesson.scene;

/** A 3 s voice-shaped line from the simulator's procedural voice, normalised to a sane level. */
function voiceLine(seed: number, who: string): BankSetMsg['lines'][number] {
  const pcm = new Float32Array(3 * MSG_RATE);
  new VoiceMessage(new Rng(seed)).fill(pcm, pcm.length);
  let peak = 1e-6;
  for (const v of pcm) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < pcm.length; i++) pcm[i] = (0.6 * pcm[i]) / peak;
  return { pcm, who, text: 'synthetic voice' };
}

interface Seen {
  emitter: (typeof spec.emitters)[number];
  track: Track | null;
  candidates: ClassResult[];
}

function runDetection(seconds: number): Seen[] {
  const scene = new Scene({ sampleRate: SAMPLE_RATE, centerFreqHz: spec.centerFreqHz, noiseSigma: spec.noiseSigma });
  for (const e of spec.emitters) scene.add(e);
  const analyzer = new SpectrumAnalyzer(FFT_SIZE, 'blackman-harris');
  const tracker = new EmissionTracker();
  const re = new Float32Array(BLOCK_SIZE);
  const im = new Float32Array(BLOCK_SIZE);
  const specDb = new Float32Array(FFT_SIZE);
  const specAvg = new Float32Array(FFT_SIZE).fill(-140);
  const guesses = new Map<string, ClassResult[]>(); // the worker's per-track cache
  let tracks: Track[] = [];
  for (let b = 0, n = Math.round((seconds * SAMPLE_RATE) / BLOCK_SIZE); b < n; b++) {
    scene.generate(re, im, BLOCK_SIZE);
    analyzer.compute(re, im, BLOCK_SIZE - FFT_SIZE, specDb);
    smoothSpectrum(specAvg, specDb, 0.4);
    const dets = detectEmissions(specAvg, { binHz: SAMPLE_RATE / FFT_SIZE, centerFreqHz: spec.centerFreqHz, thresholdDb: 13 });
    tracks = tracker.update(dets, { minHits: 2, maxMiss: 160 });
    const live = new Set(tracks.map((t) => t.id));
    for (const id of guesses.keys()) if (!live.has(id)) guesses.delete(id);
    for (const t of tracks) {
      if (t.missed === 0 || !guesses.has(t.id)) {
        guesses.set(t.id, classify({ bandwidthHz: t.bandwidthHz, snrDb: t.snrDb, duty: t.duty, crestDb: t.crestDb }));
      }
    }
  }
  // Mirrors `nearestGroundTruth` in scenarios/scoring.ts: nearest within max(bandwidth, 25 kHz).
  return spec.emitters.map((emitter) => {
    let best: Track | null = null;
    let bestDist = Infinity;
    for (const t of tracks) {
      const dist = Math.abs(t.centerFreqHz - emitter.freqHz);
      if (dist < Math.max(t.bandwidthHz, 25_000) && dist < bestDist) {
        bestDist = dist;
        best = t;
      }
    }
    return { emitter, track: best, candidates: best ? (guesses.get(best.id) ?? []) : [] };
  });
}

const kindOf = (s: Seen) => s.emitter.kind as SignalKind;

describe('identify lesson: the detector finds the stations and the classifier offers their names', () => {
  let seen: Seen[];

  beforeAll(() => {
    clearVoiceBank();
    setVoiceBank({
      'repeater-2m': { lines: [voiceLine(971, 'K6XYZ'), voiceLine(972, 'N0CALL')], courtesy: true, continuous: false },
      airband: { lines: [voiceLine(973, 'Tower'), voiceLine(974, 'N123AB')], courtesy: false, continuous: false },
    });
    seen = runDetection(24);
    for (const s of seen) {
      const guess = s.candidates.map((c) => `${c.kind} ${(c.confidence * 100).toFixed(0)}%`).join(', ');
      console.log(
        `${s.emitter.kind.padEnd(5)} @ ${(s.emitter.freqHz / 1e6).toFixed(3)} MHz → ` +
          (s.track ? `bw ${Math.round(s.track.bandwidthHz)} Hz duty ${s.track.duty.toFixed(2)} crest ${s.track.crestDb.toFixed(1)} dB: ${guess}` : 'NOT DETECTED'),
      );
    }
  });

  afterAll(() => clearVoiceBank());

  it('detects every station in the lesson scene', () => {
    for (const s of seen) expect(s.track, `${s.emitter.kind} at ${s.emitter.freqHz} Hz not detected`).not.toBeNull();
  });

  it('offers every station its true kind among the candidates, so naming it is a skill not a trick', () => {
    for (const s of seen) {
      expect(
        s.candidates.some((c) => c.kind === kindOf(s)),
        `${s.emitter.kind}: candidates were ${s.candidates.map((c) => c.kind).join(', ')}`,
      ).toBe(true);
    }
  });

  it('guesses the voice and keyed stations right outright: broadcast FM, NFM, AM and CW', () => {
    for (const kind of ['wfm', 'nfm', 'am', 'cw'] as const) {
      const s = seen.find((x) => kindOf(x) === kind)!;
      expect(s.candidates[0]?.kind, `${kind} top guess`).toBe(kind);
    }
  });

  it('keeps LoRa among the candidates (spectrum alone cannot see the chirp, a known limit)', () => {
    const l = seen.find((x) => kindOf(x) === 'lora')!;
    expect(l.candidates.some((c) => c.kind === 'lora')).toBe(true);
  });
});
