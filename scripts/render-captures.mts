/**
 * Render a simulator scene to a SigMF capture, so the capture importer can be
 * exercised — and so forensics missions can ship captures with a known answer
 * while never containing a recording of real traffic.
 *
 * Run:  npx vite-node scripts/render-captures.mts --scene first-light --seconds 15 --format cu8
 *       --scene takes a Tasking mission id or a scenario id.
 *       --out   output directory (default public/captures)
 *       --rate  render rate in Hz (default the engine's 1152000; e.g. 2400000 to test resampling)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Scene } from '../src/sim/scene';
import { SAMPLE_RATE, BLOCK_SIZE } from '../src/engine/protocol';
import { challengeById, toSceneSpec as missionSpec } from '../src/ctf/challenges';
import { scenarioById, toSceneSpec as scenarioSpec } from '../src/scenarios/scenarios';
import { ENCODE_SCALE, encodeSamples, type CaptureDatatype } from '../src/capture/decode';

function arg(name: string, dflt: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

const id = arg('scene', 'first-light');
const seconds = Number(arg('seconds', '15'));
const format = arg('format', 'cu8') as CaptureDatatype;
const rate = Number(arg('rate', String(SAMPLE_RATE)));
const out = arg('out', 'public/captures');

const mission = challengeById(id);
const scenario = mission ? null : scenarioById(id);
if (!mission && !scenario) {
  console.error(`No mission or scenario called "${id}".`);
  process.exit(1);
}
const spec = mission ? missionSpec(mission) : scenarioSpec(scenario!);
const name = mission ? mission.name : scenario!.name;

const scene = new Scene({ sampleRate: rate, centerFreqHz: spec.centerFreqHz, noiseSigma: spec.noiseSigma, seed: 7 }, BLOCK_SIZE);
for (const cfg of spec.emitters) scene.add(cfg);

const total = Math.round(seconds * rate);
const re = new Float32Array(BLOCK_SIZE);
const im = new Float32Array(BLOCK_SIZE);
const parts: Uint8Array[] = [];
let done = 0;
while (done < total) {
  const n = Math.min(BLOCK_SIZE, total - done);
  scene.generate(re, im, n);
  parts.push(new Uint8Array(encodeSamples(re.subarray(0, n), im.subarray(0, n), format)));
  done += n;
}
const bytes = parts.reduce((s, p) => s + p.length, 0);
const data = new Uint8Array(bytes);
let off = 0;
for (const p of parts) {
  data.set(p, off);
  off += p.length;
}

mkdirSync(out, { recursive: true });
const base = join(out, id);
writeFileSync(`${base}.sigmf-data`, data);
writeFileSync(
  `${base}.sigmf-meta`,
  JSON.stringify(
    {
      global: {
        'core:datatype': format,
        'core:sample_rate': rate,
        'core:version': '1.0.0',
        'core:description': `SPECTRA simulator render of "${name}" — synthetic, no real traffic. Integer samples are the simulator band × ${ENCODE_SCALE} (headroom; the band sums past ±1).`,
        'core:recorder': 'SPECTRA scripts/render-captures.mts',
      },
      captures: [{ 'core:sample_start': 0, 'core:frequency': spec.centerFreqHz }],
      annotations: [],
    },
    null,
    2,
  ),
);
console.log(`${id}: ${seconds}s @ ${rate} Hz as ${format} → ${(bytes / 1e6).toFixed(1)} MB  (${base}.sigmf-data/-meta)`);
