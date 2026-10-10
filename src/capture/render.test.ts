/**
 * A rendered capture must contain what the live scene contains. The first
 * forensics captures shipped with every voice station as a bare carrier —
 * the render ran before the voice bank arrived — and a bare FM carrier is
 * 73 kHz wide and classifies as PSK. This renders First Light the way the
 * script and the worker do, plays it back through the real resampler and
 * detector, and asserts the stations read as full talk-radio stations.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { challengeById, toSceneSpec } from '../ctf/challenges';
import { Scene } from '../sim/scene';
import { clearVoiceBank, setVoiceBank } from '../sim/voicebank';
import { syntheticBank } from '../test/detectHarness';
import { SpectrumAnalyzer, smoothSpectrum } from '../dsp/spectrum';
import { detectEmissions, EmissionTracker } from '../dsp/detector';
import { StreamResampler } from '../dsp/resample';
import { classify } from '../id/classifier';
import { SAMPLE_RATE, BLOCK_SIZE, FFT_SIZE } from '../engine/protocol';
import { decodeSamples, encodeSamples, type CaptureDatatype } from './decode';

/** Render `seconds` of a scene at `rate` to `dt`, as scripts/render-captures.mts does. */
function render(rate: number, seconds: number, dt: CaptureDatatype, withBank: boolean) {
  const spec = toSceneSpec(challengeById('first-light')!);
  if (withBank) setVoiceBank(syntheticBank());
  else clearVoiceBank();
  const scene = new Scene({ sampleRate: rate, centerFreqHz: spec.centerFreqHz, noiseSigma: spec.noiseSigma, seed: 7 }, 65536);
  for (const e of spec.emitters) scene.add(e);
  const total = Math.round(rate * seconds);
  const re = new Float32Array(total);
  const im = new Float32Array(total);
  const bre = new Float32Array(65536);
  const bim = new Float32Array(65536);
  for (let off = 0; off < total; off += 65536) {
    const n = Math.min(65536, total - off);
    scene.generate(bre, bim, n);
    const d = decodeSamples(encodeSamples(bre.subarray(0, n), bim.subarray(0, n), dt), dt);
    re.set(d.re, off);
    im.set(d.im, off);
  }
  return { spec, re, im };
}

/** Play a capture through the worker's detection recipe; return the wide tracks. */
function wideStations(rate: number, re: Float32Array, im: Float32Array, centerFreqHz: number) {
  const rs = new StreamResampler(rate, SAMPLE_RATE);
  const oRe = new Float32Array(rs.outCapacity(re.length) + 16);
  const oIm = new Float32Array(oRe.length);
  const k = rs.process(re, im, re.length, oRe, oIm);
  const an = new SpectrumAnalyzer(FFT_SIZE, 'blackman-harris');
  const tracker = new EmissionTracker();
  const specDb = new Float32Array(FFT_SIZE);
  const specAvg = new Float32Array(FFT_SIZE).fill(-140);
  let tracks: ReturnType<typeof tracker.update> = [];
  for (let off = 0; off + BLOCK_SIZE <= k; off += BLOCK_SIZE) {
    an.compute(oRe.subarray(off, off + BLOCK_SIZE), oIm.subarray(off, off + BLOCK_SIZE), BLOCK_SIZE - FFT_SIZE, specDb);
    smoothSpectrum(specAvg, specDb, 0.4);
    tracks = tracker.update(
      detectEmissions(specAvg, { binHz: SAMPLE_RATE / FFT_SIZE, centerFreqHz, thresholdDb: 13 }),
      { minHits: 2, maxMiss: 160 },
    );
  }
  return tracks
    .filter((t) => t.bandwidthHz > 50_000)
    .map((t) => ({
      mhz: t.centerFreqHz / 1e6,
      bwKhz: t.bandwidthHz / 1e3,
      kind: classify({ bandwidthHz: t.bandwidthHz, snrDb: t.snrDb, duty: t.duty, crestDb: t.crestDb, hopping: t.hopping, chirp: t.chirp })[0].kind,
    }));
}

describe('rendered captures carry the scene, not bare carriers', () => {
  afterEach(() => clearVoiceBank());

  it('with the bank: a 2.4 MSPS cu8 render plays back as three broadcast FM stations', () => {
    const { spec, re, im } = render(2_400_000, 3, 'cu8', true);
    const wide = wideStations(2_400_000, re, im, spec.centerFreqHz);
    expect(wide.length).toBeGreaterThanOrEqual(3);
    for (const s of wide) {
      expect(s.bwKhz, `${s.mhz.toFixed(3)} MHz`).toBeGreaterThan(110);
      expect(s.kind, `${s.mhz.toFixed(3)} MHz`).toBe('wfm');
    }
  }, 120_000);

  it('without the bank: stations still read as broadcast FM (the program bed carries them)', () => {
    // When this guard was written, a bankless render produced 73 kHz bare
    // carriers. Raising the bed to near-voice level made that impossible: a
    // broadcast station is wide whether or not anyone is talking. What the
    // bank still decides is the transcript — nothing is "said" without it.
    const { spec, re, im } = render(2_400_000, 3, 'cu8', false);
    const wide = wideStations(2_400_000, re, im, spec.centerFreqHz);
    expect(wide.length).toBeGreaterThanOrEqual(3);
    for (const s of wide) {
      expect(s.bwKhz, `${s.mhz.toFixed(3)} MHz`).toBeGreaterThan(110);
      expect(s.kind).toBe('wfm');
    }
  }, 120_000);
});
