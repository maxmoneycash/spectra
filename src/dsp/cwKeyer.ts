import { AUDIO_RATE } from './receiver';

/**
 * Turns demodulated CW audio into keyed on/off intervals for the Morse
 * decoder: a 3 ms envelope follower against a threshold at 35% of a slowly
 * decaying peak. Intervals under 10 ms are dropped, though the state still
 * flips — the decoder merges the same state arriving twice.
 *
 * Shared by the worker and the end-to-end decode tests so they cannot drift.
 */
export class CwKeyer {
  private env = 0;
  private peak = 0.01;
  private state = false;
  private samples = 0;
  private readonly alpha = 1 - Math.exp(-1 / (0.003 * AUDIO_RATE));

  constructor(private readonly onInterval: (on: boolean, durSec: number) => void) {}

  /** Feed `n` samples of demodulated audio. */
  process(audio: Float32Array, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.abs(audio[i]);
      this.env += this.alpha * (a - this.env);
      this.peak = Math.max(this.peak * 0.99995, this.env);
      const on = this.env > this.peak * 0.35;
      if (on !== this.state) {
        const dur = this.samples / AUDIO_RATE;
        if (dur > 0.01) this.onInterval(this.state, dur);
        this.state = on;
        this.samples = 0;
      } else {
        this.samples++;
      }
    }
  }
}
