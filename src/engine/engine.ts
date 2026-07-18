import {
  SAMPLE_RATE,
  type ToWorker,
  type FromWorker,
  type SceneSpec,
  type GroundTruth,
  type TrackMsg,
} from './protocol';
import type { DemodMode } from '../sim/signal-kinds';
import type { EmitterConfig } from '../sim/emitters';
import {
  buildSigMFMeta,
  downloadSigMF,
  parseSigMFData,
  type SigMFAnnotation,
} from '../recording/sigmf';

type Listeners = {
  spectrum: (db: Float32Array, centerFreqHz: number, binHz: number) => void;
  detections: (tracks: TrackMsg[]) => void;
  meter: (signalDb: number) => void;
  morse: (text: string) => void;
  groundTruth: (list: GroundTruth[]) => void;
  recordingState: (recording: boolean) => void;
  recordingSaved: (r: { name: string; durationSec: number; centerFreqHz: number }) => void;
  audio: (pcm: Float32Array) => void;
  chanIQ: (re: Float32Array, im: Float32Array) => void;
};

/**
 * Main-thread orchestrator. Owns the DSP worker and the Web Audio graph, relays
 * control messages, and fans worker events out to UI listeners. High-rate data
 * (spectrum frames, audio) bypasses React entirely.
 */
export class SpectraEngine {
  readonly sampleRate = SAMPLE_RATE;
  private worker: Worker;
  private audioCtx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private gain: GainNode | null = null;
  private audioReady = false;

  centerFreqHz = 100_000_000;
  private lastTracks: TrackMsg[] = [];
  private lastGroundTruth: GroundTruth[] = [];

  private listeners: { [K in keyof Listeners]: Set<Listeners[K]> } = {
    spectrum: new Set(),
    detections: new Set(),
    meter: new Set(),
    morse: new Set(),
    groundTruth: new Set(),
    recordingState: new Set(),
    recordingSaved: new Set(),
    audio: new Set(),
    chanIQ: new Set(),
  };

  constructor() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (ev: MessageEvent<FromWorker>) => this.onMessage(ev.data);
  }

  on<K extends keyof Listeners>(event: K, cb: Listeners[K]): () => void {
    this.listeners[event].add(cb);
    return () => this.listeners[event].delete(cb);
  }

  private emit<K extends keyof Listeners>(event: K, ...args: Parameters<Listeners[K]>): void {
    for (const cb of this.listeners[event]) (cb as (...a: unknown[]) => void)(...args);
  }

  private send(msg: ToWorker, transfer?: Transferable[]): void {
    this.worker.postMessage(msg, transfer ?? []);
  }

  private onMessage(msg: FromWorker): void {
    switch (msg.type) {
      case 'spectrum':
        this.emit('spectrum', msg.db, msg.centerFreqHz, msg.binHz);
        break;
      case 'audio':
        // Copy for the scopes BEFORE the buffer is transferred to the worklet.
        if (this.listeners.audio.size > 0) this.emit('audio', msg.pcm.slice());
        this.node?.port.postMessage(msg.pcm, [msg.pcm.buffer]);
        break;
      case 'chanIQ':
        this.emit('chanIQ', msg.re, msg.im);
        break;
      case 'detections':
        this.lastTracks = msg.tracks;
        this.emit('detections', msg.tracks);
        break;
      case 'meter':
        this.emit('meter', msg.signalDb);
        break;
      case 'morse':
        this.emit('morse', msg.text);
        break;
      case 'groundTruth':
        this.lastGroundTruth = msg.list;
        this.emit('groundTruth', msg.list);
        break;
      case 'recording':
        this.finishRecording(msg.iq, msg.centerFreqHz, msg.durationSec);
        break;
    }
  }

  async initAudio(): Promise<void> {
    if (this.audioReady) {
      await this.audioCtx?.resume();
      return;
    }
    const ctx = new AudioContext({ sampleRate: 48000 });
    await ctx.audioWorklet.addModule('/pcm-processor.js');
    const node = new AudioWorkletNode(ctx, 'pcm-player', { outputChannelCount: [1] });
    const gain = ctx.createGain();
    gain.gain.value = 0.7;
    node.connect(gain).connect(ctx.destination);
    await ctx.resume();
    this.audioCtx = ctx;
    this.node = node;
    this.gain = gain;
    this.audioReady = true;
  }

  setVolume(v: number): void {
    if (this.gain) this.gain.gain.value = v;
  }

  async start(): Promise<void> {
    await this.initAudio();
    this.node?.port.postMessage('clear');
    this.send({ type: 'setRunning', running: true });
  }

  stop(): void {
    this.send({ type: 'setRunning', running: false });
  }

  loadScene(scene: SceneSpec): void {
    this.centerFreqHz = scene.centerFreqHz;
    this.send({ type: 'loadScene', scene });
  }

  setCenter(hz: number): void {
    this.centerFreqHz = hz;
    this.send({ type: 'setCenter', hz });
  }
  setTuning(offsetHz: number): void {
    this.send({ type: 'setTuning', offsetHz });
  }
  setMode(mode: DemodMode): void {
    this.send({ type: 'setMode', mode });
  }
  setBandwidth(hz: number): void {
    this.send({ type: 'setBandwidth', hz });
  }
  setSquelch(db: number): void {
    this.send({ type: 'setSquelch', db });
  }
  setNoise(sigma: number): void {
    this.send({ type: 'setNoise', sigma });
  }
  addEmitter(cfg: EmitterConfig): void {
    this.send({ type: 'addEmitter', cfg });
  }
  removeEmitter(id: string): void {
    this.send({ type: 'removeEmitter', id });
  }
  clearEmitters(): void {
    this.send({ type: 'clearEmitters' });
  }

  startRecording(): void {
    this.send({ type: 'startRecording' });
    this.emit('recordingState', true);
  }
  stopRecording(): void {
    this.send({ type: 'stopRecording' });
    this.emit('recordingState', false);
  }

  private finishRecording(iq: Float32Array, centerFreqHz: number, durationSec: number): void {
    const annotations: SigMFAnnotation[] = this.lastTracks.map((t) => ({
      sample_start: 0,
      'core:freq_lower_edge': t.centerFreqHz - t.bandwidthHz / 2,
      'core:freq_upper_edge': t.centerFreqHz + t.bandwidthHz / 2,
      'core:label': t.guessLabel,
      'core:description': `${(t.guessConfidence * 100).toFixed(0)}% confidence; SNR ${t.snrDb.toFixed(0)} dB`,
    }));
    const meta = buildSigMFMeta({
      sampleRate: this.sampleRate,
      centerFreqHz,
      description: `SPECTRA capture, ${durationSec.toFixed(1)} s`,
      annotations,
    });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const name = `spectra-${stamp}`;
    downloadSigMF(name, iq, meta);
    this.emit('recordingSaved', { name, durationSec, centerFreqHz });
  }

  /** Load a `.sigmf-data` file for playback. */
  async playSigMFFile(file: File, centerFreqHz: number): Promise<void> {
    const buf = await file.arrayBuffer();
    const { re, im } = parseSigMFData(buf);
    this.centerFreqHz = centerFreqHz;
    this.send({ type: 'playIQ', re, im, centerFreqHz }, [re.buffer, im.buffer]);
  }

  stopPlayback(): void {
    this.send({ type: 'stopPlayback' });
  }

  groundTruth(): GroundTruth[] {
    return this.lastGroundTruth;
  }
  tracks(): TrackMsg[] {
    return this.lastTracks;
  }
}

let singleton: SpectraEngine | null = null;
export function getEngine(): SpectraEngine {
  if (!singleton) singleton = new SpectraEngine();
  return singleton;
}
