/**
 * Turning capture files into the float I/Q pairs the engine takes.
 *
 * Three sample formats cover nearly every hobby SDR: cf32 (GNU Radio,
 * SigMF's usual), ci16 (HackRF, SDR++), cu8 (rtl_sdr). The decoders are
 * chunk-friendly: give them any whole number of samples and they return
 * that many. Nothing here touches the DOM, so it runs in a worker or a test.
 */

export type CaptureDatatype = 'cf32_le' | 'ci16_le' | 'cu8';

export const DATATYPES: { id: CaptureDatatype; label: string; hint: string }[] = [
  { id: 'cf32_le', label: 'cf32', hint: 'GNU Radio, SigMF default' },
  { id: 'ci16_le', label: 'ci16', hint: 'HackRF, SDR++, Airspy' },
  { id: 'cu8', label: 'cu8', hint: 'rtl_sdr' },
];

/** Bytes per complex sample. */
export function bytesPerSample(dt: CaptureDatatype): number {
  switch (dt) {
    case 'cf32_le':
      return 8;
    case 'ci16_le':
      return 4;
    case 'cu8':
      return 2;
  }
}

/** Datatype from a file name, when no meta says otherwise. */
export function datatypeFromName(name: string): CaptureDatatype | null {
  const n = name.toLowerCase();
  if (/\.(cf32|fc32|c32|iq32)$/.test(n)) return 'cf32_le';
  if (/\.(cs16|ci16|c16|sc16)$/.test(n)) return 'ci16_le';
  if (/\.(cu8|u8|raw)$/.test(n)) return 'cu8';
  return null;
}

/**
 * Decode `count` complex samples from `buf` starting at `byteOffset`.
 * Integer formats are scaled to ±1; cu8's 127.5 midpoint keeps a silent
 * capture at zero rather than a DC spike.
 */
export function decodeSamples(
  buf: ArrayBuffer,
  dt: CaptureDatatype,
  byteOffset = 0,
  count?: number,
): { re: Float32Array; im: Float32Array } {
  const avail = Math.floor((buf.byteLength - byteOffset) / bytesPerSample(dt));
  const n = Math.max(0, Math.min(count ?? avail, avail));
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  if (dt === 'cf32_le') {
    const v = new Float32Array(buf, byteOffset, n * 2);
    for (let i = 0; i < n; i++) {
      re[i] = v[2 * i];
      im[i] = v[2 * i + 1];
    }
  } else if (dt === 'ci16_le') {
    const v = new Int16Array(buf, byteOffset, n * 2);
    const k = 1 / 32768;
    for (let i = 0; i < n; i++) {
      re[i] = v[2 * i] * k;
      im[i] = v[2 * i + 1] * k;
    }
  } else {
    const v = new Uint8Array(buf, byteOffset, n * 2);
    const k = 1 / 127.5;
    for (let i = 0; i < n; i++) {
      re[i] = (v[2 * i] - 127.5) * k;
      im[i] = (v[2 * i + 1] - 127.5) * k;
    }
  }
  return { re, im };
}

/** Encode float I/Q as one of the formats (the capture renderer uses this). */
export function encodeSamples(re: Float32Array, im: Float32Array, dt: CaptureDatatype): ArrayBuffer {
  const n = Math.min(re.length, im.length);
  if (dt === 'cf32_le') {
    const out = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      out[2 * i] = re[i];
      out[2 * i + 1] = im[i];
    }
    return out.buffer;
  }
  if (dt === 'ci16_le') {
    const out = new Int16Array(n * 2);
    for (let i = 0; i < n; i++) {
      out[2 * i] = Math.max(-32768, Math.min(32767, Math.round(re[i] * 32767)));
      out[2 * i + 1] = Math.max(-32768, Math.min(32767, Math.round(im[i] * 32767)));
    }
    return out.buffer;
  }
  const out = new Uint8Array(n * 2);
  for (let i = 0; i < n; i++) {
    out[2 * i] = Math.max(0, Math.min(255, Math.round(re[i] * 127.5 + 127.5)));
    out[2 * i + 1] = Math.max(0, Math.min(255, Math.round(im[i] * 127.5 + 127.5)));
  }
  return out.buffer;
}

export interface CaptureMeta {
  sampleRate: number;
  datatype: CaptureDatatype;
  centerFreqHz: number;
  /** Free text from the meta, if any. */
  description?: string;
}

/**
 * The three facts a `.sigmf-meta` carries that playback needs. Tolerant:
 * SigMF writers vary in which optional keys they set, and a hand-edited
 * file is common. Returns null if the sample rate is missing — nothing can
 * be played without it.
 */
export function parseSigMFMeta(text: string): CaptureMeta | null {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    return null;
  }
  if (!j || typeof j !== 'object') return null;
  const o = j as Record<string, unknown>;
  const g = (o.global ?? {}) as Record<string, unknown>;
  const rate = Number(g['core:sample_rate']);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const dtRaw = String(g['core:datatype'] ?? 'cf32_le').toLowerCase();
  const datatype: CaptureDatatype | null =
    dtRaw.startsWith('cf32') ? 'cf32_le' : dtRaw.startsWith('ci16') ? 'ci16_le' : dtRaw.startsWith('cu8') ? 'cu8' : null;
  if (!datatype) return null;
  const caps = Array.isArray(o.captures) ? (o.captures as Record<string, unknown>[]) : [];
  const f = Number(caps[0]?.['core:frequency']);
  const description = typeof g['core:description'] === 'string' ? (g['core:description'] as string) : undefined;
  return { sampleRate: rate, datatype, centerFreqHz: Number.isFinite(f) && f > 0 ? f : 0, description };
}

/** Longest window played; past it the capture loops its first `CAPTURE_MAX_SEC`. */
export const CAPTURE_MAX_SEC = 120;
/** Rates the resampler will take; outside this the sheet refuses and says why. */
export const CAPTURE_RATE_MIN = 250_000;
export const CAPTURE_RATE_MAX = 3_000_000;
