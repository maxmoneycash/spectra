import { describe, expect, it } from 'vitest';
import { Scene } from '../sim/scene';
import { Receiver } from './receiver';
import { MorseDecoder } from '../sim/morse';
import { CwKeyer } from './cwKeyer';
import type { EmitterConfig } from '../sim/emitters';

const SR = 1_152_000;
const BLOCK = 16384;
const MHZ = 1e6;

/** Scene → CW receiver → keyer → decoder, for `sec` seconds; returns the copy. */
function copy(o: {
  center: number;
  noise: number;
  emitters: EmitterConfig[];
  tune: number;
  bw?: number;
  sec: number;
}): string {
  const scene = new Scene({ sampleRate: SR, centerFreqHz: o.center, noiseSigma: o.noise });
  for (const e of o.emitters) scene.add(e);
  const rx = new Receiver(SR);
  rx.setMode('cw');
  rx.setBandwidth(o.bw ?? 500);
  rx.setTuning(o.tune);
  rx.setSquelch(-120);
  const re = new Float32Array(BLOCK);
  const im = new Float32Array(BLOCK);
  const audio = new Float32Array(4096);
  const dec = new MorseDecoder();
  const keyer = new CwKeyer((on, d) => dec.push(on, d));
  for (let b = 0; b < Math.round((o.sec * SR) / BLOCK); b++) {
    scene.generate(re, im, BLOCK);
    keyer.process(audio, rx.process(re, im, BLOCK, audio));
  }
  return dec.output.replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

const PAIR: EmitterConfig[] = [
  { id: 'flag', kind: 'cw', freqHz: 14.02 * MHZ, powerDb: -5, wpm: 15, text: 'DE SPECTRA NARROW FILTER  ', seed: 501 },
  { id: 'decoy', kind: 'cw', freqHz: 14.02035 * MHZ, powerDb: -5, wpm: 15, text: 'VVV VVV TEST DE TEST  ', seed: 502 },
];

describe('CW keyer', { timeout: 90_000 }, () => {
  it('prints nothing on an empty channel', () => {
    // The old keyer's threshold decayed into the noise with nothing to hear.
    expect(copy({ center: 7.05 * MHZ, noise: 0.02, emitters: [], tune: 0, sec: 15 })).toBe('');
  });

  it('copies a −26 dB beacon', () => {
    const out = copy({
      center: 3.56 * MHZ, noise: 0.02, tune: 5_000, sec: 13,
      emitters: [{ id: 'qrp', kind: 'cw', freqHz: 3.565 * MHZ, powerDb: -26, wpm: 14, text: 'QRP TEST DE TRAINEE  ', seed: 931 }],
    });
    expect(out).toContain('TRAINEE');
  });

  it('makes Split the Pair need both narrowing and centring', () => {
    // The tracker bridges the two carriers into one detection, so a tap lands
    // between them (+175 Hz). At the stock width that is garbage; narrowed but
    // uncentred it is quiet; centred on the flag it copies clean.
    const stockBetween = copy({ center: 14.02 * MHZ, noise: 0.028, emitters: PAIR, tune: 175, bw: 500, sec: 12 });
    expect(stockBetween).not.toContain('NARROW FILTER');
    const narrowBetween = copy({ center: 14.02 * MHZ, noise: 0.028, emitters: PAIR, tune: 175, bw: 200, sec: 12 });
    expect(narrowBetween).not.toContain('NARROW FILTER');
    const centred = copy({ center: 14.02 * MHZ, noise: 0.028, emitters: PAIR, tune: 0, bw: 200, sec: 17 });
    expect(centred).toContain('DE SPECTRA NARROW FILTER');
  });
});
