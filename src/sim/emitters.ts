import { ComplexOsc } from '../dsp/oscillator';
import { KIND_INFO, type SignalKind } from './signal-kinds';
import { Rng } from './prng';
import {
  MessagePump,
  AnalyticMessage,
  ComplexPump,
} from './modulation';
import {
  VoiceMessage,
  MusicMessage,
  ToneMessage,
  type Message,
} from './messages';
import { encodeMorse } from './morse';

export interface EmitterContext {
  sampleRate: number;
  centerFreqHz: number;
  scratchRe: Float32Array;
  scratchIm: Float32Array;
}

export interface EmitterConfig {
  id: string;
  kind: SignalKind;
  /** Absolute RF centre frequency in Hz. */
  freqHz: number;
  /** Relative power in dB (0 = strong reference signal). */
  powerDb?: number;
  label?: string;
  seed?: number;
  // Analog options
  message?: 'voice' | 'music' | 'tone';
  devHz?: number;
  depth?: number;
  // Keying / data options
  text?: string;
  wpm?: number;
  baud?: number;
  // Spread / burst options
  hopSpanHz?: number;
  dwellMs?: number;
  sf?: number;
  bwHz?: number;
  symRate?: number;
  // Radar
  priUs?: number;
  pulseUs?: number;
}

function makeMessage(kind: 'voice' | 'music' | 'tone', rng: Rng): Message {
  switch (kind) {
    case 'music':
      return new MusicMessage(rng);
    case 'tone':
      return new ToneMessage(1000, 1600);
    case 'voice':
    default:
      return new VoiceMessage(rng);
  }
}

/** Base class: handles up-conversion into the shared band buffer. */
export abstract class Emitter {
  readonly id: string;
  readonly kind: SignalKind;
  freqHz: number;
  powerDb: number;
  label: string;
  protected rng: Rng;
  protected osc = new ComplexOsc();
  protected sampleRate: number;
  /** Elapsed samples since creation (block-start time inside generateBaseband). */
  protected t = 0;

  constructor(cfg: EmitterConfig, sampleRate: number) {
    this.id = cfg.id;
    this.kind = cfg.kind;
    this.freqHz = cfg.freqHz;
    this.powerDb = cfg.powerDb ?? 0;
    this.label = cfg.label ?? KIND_INFO[cfg.kind].label;
    this.rng = new Rng(cfg.seed ?? 0x1234 ^ Math.round(cfg.freqHz));
    this.sampleRate = sampleRate;
  }

  get amplitude(): number {
    return Math.pow(10, this.powerDb / 20);
  }

  get bandwidthHz(): number {
    return KIND_INFO[this.kind].bandwidthHz;
  }

  render(
    bandRe: Float32Array,
    bandIm: Float32Array,
    len: number,
    ctx: EmitterContext,
  ): void {
    const offset = this.freqHz - ctx.centerFreqHz;
    if (Math.abs(offset) > ctx.sampleRate * 0.5) {
      this.t += len;
      return;
    }
    this.osc.setFrequency(offset, ctx.sampleRate);
    this.generateBaseband(ctx.scratchRe, ctx.scratchIm, len, ctx);
    this.osc.mixAdd(ctx.scratchRe, ctx.scratchIm, bandRe, bandIm, len, this.amplitude);
    this.t += len;
  }

  protected abstract generateBaseband(
    re: Float32Array,
    im: Float32Array,
    len: number,
    ctx: EmitterContext,
  ): void;
}

/** WFM / NFM — constant-envelope frequency modulation. */
class FMEmitter extends Emitter {
  private pump: MessagePump;
  private phase = 0;
  private dev: number;
  private drive: number;

  constructor(cfg: EmitterConfig, sr: number) {
    super(cfg, sr);
    const msgKind = cfg.message ?? (cfg.kind === 'wfm' ? 'music' : 'voice');
    this.pump = new MessagePump(makeMessage(msgKind, this.rng), sr);
    this.dev = cfg.devHz ?? (cfg.kind === 'wfm' ? 75_000 : 3_500);
    // Broadcast FM audio is heavily compressed so it fills the channel
    // consistently; emulate that so WFM reads as a solid ~180 kHz block.
    this.drive = cfg.kind === 'wfm' ? 3.0 : 1.15;
  }

  protected generateBaseband(re: Float32Array, im: Float32Array, len: number): void {
    const k = (2 * Math.PI * this.dev) / this.sampleRate;
    const drive = this.drive;
    let ph = this.phase;
    for (let i = 0; i < len; i++) {
      const m = Math.tanh(this.pump.next() * drive);
      ph += k * m;
      if (ph > Math.PI) ph -= 2 * Math.PI;
      else if (ph < -Math.PI) ph += 2 * Math.PI;
      re[i] = Math.cos(ph);
      im[i] = Math.sin(ph);
    }
    this.phase = ph;
  }
}

/** AM — carrier plus double-sideband audio. */
class AMEmitter extends Emitter {
  private pump: MessagePump;
  private depth: number;

  constructor(cfg: EmitterConfig, sr: number) {
    super(cfg, sr);
    this.pump = new MessagePump(makeMessage(cfg.message ?? 'voice', this.rng), sr);
    this.depth = cfg.depth ?? 0.6;
  }

  protected generateBaseband(re: Float32Array, im: Float32Array, len: number): void {
    const d = this.depth;
    for (let i = 0; i < len; i++) {
      re[i] = 0.5 * (1 + d * this.pump.next());
      im[i] = 0;
    }
  }
}

/** SSB — suppressed-carrier single sideband via the phasing method. */
class SSBEmitter extends Emitter {
  private pump: ComplexPump;
  private sign: number;
  private tmp: [number, number] = [0, 0];

  constructor(cfg: EmitterConfig, sr: number) {
    super(cfg, sr);
    const analytic = new AnalyticMessage(makeMessage(cfg.message ?? 'voice', this.rng));
    this.pump = new ComplexPump(analytic, sr);
    this.sign = cfg.kind === 'usb' ? 1 : -1;
  }

  protected generateBaseband(re: Float32Array, im: Float32Array, len: number): void {
    const g = 1.4;
    for (let i = 0; i < len; i++) {
      this.pump.next(this.tmp);
      re[i] = this.tmp[0] * g;
      im[i] = this.sign * this.tmp[1] * g;
    }
  }
}

/** CW — on/off keyed Morse carrier with soft edges. */
class CWEmitter extends Emitter {
  private durs: number[]; // segment durations in samples
  private ons: boolean[];
  private seg = 0;
  private segLeft = 0;
  private env = 0;
  private alpha: number;

  constructor(cfg: EmitterConfig, sr: number) {
    super(cfg, sr);
    const call = cfg.text ?? this.randomCall();
    const wpm = cfg.wpm ?? 18;
    const segs = encodeMorse(`${call}  `, wpm);
    this.durs = segs.map((s) => Math.max(1, Math.round(s.durSec * sr)));
    this.ons = segs.map((s) => s.on);
    this.segLeft = this.durs[0] ?? 1;
    this.alpha = 1 - Math.exp(-1 / (0.004 * sr)); // ~4 ms edge
  }

  private randomCall(): string {
    const pfx = this.rng.pick(['W', 'K', 'N', 'VE', 'G', 'DL']);
    const num = this.rng.int(0, 9);
    let sfx = '';
    for (let i = 0; i < this.rng.int(2, 3); i++) {
      sfx += String.fromCharCode(65 + this.rng.int(0, 25));
    }
    return `CQ CQ DE ${pfx}${num}${sfx}`;
  }

  protected generateBaseband(re: Float32Array, im: Float32Array, len: number): void {
    for (let i = 0; i < len; i++) {
      if (this.segLeft <= 0) {
        this.seg = (this.seg + 1) % this.durs.length;
        this.segLeft = this.durs[this.seg];
      }
      this.segLeft--;
      const target = this.ons[this.seg] ? 1 : 0;
      this.env += (target - this.env) * this.alpha;
      re[i] = this.env;
      im[i] = 0;
    }
  }
}

/** 2-FSK — continuous-phase binary FSK, transmitted in packets. */
class FSK2Emitter extends Emitter {
  private phase = 0;
  private dev: number;
  private samplesPerBit: number;
  private inPacket = false;
  private wait = 0;
  private bitsLeft = 0;
  private bitLeft = 0;
  private bit = 0;

  constructor(cfg: EmitterConfig, sr: number) {
    super(cfg, sr);
    this.dev = cfg.devHz ?? 4_000;
    this.samplesPerBit = Math.max(1, Math.round(sr / (cfg.baud ?? 2_400)));
    this.wait = this.rng.int(Math.round(0.2 * sr), Math.round(1.0 * sr));
  }

  protected generateBaseband(re: Float32Array, im: Float32Array, len: number): void {
    const k = (2 * Math.PI * this.dev) / this.sampleRate;
    for (let i = 0; i < len; i++) {
      if (!this.inPacket) {
        re[i] = 0;
        im[i] = 0;
        if (--this.wait <= 0) {
          this.inPacket = true;
          this.bitsLeft = this.rng.int(48, 140);
          this.bitLeft = 0;
        }
        continue;
      }
      if (this.bitLeft <= 0) {
        if (this.bitsLeft <= 0) {
          this.inPacket = false;
          this.wait = this.rng.int(Math.round(0.3 * this.sampleRate), Math.round(1.4 * this.sampleRate));
          re[i] = 0;
          im[i] = 0;
          continue;
        }
        this.bit = this.rng.bool() ? 1 : -1;
        this.bitsLeft--;
        this.bitLeft = this.samplesPerBit;
      }
      this.bitLeft--;
      this.phase += this.bit * k;
      if (this.phase > Math.PI) this.phase -= 2 * Math.PI;
      else if (this.phase < -Math.PI) this.phase += 2 * Math.PI;
      re[i] = Math.cos(this.phase);
      im[i] = Math.sin(this.phase);
    }
  }
}

/** OOK / ASK — on/off keyed data bursts (ISM sensors, remotes). */
class OOKEmitter extends Emitter {
  private samplesPerBit: number;
  private inPacket = false;
  private wait = 0;
  private bitsLeft = 0;
  private bitLeft = 0;
  private bit = 0;
  private env = 0;
  private alpha: number;

  constructor(cfg: EmitterConfig, sr: number) {
    super(cfg, sr);
    this.samplesPerBit = Math.max(1, Math.round(sr / (cfg.baud ?? 2_000)));
    this.wait = this.rng.int(Math.round(0.1 * sr), Math.round(0.8 * sr));
    this.alpha = 1 - Math.exp(-1 / (0.00015 * sr)); // fast ~0.15 ms edges
  }

  protected generateBaseband(re: Float32Array, im: Float32Array, len: number): void {
    for (let i = 0; i < len; i++) {
      if (!this.inPacket) {
        if (--this.wait <= 0) {
          this.inPacket = true;
          this.bitsLeft = this.rng.int(24, 64);
          this.bitLeft = 0;
        }
        this.bit = 0;
      } else if (this.bitLeft <= 0) {
        if (this.bitsLeft <= 0) {
          this.inPacket = false;
          this.wait = this.rng.int(Math.round(0.8 * this.sampleRate), Math.round(2.5 * this.sampleRate));
          this.bit = 0;
        } else {
          this.bit = this.rng.bool(0.55) ? 1 : 0;
          this.bitsLeft--;
          this.bitLeft = this.samplesPerBit;
        }
      }
      if (this.bitLeft > 0) this.bitLeft--;
      this.env += (this.bit - this.env) * this.alpha;
      re[i] = this.env;
      im[i] = 0;
    }
  }
}

/** LoRa — chirp spread spectrum: cyclically-shifted up-chirps in packets. */
class LoRaEmitter extends Emitter {
  private bw: number;
  private n: number; // symbols per full sweep = 2^SF
  private samplesPerSym: number;
  private phase = 0;
  private symPos = 0;
  private code = 0;
  private preambleLeft = 0;
  private symbolsLeft = 0;
  private inPacket = false;
  private wait = 0;

  constructor(cfg: EmitterConfig, sr: number) {
    super(cfg, sr);
    this.bw = cfg.bwHz ?? 125_000;
    const sf = cfg.sf ?? 8;
    this.n = 1 << sf;
    this.samplesPerSym = Math.round((this.n / this.bw) * sr);
    this.wait = this.rng.int(Math.round(0.2 * sr), Math.round(1.0 * sr));
  }

  private startSymbol(): void {
    if (this.preambleLeft > 0) {
      this.code = 0;
      this.preambleLeft--;
    } else {
      this.code = this.rng.int(0, this.n - 1);
      this.symbolsLeft--;
    }
    this.symPos = 0;
  }

  protected generateBaseband(re: Float32Array, im: Float32Array, len: number): void {
    for (let i = 0; i < len; i++) {
      if (!this.inPacket) {
        re[i] = 0;
        im[i] = 0;
        if (--this.wait <= 0) {
          this.inPacket = true;
          this.preambleLeft = 6;
          this.symbolsLeft = this.rng.int(6, 16);
          this.startSymbol();
        }
        continue;
      }
      if (this.symPos >= this.samplesPerSym) {
        if (this.symbolsLeft <= 0 && this.preambleLeft <= 0) {
          this.inPacket = false;
          this.wait = this.rng.int(Math.round(0.4 * this.sampleRate), Math.round(1.6 * this.sampleRate));
          this.phase = 0;
          re[i] = 0;
          im[i] = 0;
          continue;
        }
        this.startSymbol();
      }
      const frac = this.symPos / this.samplesPerSym;
      let u = this.code / this.n + frac;
      u -= Math.floor(u);
      const instFreq = (u - 0.5) * this.bw;
      this.phase += (2 * Math.PI * instFreq) / this.sampleRate;
      if (this.phase > Math.PI) this.phase -= 2 * Math.PI;
      else if (this.phase < -Math.PI) this.phase += 2 * Math.PI;
      re[i] = Math.cos(this.phase);
      im[i] = Math.sin(this.phase);
      this.symPos++;
    }
  }
}

/** PSK — QPSK-style digital burst with linearly-interpolated symbol shaping. */
class PSKEmitter extends Emitter {
  private symStep: number;
  private symAcc = 1; // force a new symbol on first sample
  private pr = 0;
  private pi = 0;
  private cr = 0;
  private ci = 0;
  private inPacket = false;
  private wait = 0;
  private symbolsLeft = 0;

  constructor(cfg: EmitterConfig, sr: number) {
    super(cfg, sr);
    this.symStep = (cfg.symRate ?? 90_000) / sr;
    this.wait = this.rng.int(Math.round(0.2 * sr), Math.round(0.9 * sr));
  }

  private nextSymbol(): void {
    this.pr = this.cr;
    this.pi = this.ci;
    if (this.symbolsLeft > 0) {
      const q = this.rng.int(0, 3);
      const ang = (Math.PI / 4) * (2 * q + 1);
      this.cr = Math.cos(ang);
      this.ci = Math.sin(ang);
      this.symbolsLeft--;
    } else {
      this.cr = 0;
      this.ci = 0;
    }
  }

  protected generateBaseband(re: Float32Array, im: Float32Array, len: number): void {
    for (let i = 0; i < len; i++) {
      if (!this.inPacket) {
        re[i] = 0;
        im[i] = 0;
        if (--this.wait <= 0) {
          this.inPacket = true;
          this.symbolsLeft = this.rng.int(200, 800);
          this.symAcc = 1;
          this.cr = 0;
          this.ci = 0;
        }
        continue;
      }
      this.symAcc += this.symStep;
      while (this.symAcc >= 1) {
        this.symAcc -= 1;
        this.nextSymbol();
        if (this.symbolsLeft <= 0 && this.cr === 0 && this.ci === 0) {
          this.inPacket = false;
          this.wait = this.rng.int(Math.round(0.3 * this.sampleRate), Math.round(1.2 * this.sampleRate));
        }
      }
      re[i] = this.pr + this.symAcc * (this.cr - this.pr);
      im[i] = this.pi + this.symAcc * (this.ci - this.pi);
    }
  }
}

/** FHSS — narrow carrier hopping pseudo-randomly across a set of channels. */
class FHSSEmitter extends Emitter {
  private hops: number[];
  private dwell: number;

  constructor(cfg: EmitterConfig, sr: number) {
    super(cfg, sr);
    const span = cfg.hopSpanHz ?? 700_000;
    const channels = 24;
    this.hops = [];
    for (let i = 0; i < channels; i++) {
      this.hops.push(this.freqHz - span / 2 + (span * i) / (channels - 1));
    }
    this.dwell = Math.max(1, Math.round(((cfg.dwellMs ?? 40) / 1000) * sr));
  }

  private hopFreq(index: number): number {
    const h = (Math.imul(index + 1, 2654435761) >>> 0) % this.hops.length;
    return this.hops[h];
  }

  override render(
    bandRe: Float32Array,
    bandIm: Float32Array,
    len: number,
    ctx: EmitterContext,
  ): void {
    const hopIndex = Math.floor(this.t / this.dwell);
    // Some hops are silent (transmitter idle), giving a sparse look.
    const active = (Math.imul(hopIndex + 7, 40503) >>> 0) % 5 !== 0;
    const freq = this.hopFreq(hopIndex);
    const offset = freq - ctx.centerFreqHz;
    if (active && Math.abs(offset) <= ctx.sampleRate * 0.5) {
      this.osc.setFrequency(offset, ctx.sampleRate);
      const re = ctx.scratchRe;
      const im = ctx.scratchIm;
      for (let i = 0; i < len; i++) {
        re[i] = 1;
        im[i] = 0;
      }
      this.osc.mixAdd(re, im, bandRe, bandIm, len, this.amplitude);
    }
    this.t += len;
  }

  protected generateBaseband(): void {
    // Unused: render() is overridden.
  }
}

/** Pulsed radar — periodic linear-FM (chirped) pulses. */
class RadarEmitter extends Emitter {
  private pri: number;
  private pulse: number;
  private bw: number;
  private phase = 0;

  constructor(cfg: EmitterConfig, sr: number) {
    super(cfg, sr);
    this.pri = Math.max(1, Math.round(((cfg.priUs ?? 2000) / 1e6) * sr));
    this.pulse = Math.max(1, Math.round(((cfg.pulseUs ?? 80) / 1e6) * sr));
    this.bw = cfg.bwHz ?? KIND_INFO.radar.bandwidthHz;
  }

  protected generateBaseband(re: Float32Array, im: Float32Array, len: number): void {
    for (let i = 0; i < len; i++) {
      const posInPri = (this.t + i) % this.pri;
      if (posInPri < this.pulse) {
        if (posInPri === 0) this.phase = 0;
        const frac = posInPri / this.pulse;
        const instFreq = (-this.bw / 2) + this.bw * frac;
        this.phase += (2 * Math.PI * instFreq) / this.sampleRate;
        // Soft envelope to limit spectral splatter at the edges.
        const edge = Math.min(frac, 1 - frac) * 8;
        const env = edge < 1 ? edge : 1;
        re[i] = Math.cos(this.phase) * env;
        im[i] = Math.sin(this.phase) * env;
      } else {
        re[i] = 0;
        im[i] = 0;
      }
    }
  }
}

const REGISTRY: Record<SignalKind, new (cfg: EmitterConfig, sr: number) => Emitter> = {
  wfm: FMEmitter,
  nfm: FMEmitter,
  am: AMEmitter,
  usb: SSBEmitter,
  lsb: SSBEmitter,
  cw: CWEmitter,
  fsk2: FSK2Emitter,
  ook: OOKEmitter,
  lora: LoRaEmitter,
  psk: PSKEmitter,
  fhss: FHSSEmitter,
  radar: RadarEmitter,
};

export function createEmitter(cfg: EmitterConfig, sampleRate: number): Emitter {
  const Cls = REGISTRY[cfg.kind];
  return new Cls(cfg, sampleRate);
}
