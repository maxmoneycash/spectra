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
  | { type: 'stopPlayback' };

// --- Worker -> Main ---
export type FromWorker =
  | { type: 'spectrum'; db: Float32Array; centerFreqHz: number; binHz: number }
  | { type: 'audio'; pcm: Float32Array }
  | { type: 'chanIQ'; re: Float32Array; im: Float32Array }
  | { type: 'detections'; tracks: TrackMsg[] }
  | { type: 'meter'; signalDb: number }
  | { type: 'groundTruth'; list: GroundTruth[] }
  | { type: 'morse'; text: string }
  | { type: 'recording'; iq: Float32Array; centerFreqHz: number; durationSec: number };
