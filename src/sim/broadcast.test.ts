/**
 * A broadcast FM station must read as broadcast FM all the time, not just
 * mid-sentence. FM bandwidth follows the audio level, so a station whose
 * audio falls silent between words collapses to a near-bare carrier — 50 to
 * 70 kHz wide, classified PSK. Real stations run a limiter so modulation
 * stays near peak; here the program bed under the speech does that job.
 * Measured before the fix: every station swung 50–147 kHz on a half-second
 * scale, and a 2 s fixture passed by luck.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { challengeById, toSceneSpec } from '../ctf/challenges';
import { Scene } from './scene';
import { clearVoiceBank, setVoiceBank } from './voicebank';
import { voiceLine } from '../test/detectHarness';
import { SpectrumAnalyzer, smoothSpectrum } from '../dsp/spectrum';
import { detectEmissions } from '../dsp/detector';
import { classify } from '../id/classifier';
import { SAMPLE_RATE, BLOCK_SIZE, FFT_SIZE } from '../engine/protocol';

describe('broadcast FM stays wide through speech pauses', () => {
  afterEach(() => clearVoiceBank());

  it('every First Light station is ≥ 100 kHz at every half-second sample over 8 s', () => {
    const spec = toSceneSpec(challengeById('first-light')!);
    // Real-length lines (5–8 s), so pauses between them land where they really do.
    const set = (seed: number) => ({
      lines: [voiceLine(seed, 'A', 5.3), voiceLine(seed + 1, 'B', 7.8)],
      courtesy: false,
      continuous: true,
    });
    setVoiceBank({ 'talk-fm-a': set(977), 'talk-fm-b': set(979), 'talk-fm-c': set(983) });
    const scene = new Scene({ sampleRate: SAMPLE_RATE, centerFreqHz: spec.centerFreqHz, noiseSigma: spec.noiseSigma, seed: 7 }, BLOCK_SIZE);
    for (const e of spec.emitters) scene.add(e);
    const an = new SpectrumAnalyzer(FFT_SIZE, 'blackman-harris');
    const re = new Float32Array(BLOCK_SIZE);
    const im = new Float32Array(BLOCK_SIZE);
    const specDb = new Float32Array(FFT_SIZE);
    const specAvg = new Float32Array(FFT_SIZE).fill(-140);
    const stations = [98.1e6, 98.7e6, 98.9e6];
    const minBw = stations.map(() => Infinity);
    const misread: string[] = [];
    const blocks = Math.round((8 * SAMPLE_RATE) / BLOCK_SIZE);
    for (let b = 0; b < blocks; b++) {
      scene.generate(re, im, BLOCK_SIZE);
      an.compute(re, im, BLOCK_SIZE - FFT_SIZE, specDb);
      smoothSpectrum(specAvg, specDb, 0.4);
      // Skip the first second: the averaged spectrum is still filling in.
      if (b < 70 || b % 35 !== 0) continue;
      const dets = detectEmissions(specAvg, { binHz: SAMPLE_RATE / FFT_SIZE, centerFreqHz: spec.centerFreqHz, thresholdDb: 13 });
      stations.forEach((f, i) => {
        const d = dets.filter((x) => Math.abs(x.centerFreqHz - f) < 60e3).sort((a, c) => c.bandwidthHz - a.bandwidthHz)[0];
        const bw = d?.bandwidthHz ?? 0;
        minBw[i] = Math.min(minBw[i], bw);
        if (d) {
          const kind = classify({ bandwidthHz: d.bandwidthHz, snrDb: d.snrDb, duty: 1, crestDb: d.crestDb })[0].kind;
          if (kind !== 'wfm') misread.push(`t=${((b * BLOCK_SIZE) / SAMPLE_RATE).toFixed(1)}s ${(f / 1e6).toFixed(1)} ${kind} ${(bw / 1e3).toFixed(0)}k`);
        }
      });
    }
    expect(minBw.map((v) => Math.round(v / 1e3)), 'minimum bandwidth per station, kHz').toEqual(
      expect.arrayContaining([expect.any(Number)]),
    );
    for (let i = 0; i < stations.length; i++) {
      expect(minBw[i], `${(stations[i] / 1e6).toFixed(1)} MHz min bandwidth`).toBeGreaterThan(100_000);
    }
    expect(misread, 'samples where a station read as something other than broadcast FM').toEqual([]);
  }, 180_000);
});
