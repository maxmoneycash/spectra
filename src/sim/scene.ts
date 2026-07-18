import { Emitter, createEmitter, type EmitterConfig, type EmitterContext } from './emitters';
import { Rng } from './prng';

export interface SceneConfig {
  sampleRate: number;
  centerFreqHz: number;
  noiseSigma?: number;
  seed?: number;
}

/**
 * Holds the set of emitters that populate a band and renders successive blocks
 * of wideband complex baseband: sum of every emitter plus an AWGN floor.
 */
export class Scene {
  sampleRate: number;
  centerFreqHz: number;
  noiseSigma: number;
  private emitters: Emitter[] = [];
  private noiseRng: Rng;
  private ctx: EmitterContext;

  constructor(cfg: SceneConfig, maxBlock = 65536) {
    this.sampleRate = cfg.sampleRate;
    this.centerFreqHz = cfg.centerFreqHz;
    this.noiseSigma = cfg.noiseSigma ?? 0.03;
    this.noiseRng = new Rng(cfg.seed ?? 0xc0ffee);
    this.ctx = {
      sampleRate: cfg.sampleRate,
      centerFreqHz: cfg.centerFreqHz,
      scratchRe: new Float32Array(maxBlock),
      scratchIm: new Float32Array(maxBlock),
    };
  }

  add(cfg: EmitterConfig): Emitter {
    const e = createEmitter(cfg, this.sampleRate);
    this.emitters.push(e);
    return e;
  }

  remove(id: string): void {
    this.emitters = this.emitters.filter((e) => e.id !== id);
  }

  clear(): void {
    this.emitters = [];
  }

  list(): Emitter[] {
    return this.emitters;
  }

  setCenterFreq(hz: number): void {
    this.centerFreqHz = hz;
    this.ctx.centerFreqHz = hz;
  }

  /** True ground-truth descriptors of every emitter (for detection scoring). */
  groundTruth() {
    return this.emitters.map((e) => ({
      id: e.id,
      kind: e.kind,
      label: e.label,
      freqHz: e.freqHz,
      offsetHz: e.freqHz - this.centerFreqHz,
      bandwidthHz: e.bandwidthHz,
      powerDb: e.powerDb,
    }));
  }

  /** Render one block into the provided band buffers. */
  generate(bandRe: Float32Array, bandIm: Float32Array, len: number): void {
    bandRe.fill(0, 0, len);
    bandIm.fill(0, 0, len);
    this.ctx.centerFreqHz = this.centerFreqHz;
    for (const e of this.emitters) {
      e.render(bandRe, bandIm, len, this.ctx);
    }
    const sigma = this.noiseSigma;
    if (sigma > 0) {
      const rng = this.noiseRng;
      for (let i = 0; i < len; i++) {
        bandRe[i] += rng.gaussian() * sigma;
        bandIm[i] += rng.gaussian() * sigma;
      }
    }
  }
}
