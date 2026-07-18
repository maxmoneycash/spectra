/** Format helpers shared across the console UI. */

/** Format an RF frequency as a clean station number, e.g. 98500000 → "98.5". */
export function fmtStation(hz: number): string {
  const m = hz / 1e6;
  let s = m.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  if (!s.includes('.')) s += '.0';
  return s;
}

/** Fixed-precision MHz, e.g. 98500000 → "98.5000". */
export function fmtMHz(hz: number, digits = 4): string {
  return (hz / 1e6).toFixed(digits);
}

/** Human bandwidth: 180000 → "180.0 kHz", 500 → "500 Hz". */
export function fmtBw(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${hz} Hz`;
}

/** MM:SS elapsed since a start timestamp. */
export function fmtElapsed(sinceMs: number | null): string {
  if (!sinceMs) return '00:00';
  const s = Math.max(0, Math.floor((Date.now() - sinceMs) / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Parse a user-typed frequency. Accepts "98.5" / "98.5000" (MHz) or
 * "98500000" (Hz). Returns Hz or null when unparseable.
 */
export function parseFreqInput(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s*(mhz|hz|khz)$/u, '');
  if (!s) return null;
  const hadK = /khz$/u.test(raw.trim().toLowerCase());
  const v = Number(s);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (hadK) return v * 1e3;
  // Bare numbers: small values are MHz, large values are Hz.
  return v < 10_000 ? v * 1e6 : v;
}
