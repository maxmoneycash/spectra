import { Scene } from '../sim/scene';
import { SpectrumAnalyzer, smoothSpectrum } from '../dsp/spectrum';
import { detectEmissions, EmissionTracker, HOP_LINK_HZ, type Track } from '../dsp/detector';
import { ChirpAnalyzer } from '../dsp/chirp';
import { classify, type ClassResult } from '../id/classifier';
import { VoiceMessage, MSG_RATE } from '../sim/messages';
import { Rng } from '../sim/prng';
import { setVoiceBank, clearVoiceBank } from '../sim/voicebank';
import { SAMPLE_RATE, BLOCK_SIZE, FFT_SIZE } from '../engine/protocol';
import type { BankSetMsg, SceneSpec } from '../engine/protocol';

/**
 * The worker's detection chain — scene → spectrum → detector → tracker →
 * classifier — as one call, so a test can ask "what would the Stations list
 * show for this scene?" Mirrors the worker exactly: the same FFT, smoothing,
 * detection threshold, tracker options, and its rule that a track's guess is
 * refreshed only on frames the signal is present.
 *
 * Why tests run this chain: the identify lesson's NFM station was nameable
 * 20% of the time, and the CTF's recon/analysis flags are graded against what
 * this chain reports — a count, a frequency, a bandwidth, a guess. Anything
 * that claims the detector sees something gets pinned through here.
 */

export interface Guessed extends Track {
  candidates: ClassResult[];
}

export interface DetectOpts {
  spec: SceneSpec;
  /** Seconds of simulated air. Bursty emitters need tens of seconds to all key up. */
  sec: number;
  /**
   * Synthetic voice sets for speech emitters. Speech emitters key lines from
   * a voice bank the main thread normally supplies; in Node the bank is empty
   * and they stay silent, so a scene with voice stations must install one.
   */
  bank?: Record<string, BankSetMsg>;
  /** Applied to each generated block before analysis — e.g. quantise to cu8 to mimic a capture. */
  shape?: (re: Float32Array, im: Float32Array, n: number) => void;
}

export interface DetectResult {
  /** The Stations list at the end of the run. */
  tracks: Guessed[];
  /**
   * Every track that was on the posted list long enough for a person to count
   * it (three consecutive postings, ~170 ms), last snapshot each — what a
   * patient operator accumulates over the run.
   */
  everSeen: Guessed[];
}

/** A voice-shaped line from the simulator's own procedural voice, normalised to a sane level. */
export function voiceLine(seed: number, who: string, seconds = 3): BankSetMsg['lines'][number] {
  const pcm = new Float32Array(Math.round(seconds * MSG_RATE));
  new VoiceMessage(new Rng(seed)).fill(pcm, pcm.length);
  let peak = 1e-6;
  for (const v of pcm) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < pcm.length; i++) pcm[i] = (0.6 * pcm[i]) / peak;
  return { pcm, who, text: 'synthetic voice' };
}

/** A bank covering every speech set the simulator's scenes reference. */
export function syntheticBank(): Record<string, BankSetMsg> {
  const set = (seed: number, courtesy: boolean, continuous = false): BankSetMsg => ({
    lines: [voiceLine(seed, 'A'), voiceLine(seed + 1, 'B')],
    courtesy,
    continuous,
  });
  return {
    'repeater-2m': set(971, true),
    'simplex-2m': set(981, false),
    airband: set(973, false),
    'hf-ssb': set(975, false),
    'talk-fm-a': set(977, false, true),
    'talk-fm-b': set(979, false, true),
    'talk-fm-c': set(983, false, true),
  };
}

export function detectScene(o: DetectOpts): DetectResult {
  if (o.bank) {
    clearVoiceBank();
    setVoiceBank(o.bank);
  }
  const scene = new Scene({ sampleRate: SAMPLE_RATE, centerFreqHz: o.spec.centerFreqHz, noiseSigma: o.spec.noiseSigma });
  for (const e of o.spec.emitters) scene.add(e);
  const analyzer = new SpectrumAnalyzer(FFT_SIZE, 'blackman-harris');
  const tracker = new EmissionTracker();
  const chirper = new ChirpAnalyzer(SAMPLE_RATE);
  const re = new Float32Array(BLOCK_SIZE);
  const im = new Float32Array(BLOCK_SIZE);
  const specDb = new Float32Array(FFT_SIZE);
  const specAvg = new Float32Array(FFT_SIZE).fill(-140);
  const guesses = new Map<string, ClassResult[]>();
  const ever = new Map<string, Guessed>();
  const posted = new Map<string, number>();
  let tracks: Track[] = [];
  for (let b = 0, n = Math.round((o.sec * SAMPLE_RATE) / BLOCK_SIZE); b < n; b++) {
    scene.generate(re, im, BLOCK_SIZE);
    o.shape?.(re, im, BLOCK_SIZE);
    analyzer.compute(re, im, BLOCK_SIZE - FFT_SIZE, specDb);
    smoothSpectrum(specAvg, specDb, 0.4);
    const dets = detectEmissions(specAvg, { binHz: SAMPLE_RATE / FFT_SIZE, centerFreqHz: o.spec.centerFreqHz, thresholdDb: 13 });
    tracks = tracker.update(dets, { minHits: 2, maxMiss: 160 });
    chirper.update(re, im, BLOCK_SIZE, tracks);
    const live = new Set(tracks.map((t) => t.id));
    for (const id of guesses.keys()) if (!live.has(id)) guesses.delete(id);
    for (const t of tracks) {
      if (t.missed === 0 || !guesses.has(t.id)) {
        guesses.set(
          t.id,
          classify({ bandwidthHz: t.bandwidthHz, snrDb: t.snrDb, duty: t.duty, crestDb: t.crestDb, hopping: t.hopping, chirp: t.chirp }),
        );
      }
      // The worker posts the list every 4th frame, and a person needs it on
      // screen for a few postings (~170 ms) before it can be counted. A track
      // kept for a single frame was never visible to anyone.
      if (b % 4 === 0) {
        const n = (posted.get(t.id) ?? 0) + 1;
        posted.set(t.id, n);
        if (n >= 3) ever.set(t.id, { ...t, candidates: guesses.get(t.id)! });
      }
    }
  }
  if (o.bank) clearVoiceBank();
  return {
    tracks: tracks.map((t) => ({ ...t, candidates: guesses.get(t.id) ?? [] })),
    everSeen: [...ever.values()],
  };
}

/** Nearest track within max(bandwidth, 25 kHz): the grading rule in scenarios/scoring.ts. */
export function nearestTrack(tracks: Guessed[], freqHz: number): Guessed | null {
  let best: Guessed | null = null;
  let bestDist = Infinity;
  for (const t of tracks) {
    const dist = Math.abs(t.centerFreqHz - freqHz);
    if (dist < Math.max(t.bandwidthHz, 25_000) && dist < bestDist) {
      bestDist = dist;
      best = t;
    }
  }
  return best;
}

/**
 * Distinct emitters among tracks: anything within 25 kHz of a stronger one is
 * the same emitter, and any narrow track within a link of a hopper's span is
 * one of its dwells — the same rule the tracker applies live. The ledger keeps
 * the dwells it saw before each one was folded in, so it needs the rule too.
 */
export function distinctEmitters(tracks: Guessed[]): Guessed[] {
  const hoppers = tracks.filter((t) => t.hopping);
  const kept: Guessed[] = [...hoppers];
  // Only a narrow track is a dwell; a wide signal that happens to sit inside a
  // hopper's span is its own emitter.
  const inHopper = (t: Guessed) =>
    t.bandwidthHz < 4_000 &&
    hoppers.some((h) => Math.abs(t.centerFreqHz - h.centerFreqHz) <= h.bandwidthHz / 2 + HOP_LINK_HZ);
  for (const t of [...tracks].filter((t) => !t.hopping).sort((a, b) => b.snrDb - a.snrDb)) {
    if (inHopper(t)) continue;
    if (!kept.some((k) => Math.abs(k.centerFreqHz - t.centerFreqHz) < 25_000)) kept.push(t);
  }
  return kept;
}
