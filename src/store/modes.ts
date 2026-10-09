import type { DemodMode } from '../sim/signal-kinds';

/**
 * Receiver mode tables. Kept free of the store's side effects (the store boots
 * the audio engine on import) so tests and pure modules can use them.
 */

/** Default filter width per mode, in Hz. */
export const MODE_BW: Record<DemodMode, number> = {
  wfm: 180_000,
  nfm: 12_000,
  am: 8_000,
  usb: 2_700,
  lsb: 2_700,
  cw: 500,
  raw: 20_000,
};

export const DEMOD_MODES: DemodMode[] = ['wfm', 'nfm', 'am', 'usb', 'lsb', 'cw', 'raw'];

/** Filter-width range per mode: [min, max, step] in Hz. Shared by both decks. */
export const BW_RANGE: Record<DemodMode, [number, number, number]> = {
  wfm: [100_000, 240_000, 5_000],
  nfm: [6_000, 25_000, 500],
  am: [3_000, 16_000, 500],
  usb: [1_200, 4_000, 100],
  lsb: [1_200, 4_000, 100],
  cw: [200, 2_000, 50],
  raw: [5_000, 300_000, 5_000],
};

/** Squelch the receiver opens at: well below any signal, i.e. the gate is open. */
export const DEFAULT_SQUELCH_DB = -80;

/**
 * A squelch "a previous operator left up" — the premise of Below the Gate and
 * the squelch lesson. Their -26 dB beacons peak at exactly -26.0 dB of gated
 * channel level (keyer bench, 2026-10-09), so the gate must sit above that:
 * at -30 fragments still leak through on key-down, at -25 the decoder is
 * silent. The squelch control runs -120..-20, so this is visible on the dial
 * and leaves the whole lower range for the student to open the gate.
 */
export const CLOSED_SQUELCH_DB = -24;
