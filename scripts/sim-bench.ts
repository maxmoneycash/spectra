/**
 * Opt-in scene generation benchmark. Run with npm run bench:sim on an idle
 * machine; compare repeated runs on the same machine and Node version.
 * Wall-clock throughput is deliberately separate from correctness tests.
 */
import { cpus } from 'node:os';
import { performance } from 'node:perf_hooks';
import { Scene } from '../src/sim/scene';

const sampleRate = 1_024_000;
const blockSize = 32_768;
const blocks = Math.ceil(sampleRate / blockSize);
const samples = blocks * blockSize;
const simulatedMs = (samples / sampleRate) * 1000;
const kinds = ['wfm', 'wfm', 'nfm', 'am', 'usb', 'cw', 'fsk2', 'ook', 'lora', 'psk', 'fhss', 'radar'] as const;

function measure(): number {
  const scene = new Scene({ sampleRate, centerFreqHz: 100_000_000, noiseSigma: 0.03, seed: 42 });
  kinds.forEach((kind, i) => {
    scene.add({ id: `e${i}`, kind, freqHz: 100_000_000 - 450_000 + i * 80_000, powerDb: -3, seed: i + 1 });
  });
  const re = new Float32Array(blockSize);
  const im = new Float32Array(blockSize);
  const start = performance.now();
  for (let b = 0; b < blocks; b++) scene.generate(re, im, blockSize);
  return performance.now() - start;
}

measure(); // Warm the JIT before collecting five independent, seeded runs.
const elapsedMs = Array.from({ length: 5 }, measure);
const medianMs = [...elapsedMs].sort((a, b) => a - b)[Math.floor(elapsedMs.length / 2)];
console.log(JSON.stringify({
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  cpu: cpus()[0]?.model ?? 'unknown',
  sampleRate,
  emitters: kinds.length,
  samples,
  simulatedMs,
  elapsedMs,
  medianMs,
  realtimeFactor: medianMs / simulatedMs,
  note: 'A real-time factor below 1 means generation exceeded real-time speed in this run. This measures scene synthesis in Node, not browser audio or rendering.',
}, null, 2));
