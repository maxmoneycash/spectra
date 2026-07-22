/**
 * NCDXF/IARU HF beacon network — the real rotation, computed offline.
 * 18 beacons cycle across 5 HF channels; each slot is 10 s, so each band
 * has exactly one active beacon at any moment. Facts: ncdxf.org beacon
 * schedule (public data). Math: slot = floor(t/10s) % 18, band offset b.
 */

export interface Beacon {
  call: string;
  grid: string;
  qth: string;
  lat: number;
  lon: number;
}

export const NCDXF_BEACONS: Beacon[] = [
  { call: '4U1UN', grid: 'FN30', qth: 'New York, USA', lat: 40.75, lon: -73.97 },
  { call: 'VE8AT', grid: 'EQ79', qth: 'Eureka, Nunavut, Canada', lat: 79.98, lon: -85.9 },
  { call: 'W6WX', grid: 'CM97', qth: 'Mt. Umunhum, California, USA', lat: 37.17, lon: -121.9 },
  { call: 'KH6RS', grid: 'BL10', qth: 'Maui, Hawaii, USA', lat: 20.66, lon: -156.4 },
  { call: 'ZL6B', grid: 'RE78', qth: 'Masterton, New Zealand', lat: -41.05, lon: 175.5 },
  { call: 'VK6RBP', grid: 'OF87', qth: 'Rolystone, WA, Australia', lat: -32.1, lon: 116.0 },
  { call: 'JA2IGY', grid: 'PM84', qth: 'Mt. Asama, Japan', lat: 36.4, lon: 138.3 },
  { call: 'RR9O', grid: 'NO15', qth: 'Novosibirsk, Russia', lat: 54.9, lon: 83.0 },
  { call: 'VR2B', grid: 'OL72', qth: 'Hong Kong', lat: 22.3, lon: 114.2 },
  { call: '4S7B', grid: 'MJ96', qth: 'Colombo, Sri Lanka', lat: 6.9, lon: 79.9 },
  { call: 'ZS6DN', grid: 'KG44', qth: 'Pretoria, South Africa', lat: -25.9, lon: 28.2 },
  { call: '5Z4B', grid: 'KI88', qth: 'Nairobi, Kenya', lat: -1.3, lon: 36.8 },
  { call: '4X6TU', grid: 'KM72', qth: 'Tel Aviv, Israel', lat: 32.1, lon: 34.8 },
  { call: 'OH2B', grid: 'KP20', qth: 'Lohja, Finland', lat: 60.1, lon: 24.5 },
  { call: 'CS3B', grid: 'IM57', qth: 'Lisbon, Portugal', lat: 38.7, lon: -9.2 },
  { call: 'LU4AA', grid: 'GF05', qth: 'Buenos Aires, Argentina', lat: -34.6, lon: -58.4 },
  { call: 'OA4B', grid: 'FH17', qth: 'Lima, Peru', lat: -12.1, lon: -77.0 },
  { call: 'YV5B', grid: 'FK60', qth: 'Caracas, Venezuela', lat: 10.4, lon: -66.9 },
];

export interface NcdxfBand {
  band: string;
  freqHz: number;
}

export const NCDXF_BANDS: NcdxfBand[] = [
  { band: '20m', freqHz: 14.1e6 },
  { band: '17m', freqHz: 18.11e6 },
  { band: '15m', freqHz: 21.15e6 },
  { band: '12m', freqHz: 24.93e6 },
  { band: '10m', freqHz: 28.2e6 },
];

export const SLOT_MS = 10_000;

/** Current 10 s slot within the 3-minute rotation. */
export function slotIndex(t = Date.now()): number {
  return Math.floor(t / SLOT_MS) % NCDXF_BEACONS.length;
}

/** The beacon currently transmitting on band `bandIdx` (0..4). */
export function activeBeacon(bandIdx: number, t = Date.now()): Beacon {
  const n = slotIndex(t);
  return NCDXF_BEACONS[(n - bandIdx + NCDXF_BEACONS.length) % NCDXF_BEACONS.length];
}

/** Milliseconds until the next slot starts. */
export function nextSlotIn(t = Date.now()): number {
  return SLOT_MS - (t % SLOT_MS);
}

/** Real on-air format: callsign, four dahs, grid square (T = a plain dah). */
export function beaconText(b: Beacon): string {
  return `${b.call} T T T T ${b.grid}`;
}
