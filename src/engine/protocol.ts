import type { EmitterConfig } from '../sim/emitters';
import type { DemodMode, SignalKind } from '../sim/signal-kinds';

/** Fixed SDR sample rate (Hz). Chosen so it divides cleanly to 48 kHz audio. */
export const SAMPLE_RATE = 1_152_000;
export const BLOCK_SIZE = 16384;
export const FFT_SIZE = 8192;

export interface SceneSpec {
  centerFreqHz: number;
  noiseSigma: number;
  emitters: EmitterConfig[];
}

/** Ground-truth emitter description (for scoring; not shown until revealed). */
export interface GroundTruth {
  id: string;
  kind: SignalKind;
  label: string;
  freqHz: number;
  offsetHz: number;
  bandwidthHz: number;
  powerDb: number;
}

export interface TrackMsg {
  id: string;
  offsetHz: number;
  centerFreqHz: number;
  bandwidthHz: number;
  snrDb: number;
  crestDb: number;
  duty: number;
  guessKind: SignalKind;
  guessLabel: string;
  guessConfidence: number;
  candidates: { kind: SignalKind; label: string; confidence: number; reason: string }[];
  /** Present when the peak sweeps the band as a sawtooth: the chirp's measured parameters. */
  chirp?: { rateHzPerS: number; bwHz: number; sf: number | null; consistency: number };
}

/** One decoded transmission for the worker's voice bank (24 kHz PCM). */
export interface BankLineMsg {
  pcm: Float32Array;
  who: string;
  text: string;
}
export interface BankSetMsg {
  lines: BankLineMsg[];
  /** Repeater: hang time, a courtesy beep, then the carrier drops. */
  courtesy: boolean;
  /** Broadcast: the carrier never drops between lines. */
  continuous: boolean;
}

/** A transmission starting on the air (for captions and the intercept log). */
export interface TxEvent {
  emitterId: string;
  freqHz: number;
  set: string;
  line: number;
  who: string;
  text: string;
  durSec: number;
}

// --- Main -> Worker ---
export type ToWorker =
  | { type: 'loadScene'; scene: SceneSpec }
  | { type: 'setCenter'; hz: number }
  | { type: 'setTuning'; offsetHz: number }
  | { type: 'setMode'; mode: DemodMode }
  | { type: 'setBandwidth'; hz: number }
  | { type: 'setSquelch'; db: number }
  | { type: 'setRunning'; running: boolean }
  | { type: 'addEmitter'; cfg: EmitterConfig }
  | { type: 'removeEmitter'; id: string }
  | { type: 'clearEmitters' }
  | { type: 'setNoise'; sigma: number }
  | { type: 'startRecording' }
  | { type: 'stopRecording' }
  | { type: 'playIQ'; re: Float32Array; im: Float32Array; centerFreqHz: number }
  | { type: 'stopPlayback' }
  /** Streamed capture: open with its native rate, then feed chunks on demand. */
  | { type: 'playOpen'; sampleRate: number; centerFreqHz: number; totalSamples: number }
  | { type: 'playChunk'; re: Float32Array; im: Float32Array }
  | { type: 'playStop' }
  /** Render a scene to a capture (forensics missions ship no files; the sim makes one on demand). */
  | { type: 'renderCapture'; id: string; scene: SceneSpec; seconds: number; datatype: 'cu8' | 'ci16_le' | 'cf32_le'; seed: number }
  | { type: 'voiceBank'; sets: Record<string, BankSetMsg> };

// --- Worker -> Main ---
export type FromWorker =
  | { type: 'spectrum'; db: Float32Array; centerFreqHz: number; binHz: number }
  | { type: 'audio'; pcm: Float32Array }
  | { type: 'chanIQ'; re: Float32Array; im: Float32Array }
  | { type: 'detections'; tracks: TrackMsg[] }
  | { type: 'meter'; signalDb: number }
  | { type: 'groundTruth'; list: GroundTruth[] }
  | { type: 'morse'; text: string }
  | { type: 'recording'; iq: Float32Array; centerFreqHz: number; durationSec: number }
  /** The capture queue is running low: send the next chunk. */
  | { type: 'playNeed'; queuedSamples: number }
  /** Input samples consumed so far (the main thread knows the loop length). */
  | { type: 'playPos'; consumed: number }
  | { type: 'captureProgress'; id: string; pct: number }
  | { type: 'captureRendered'; id: string; data: ArrayBuffer; sampleRate: number; centerFreqHz: number; datatype: 'cu8' | 'ci16_le' | 'cf32_le' }
  | ({ type: 'tx' } & TxEvent);
