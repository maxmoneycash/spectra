/**
 * Dump the keyed on/off intervals of one NCDXF power-on start against the
 * ideal keying, to see exactly where a keyer goes wrong.
 *
 *   ./node_modules/.bin/vite-node scripts/keyer-dump.ts [candidate.ts]
 */
import { Scene } from '../src/sim/scene';
import { Receiver } from '../src/dsp/receiver';
import { MorseDecoder, encodeMorse } from '../src/sim/morse';
import { CwKeyer } from '../src/dsp/cwKeyer';
import { activeBeacon, beaconText, SLOT_MS } from '../src/sim/ncdxf';
const variant = process.argv[2];
const makeKeyer = variant ? (await import(variant)).default : (cb: any) => new CwKeyer(cb);
const SR = 1_152_000, BLOCK = 16384;
const t0 = Math.floor(Date.now() / SLOT_MS) * SLOT_MS + 1000; Date.now = () => t0;
const b = activeBeacon(0, t0);
const scene = new Scene({ sampleRate: SR, centerFreqHz: 14.1e6, noiseSigma: 0.028 });
scene.add({ id: 'ncdxf-live', kind: 'cw', freqHz: 14.1e6, powerDb: -4, ncdxfBand: 0 });
const rx = new Receiver(SR); rx.setMode('cw'); rx.setBandwidth(500); rx.setTuning(0); rx.setSquelch(-80);
const re = new Float32Array(BLOCK), im = new Float32Array(BLOCK), audio = new Float32Array(4096);
const dec = new MorseDecoder(); let t = 0; const rows: string[] = [];
const keyer = makeKeyer((on: boolean, d: number) => { rows.push(`${on ? 'ON ' : 'off'} ${(d * 1000).toFixed(0).padStart(4)}ms  @${t.toFixed(2)}s`); t += d; dec.push(on, d); });
for (let k = 0; k < Math.round(3.2 * SR / BLOCK); k++) { scene.generate(re, im, BLOCK); keyer.process(audio, rx.process(re, im, BLOCK, audio)); }
const ideal = encodeMorse(beaconText(b), 22).slice(0, 12).map((s) => `${s.on ? 'ON ' : 'off'} ${(s.durSec * 1000).toFixed(0)}ms`).join(' | ');
console.log(`beacon ${b.call}: silence 550 ms, then ideal: ${ideal}`);
console.log(`decoded: ${JSON.stringify(dec.output)}`);
console.log(rows.slice(0, 26).join('\n'));
