/**
 * Pull-based capture playback. The worker asks for samples when its queue
 * runs low; this reads the next slice of the File, decodes it, and posts it.
 * Nothing is held in memory beyond the chunk in flight, so a 120 s capture
 * at 2.4 MSPS (2.3 GB as floats) plays from a 2 MB window. At the end of
 * the playable window it wraps to the start, so playback loops.
 */
import type { ToWorker } from '../engine/protocol';
import { bytesPerSample, decodeSamples, CAPTURE_MAX_SEC, type CaptureMeta } from './decode';

/** Samples per read: a tenth of a second of input. */
function chunkSamples(rate: number): number {
  return Math.max(16384, Math.round(rate / 10));
}

export class CaptureStream {
  readonly totalSamples: number;
  readonly totalSec: number;
  private readonly bps: number;
  private readonly chunk: number;
  private offsetSamples = 0;
  private reading = false;
  private closed = false;

  constructor(
    private readonly file: File,
    readonly meta: CaptureMeta,
    private readonly post: (msg: ToWorker, transfer?: Transferable[]) => void,
  ) {
    this.bps = bytesPerSample(meta.datatype);
    const inFile = Math.floor(file.size / this.bps);
    this.totalSamples = Math.min(inFile, Math.floor(CAPTURE_MAX_SEC * meta.sampleRate));
    this.totalSec = this.totalSamples / meta.sampleRate;
    this.chunk = chunkSamples(meta.sampleRate);
  }

  /** Tell the worker the stream is open, then prime it with two chunks. */
  async open(): Promise<void> {
    this.post({
      type: 'playOpen',
      sampleRate: this.meta.sampleRate,
      centerFreqHz: this.meta.centerFreqHz,
      totalSamples: this.totalSamples,
    });
    await this.feed();
    await this.feed();
  }

  /** Read, decode and post the next chunk. Requests that land mid-read are dropped; the worker asks again. */
  async feed(): Promise<void> {
    if (this.reading || this.closed || this.totalSamples === 0) return;
    this.reading = true;
    try {
      const n = Math.min(this.chunk, this.totalSamples - this.offsetSamples);
      const start = this.offsetSamples * this.bps;
      const buf = await this.file.slice(start, start + n * this.bps).arrayBuffer();
      if (this.closed) return;
      const { re, im } = decodeSamples(buf, this.meta.datatype, 0, n);
      this.post({ type: 'playChunk', re, im }, [re.buffer, im.buffer]);
      this.offsetSamples += n;
      if (this.offsetSamples >= this.totalSamples) this.offsetSamples = 0;
    } finally {
      this.reading = false;
    }
  }

  /** Where playback is, given how many input samples the worker has consumed. */
  posSec(consumed: number): number {
    return this.totalSamples ? (consumed % this.totalSamples) / this.meta.sampleRate : 0;
  }

  close(): void {
    this.closed = true;
    this.post({ type: 'playStop' });
  }
}
