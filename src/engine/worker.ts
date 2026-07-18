/// <reference lib="webworker" />
import { Scene } from '../sim/scene';
import { SpectrumAnalyzer, smoothSpectrum } from '../dsp/spectrum';
import { Receiver, AUDIO_RATE } from '../dsp/receiver';
import { detectEmissions, EmissionTracker } from '../dsp/detector';
import { classify } from '../id/classifier';
import { MorseDecoder } from '../sim/morse';
import { interleave } from '../recording/sigmf';
import {
  SAMPLE_RATE,
  BLOCK_SIZE,
  FFT_SIZE,
  type ToWorker,
  type FromWorker,
  type TrackMsg,
} from './protocol';

const blockMs = (BLOCK_SIZE / SAMPLE_RATE) * 1000;
const MAX_RECORD_SEC = 8;

let scene = new Scene({ sampleRate: SAMPLE_RATE, centerFreqHz: 100_000_000 }, BLOCK_SIZE);
let centerFreqHz = 100_000_000;
const analyzer = new SpectrumAnalyzer(FFT_SIZE, 'blackman-harris');
const receiver = new Receiver(SAMPLE_RATE, BLOCK_SIZE);
const tracker = new EmissionTracker();
const morseDecoder = new MorseDecoder();

const bandRe = new Float32Array(BLOCK_SIZE);
const bandIm = new Float32Array(BLOCK_SIZE);
const audioBuf = new Float32Array(BLOCK_SIZE);
const specDb = new Float32Array(FFT_SIZE);
const specAvg = new Float32Array(FFT_SIZE).fill(-140);

let running = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let nextTime = 0;
let frame = 0;
let lastMorse = '';

// CW keying decode state (runs on demod audio).
let cwState = false;
let cwSamples = 0;
let cwEnv = 0;
let cwPeak = 0.01;
const cwAlpha = 1 - Math.exp(-1 / (0.003 * AUDIO_RATE));

// Recording
let recording = false;
let recordBuf: Float32Array[] = [];
let recordSamples = 0;

// Playback (file source)
let playRe: Float32Array | null = null;
let playIm: Float32Array | null = null;
let playPos = 0;

const post = (msg: FromWorker, transfer?: Transferable[]) =>
  (self as unknown as Worker).postMessage(msg, transfer ?? []);

function sendGroundTruth() {
  const gt = scene.groundTruth();
  post({ type: 'groundTruth', list: gt });
}

function generateBlock() {
  if (playRe && playIm) {
    const n = playRe.length;
    for (let i = 0; i < BLOCK_SIZE; i++) {
      const p = (playPos + i) % n;
      bandRe[i] = playRe[p];
      bandIm[i] = playIm[p];
    }
    playPos = (playPos + BLOCK_SIZE) % n;
  } else {
    scene.generate(bandRe, bandIm, BLOCK_SIZE);
  }

  // Spectrum (latest FFT_SIZE samples of the block).
  analyzer.compute(bandRe, bandIm, BLOCK_SIZE - FFT_SIZE, specDb);
  smoothSpectrum(specAvg, specDb, 0.4);
  const specCopy = specDb.slice();
  post(
    { type: 'spectrum', db: specCopy, centerFreqHz, binHz: SAMPLE_RATE / FFT_SIZE },
    [specCopy.buffer],
  );

  // Receiver -> audio.
  const count = receiver.process(bandRe, bandIm, BLOCK_SIZE, audioBuf);
  if (count > 0) {
    decodeCW(audioBuf, count);
    const audioCopy = audioBuf.slice(0, count);
    post({ type: 'audio', pcm: audioCopy }, [audioCopy.buffer]);
  }
  post({ type: 'meter', signalDb: receiver.level });

  // Recording.
  if (recording && recordSamples < MAX_RECORD_SEC * SAMPLE_RATE) {
    recordBuf.push(interleave(bandRe, bandIm, BLOCK_SIZE));
    recordSamples += BLOCK_SIZE;
  }

  // Channel-IQ tap for the UI's IQ scope (~23 Hz).
  if (frame % 3 === 0 && receiver.tapCount > 0) {
    const tr = receiver.tapRe.slice(0, receiver.tapCount);
    const ti = receiver.tapIm.slice(0, receiver.tapCount);
    post({ type: 'chanIQ', re: tr, im: ti }, [tr.buffer, ti.buffer]);
  }

  // Update the tracker every block so short bursts accumulate hits; throttle
  // the (React-driving) post to ~17 Hz.
  updateDetection();
  if (frame % 4 === 0) post({ type: 'detections', tracks: lastTrackMsgs });
  frame++;
}

let lastTrackMsgs: TrackMsg[] = [];

function updateDetection() {
  const dets = detectEmissions(specAvg, {
    binHz: SAMPLE_RATE / FFT_SIZE,
    centerFreqHz,
    thresholdDb: 13,
  });
  const tracks = tracker.update(dets, { minHits: 2, maxMiss: 160 });
  lastTrackMsgs = tracks.map((t) => {
    const results = classify({
      bandwidthHz: t.bandwidthHz,
      snrDb: t.snrDb,
      duty: t.duty,
      crestDb: t.crestDb,
    });
    const best = results[0];
    return {
      id: t.id,
      offsetHz: t.offsetHz,
      centerFreqHz: t.centerFreqHz,
      bandwidthHz: t.bandwidthHz,
      snrDb: t.snrDb,
      crestDb: t.crestDb,
      duty: t.duty,
      guessKind: best.kind,
      guessLabel: labelOf(best.kind),
      guessConfidence: best.confidence,
      candidates: results.map((r) => ({
        kind: r.kind,
        label: labelOf(r.kind),
        confidence: r.confidence,
        reason: r.reason,
      })),
    };
  });
}

function labelOf(kind: string): string {
  // Avoid importing KIND_INFO twice; classifier already knows labels via candidates.
  return LABELS[kind] ?? kind;
}

const LABELS: Record<string, string> = {
  wfm: 'Broadcast FM', nfm: 'Narrowband FM', am: 'AM Voice', usb: 'SSB (Upper)',
  lsb: 'SSB (Lower)', cw: 'CW / Morse', fsk2: '2-FSK Data', ook: 'OOK / ASK',
  lora: 'LoRa (CSS)', psk: 'PSK Burst', fhss: 'Freq Hopper', radar: 'Pulsed Radar',
};

function decodeCW(audio: Float32Array, n: number) {
  if (receiver.demodMode !== 'cw') return;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(audio[i]);
    cwEnv += cwAlpha * (a - cwEnv);
    cwPeak = Math.max(cwPeak * 0.99995, cwEnv);
    const thr = cwPeak * 0.35;
    const on = cwEnv > thr;
    if (on !== cwState) {
      const dur = cwSamples / AUDIO_RATE;
      if (dur > 0.01) morseDecoder.push(cwState, dur);
      cwState = on;
      cwSamples = 0;
    } else {
      cwSamples++;
    }
  }
  const text = morseDecoder.output.slice(-40);
  if (text !== lastMorse) {
    lastMorse = text;
    post({ type: 'morse', text });
  }
}

function loop() {
  if (!running) return;
  generateBlock();
  nextTime += blockMs;
  const now = performance.now();
  if (nextTime < now - 3 * blockMs) nextTime = now; // fell behind: resync
  timer = setTimeout(loop, Math.max(0, nextTime - now));
}

function startLoop() {
  if (timer) return;
  nextTime = performance.now() + blockMs;
  timer = setTimeout(loop, blockMs);
}

function stopLoop() {
  if (timer) clearTimeout(timer);
  timer = null;
}

self.onmessage = (ev: MessageEvent<ToWorker>) => {
  const msg = ev.data;
  switch (msg.type) {
    case 'loadScene': {
      playRe = playIm = null;
      scene = new Scene(
        { sampleRate: SAMPLE_RATE, centerFreqHz: msg.scene.centerFreqHz, noiseSigma: msg.scene.noiseSigma },
        BLOCK_SIZE,
      );
      centerFreqHz = msg.scene.centerFreqHz;
      for (const cfg of msg.scene.emitters) scene.add(cfg);
      tracker.reset();
      morseDecoder.reset();
      lastMorse = '';
      specAvg.fill(-140);
      sendGroundTruth();
      break;
    }
    case 'setCenter':
      centerFreqHz = msg.hz;
      scene.setCenterFreq(msg.hz);
      tracker.reset();
      sendGroundTruth();
      break;
    case 'setTuning':
      receiver.setTuning(msg.offsetHz);
      morseDecoder.reset();
      break;
    case 'setMode':
      receiver.setMode(msg.mode);
      morseDecoder.reset();
      lastMorse = '';
      break;
    case 'setBandwidth':
      receiver.setBandwidth(msg.hz);
      break;
    case 'setSquelch':
      receiver.setSquelch(msg.db);
      break;
    case 'setNoise':
      scene.noiseSigma = msg.sigma;
      break;
    case 'addEmitter':
      scene.add(msg.cfg);
      sendGroundTruth();
      break;
    case 'removeEmitter':
      scene.remove(msg.id);
      sendGroundTruth();
      break;
    case 'clearEmitters':
      scene.clear();
      tracker.reset();
      sendGroundTruth();
      break;
    case 'setRunning':
      running = msg.running;
      if (running) startLoop();
      else stopLoop();
      break;
    case 'startRecording':
      recording = true;
      recordBuf = [];
      recordSamples = 0;
      break;
    case 'stopRecording': {
      recording = false;
      const total = recordBuf.reduce((s, b) => s + b.length, 0);
      const iq = new Float32Array(total);
      let off = 0;
      for (const b of recordBuf) {
        iq.set(b, off);
        off += b.length;
      }
      recordBuf = [];
      post(
        { type: 'recording', iq, centerFreqHz, durationSec: recordSamples / SAMPLE_RATE },
        [iq.buffer],
      );
      break;
    }
    case 'playIQ':
      playRe = msg.re;
      playIm = msg.im;
      playPos = 0;
      centerFreqHz = msg.centerFreqHz;
      tracker.reset();
      specAvg.fill(-140);
      break;
    case 'stopPlayback':
      playRe = playIm = null;
      break;
  }
};
