import { ComplexOsc } from './oscillator';
import { ComplexFIR, designLowpass } from './fir';
import { FIRDecimator } from './decimator';
import type { DemodMode } from '../sim/signal-kinds';

export const AUDIO_RATE = 48000;

/**
 * Software-defined receiver: takes wideband complex baseband at the SDR sample
 * rate and produces demodulated audio at 48 kHz for the currently tuned VFO.
 *
 * Chain: complex mix to DC → decimate → channel filter → per-mode demodulator
 * → de-emphasis / AGC / squelch. WFM uses a wider IF (192 kHz) with a second
 * audio-rate decimation; all other modes decimate straight to 48 kHz.
 */
export class Receiver {
  readonly sampleRate: number;
  private mode: DemodMode = 'nfm';
  private offsetHz = 0;
  private bandwidthHz = 12_000;

  private readonly tuner: ComplexOsc;

  // Decimation
  private ifRate = AUDIO_RATE;
  private decim!: FIRDecimator;
  private audioDecim: FIRDecimator | null = null;

  // Channel filter (non-WFM), rebuilt on bandwidth change
  private chan!: ComplexFIR;

  // Weaver SSB oscillators + CW BFO
  private wOsc1 = new ComplexOsc();
  private wOsc2 = new ComplexOsc();
  private ssbFilter!: ComplexFIR;

  // FM demod state
  private fmPrevRe = 1;
  private fmPrevIm = 0;
  private deemph = 0;
  private deemphA = 0;

  // AM DC blocker
  private amDc = 0;

  // AGC + squelch
  private agcGain = 1;
  private squelchDb = -140;
  private signalDb = -140;
  private muteRamp = 1;

  // Channel-IQ tap for the UI's IQ scope (post-channel-filter, pre-demod).
  static readonly TAP_LEN = 256;
  readonly tapRe = new Float32Array(Receiver.TAP_LEN);
  readonly tapIm = new Float32Array(Receiver.TAP_LEN);
  tapCount = 0;

  // Scratch buffers
  private txRe: Float32Array;
  private txIm: Float32Array;
  private ifRe: Float32Array;
  private ifIm: Float32Array;
  private cfRe: Float32Array;
  private cfIm: Float32Array;
  private demodBuf: Float32Array;
  private zeros: Float32Array;
  private trash: Float32Array;

  constructor(sampleRate: number, maxBlock = 65536) {
    this.sampleRate = sampleRate;
    this.tuner = new ComplexOsc(0, sampleRate);
    this.txRe = new Float32Array(maxBlock);
    this.txIm = new Float32Array(maxBlock);
    this.ifRe = new Float32Array(maxBlock);
    this.ifIm = new Float32Array(maxBlock);
    this.cfRe = new Float32Array(maxBlock);
    this.cfIm = new Float32Array(maxBlock);
    this.demodBuf = new Float32Array(maxBlock);
    this.zeros = new Float32Array(maxBlock);
    this.trash = new Float32Array(maxBlock);
    this.buildChain();
  }

  get tuning(): number {
    return this.offsetHz;
  }
  get demodMode(): DemodMode {
    return this.mode;
  }
  get bandwidth(): number {
    return this.bandwidthHz;
  }
  get level(): number {
    return this.signalDb;
  }

  setTuning(offsetHz: number): void {
    this.offsetHz = offsetHz;
  }

  setSquelch(db: number): void {
    this.squelchDb = db;
  }

  setMode(mode: DemodMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.buildChain();
  }

  setBandwidth(hz: number): void {
    if (hz === this.bandwidthHz) return;
    this.bandwidthHz = hz;
    this.buildChain();
  }

  private buildChain(): void {
    const Fs = this.sampleRate;
    if (this.mode === 'wfm') {
      this.ifRate = 192_000;
      const d1 = Math.round(Fs / this.ifRate);
      this.decim = new FIRDecimator(designLowpass(385, 0.075), d1);
      this.audioDecim = new FIRDecimator(
        designLowpass(129, 15_000 / this.ifRate),
        Math.round(this.ifRate / AUDIO_RATE),
      );
      this.deemphA = 1 - Math.exp(-1 / (75e-6 * this.ifRate));
    } else {
      this.ifRate = AUDIO_RATE;
      const d1 = Math.round(Fs / AUDIO_RATE);
      this.decim = new FIRDecimator(designLowpass(385, 20_000 / Fs), d1);
      this.audioDecim = null;
      this.deemphA = 1 - Math.exp(-1 / (75e-6 * AUDIO_RATE));
    }

    // Channel filter at the IF/audio rate.
    const half = Math.max(300, this.bandwidthHz / 2);
    const cutoff = Math.min(0.45, half / this.ifRate);
    const taps = this.mode === 'wfm' ? 63 : 187;
    this.chan = new ComplexFIR(designLowpass(taps, cutoff, 'hamming'));

    // SSB Weaver setup.
    const fc = Math.max(300, this.bandwidthHz / 2);
    const usb = this.mode === 'usb' || this.mode === 'cw';
    // CW uses a fixed 650 Hz beat note; SSB centres on the sideband.
    const shift = this.mode === 'cw' ? 650 : fc;
    this.wOsc1.setFrequency(usb ? -shift : shift, AUDIO_RATE);
    this.wOsc2.setFrequency(usb ? shift : -shift, AUDIO_RATE);
    const ssbCut = this.mode === 'cw' ? 500 / AUDIO_RATE : (fc + 200) / AUDIO_RATE;
    this.ssbFilter = new ComplexFIR(designLowpass(187, Math.min(0.45, ssbCut), 'hamming'));
  }

  /** Process one wideband block; writes audio (48 kHz) to `audioOut`, returns count. */
  process(
    bandRe: Float32Array,
    bandIm: Float32Array,
    len: number,
    audioOut: Float32Array,
  ): number {
    // 1. Tune the VFO to DC.
    this.tuner.setFrequency(-this.offsetHz, this.sampleRate);
    this.tuner.mix(bandRe, bandIm, this.txRe, this.txIm, len);

    // 2. Decimate to the IF rate.
    const n1 = this.decim.process(this.txRe, this.txIm, this.ifRe, this.ifIm, len);

    // 3. Channel filter + measure power for squelch/meter.
    this.chan.process(this.ifRe, this.ifIm, this.cfRe, this.cfIm, n1);
    // Tap the filtered channel for the IQ scope before demod reuses the buffers.
    this.tapCount = Math.min(Receiver.TAP_LEN, n1);
    this.tapRe.set(this.cfRe.subarray(0, this.tapCount));
    this.tapIm.set(this.cfIm.subarray(0, this.tapCount));
    let p = 0;
    for (let i = 0; i < n1; i++) p += this.cfRe[i] * this.cfRe[i] + this.cfIm[i] * this.cfIm[i];
    const rms = Math.sqrt(p / Math.max(1, n1));
    const instDb = 20 * Math.log10(rms + 1e-9);
    this.signalDb = this.signalDb + 0.3 * (instDb - this.signalDb);

    // 4. Demodulate.
    let count = n1;
    switch (this.mode) {
      case 'wfm':
        count = this.demodWFM(n1, audioOut);
        break;
      case 'nfm':
        this.demodNFM(n1, audioOut);
        break;
      case 'am':
        this.demodAM(n1, audioOut);
        break;
      case 'usb':
      case 'lsb':
      case 'cw':
        this.demodSSB(n1, audioOut);
        break;
      case 'raw':
        this.demodRaw(n1, audioOut);
        break;
    }

    // 5. Squelch + AGC.
    this.applySquelchAgc(audioOut, count);
    return count;
  }

  private demodWFM(n: number, audioOut: Float32Array): number {
    // FM discriminator at IF rate into demodBuf, with de-emphasis.
    let pr = this.fmPrevRe;
    let pi = this.fmPrevIm;
    for (let i = 0; i < n; i++) {
      const r = this.cfRe[i];
      const im = this.cfIm[i];
      const dot = r * pr + im * pi;
      const cross = im * pr - r * pi;
      let d = Math.atan2(cross, dot) * 0.35;
      this.deemph += this.deemphA * (d - this.deemph);
      this.demodBuf[i] = this.deemph;
      pr = r;
      pi = im;
    }
    this.fmPrevRe = pr;
    this.fmPrevIm = pi;
    // Decimate audio 192k -> 48k.
    const c = this.audioDecim!.process(this.demodBuf, this.zeros, audioOut, this.trash, n);
    return c;
  }

  private demodNFM(n: number, audioOut: Float32Array): void {
    let pr = this.fmPrevRe;
    let pi = this.fmPrevIm;
    for (let i = 0; i < n; i++) {
      const r = this.cfRe[i];
      const im = this.cfIm[i];
      const dot = r * pr + im * pi;
      const cross = im * pr - r * pi;
      const d = Math.atan2(cross, dot) * 0.9;
      this.deemph += this.deemphA * (d - this.deemph);
      audioOut[i] = this.deemph;
      pr = r;
      pi = im;
    }
    this.fmPrevRe = pr;
    this.fmPrevIm = pi;
  }

  private demodAM(n: number, audioOut: Float32Array): void {
    for (let i = 0; i < n; i++) {
      const env = Math.sqrt(this.cfRe[i] * this.cfRe[i] + this.cfIm[i] * this.cfIm[i]);
      this.amDc += 0.001 * (env - this.amDc);
      audioOut[i] = (env - this.amDc) * 2;
    }
  }

  private demodSSB(n: number, audioOut: Float32Array): void {
    // Weaver: down-mix, lowpass (I & Q), up-mix, take real part.
    this.wOsc1.mix(this.cfRe, this.cfIm, this.txRe, this.txIm, n);
    this.ssbFilter.process(this.txRe, this.txIm, this.ifRe, this.ifIm, n);
    this.wOsc2.mix(this.ifRe, this.ifIm, this.cfRe, this.cfIm, n);
    for (let i = 0; i < n; i++) audioOut[i] = this.cfRe[i] * 3;
  }

  private demodRaw(n: number, audioOut: Float32Array): void {
    // Envelope so digital bursts are audible as a buzz.
    for (let i = 0; i < n; i++) {
      const env = Math.sqrt(this.cfRe[i] * this.cfRe[i] + this.cfIm[i] * this.cfIm[i]);
      this.amDc += 0.002 * (env - this.amDc);
      audioOut[i] = (env - this.amDc) * 1.5;
    }
  }

  private applySquelchAgc(audio: Float32Array, n: number): void {
    // Squelch: ramp toward open/closed based on channel level.
    const open = this.signalDb > this.squelchDb;
    const targetMute = open ? 1 : 0;
    // AGC: normalise loudness with slow gain, capped.
    let peak = 0;
    for (let i = 0; i < n; i++) {
      const a = Math.abs(audio[i]);
      if (a > peak) peak = a;
    }
    const desired = peak > 1e-4 ? Math.min(8, 0.5 / peak) : this.agcGain;
    this.agcGain += 0.05 * (desired - this.agcGain);
    for (let i = 0; i < n; i++) {
      this.muteRamp += 0.02 * (targetMute - this.muteRamp);
      let v = audio[i] * this.agcGain * this.muteRamp;
      if (v > 1) v = 1;
      else if (v < -1) v = -1;
      audio[i] = v;
    }
  }
}
