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
