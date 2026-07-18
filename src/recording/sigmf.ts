/**
 * SigMF (Signal Metadata Format) export/import. Recordings are the standard
 * interchange artifact of the SDR world — a `.sigmf-data` blob of interleaved
 * complex float32 (cf32_le) plus a `.sigmf-meta` JSON sidecar. Producing real
 * SigMF means captures made here open in IQEngine, inspectrum, GNU Radio, etc.
 */

export interface SigMFAnnotation {
  sample_start: number;
  sample_count?: number;
  'core:freq_lower_edge'?: number;
  'core:freq_upper_edge'?: number;
  'core:label'?: string;
  'core:description'?: string;
}

export interface SigMFMeta {
  global: Record<string, unknown>;
  captures: Record<string, unknown>[];
  annotations: SigMFAnnotation[];
}

export interface BuildMetaOptions {
  sampleRate: number;
  centerFreqHz: number;
  description?: string;
  datetimeISO?: string;
  annotations?: SigMFAnnotation[];
}

export function buildSigMFMeta(opts: BuildMetaOptions): SigMFMeta {
  return {
    global: {
      'core:datatype': 'cf32_le',
      'core:sample_rate': opts.sampleRate,
      'core:version': '1.0.0',
      'core:description': opts.description ?? 'Captured in SPECTRA (simulated RF environment)',
      'core:author': 'SPECTRA SDR Lab',
      'core:recorder': 'SPECTRA',
    },
    captures: [
      {
        'core:sample_start': 0,
        'core:frequency': opts.centerFreqHz,
        ...(opts.datetimeISO ? { 'core:datetime': opts.datetimeISO } : {}),
      },
    ],
    annotations: opts.annotations ?? [],
  };
}

/** Interleave split I/Q into a cf32 buffer [I0,Q0,I1,Q1,...]. */
export function interleave(re: Float32Array, im: Float32Array, len = re.length): Float32Array {
  const out = new Float32Array(len * 2);
  for (let i = 0; i < len; i++) {
    out[2 * i] = re[i];
    out[2 * i + 1] = im[i];
  }
  return out;
}

/** Split an interleaved cf32 buffer back into I/Q arrays. */
export function deinterleave(data: Float32Array): { re: Float32Array; im: Float32Array } {
  const n = data.length >> 1;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    re[i] = data[2 * i];
    im[i] = data[2 * i + 1];
  }
  return { re, im };
}

/** Parse a `.sigmf-data` ArrayBuffer of cf32_le into I/Q arrays. */
export function parseSigMFData(buffer: ArrayBuffer): { re: Float32Array; im: Float32Array } {
  return deinterleave(new Float32Array(buffer));
}

/** Trigger a browser download for a Blob (no-op outside the DOM). */
function download(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download a recording as the standard `.sigmf-meta` + `.sigmf-data` pair. */
export function downloadSigMF(
  basename: string,
  iqInterleaved: Float32Array,
  meta: SigMFMeta,
): void {
  download(
    new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' }),
    `${basename}.sigmf-meta`,
  );
  download(
    new Blob([iqInterleaved.buffer as ArrayBuffer], { type: 'application/octet-stream' }),
    `${basename}.sigmf-data`,
  );
}
