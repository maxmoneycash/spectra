/**
 * RF Academy dataset — a hand-curated, compact map of the radio spectrum
 * (100 kHz – 10 GHz), focused on bands a curious operator actually meets.
 * Sources: ITU Radio Regulations, FCC §2.106 allocation table, band plans.
 */

export interface Region {
  id: string;
  name: string;
  longName: string;
  fStartHz: number;
  fEndHz: number;
  note: string;
}

export interface AcademyBand {
  id: string;
  name: string;
  fStartHz: number;
  fEndHz: number;
  /** 1 = major band (always labeled), 2 = service (appears when zoomed). */
  tier: 1 | 2;
  /** Accent-colored and links into the live simulator when set. */
  scenarioId?: string;
  summary: string;
  services: string;
  propagation: string;
}

export const C = 299_792_458; // m/s

export const REGIONS: Region[] = [
  { id: 'lf', name: 'LF', longName: 'Low Frequency', fStartHz: 100e3, fEndHz: 300e3, note: 'Long waves that follow the curvature of the earth.' },
  { id: 'mf', name: 'MF', longName: 'Medium Frequency', fStartHz: 300e3, fEndHz: 3e6, note: 'AM broadcast lives here; ground wave by day, skywave by night.' },
  { id: 'hf', name: 'HF', longName: 'High Frequency', fStartHz: 3e6, fEndHz: 30e6, note: 'Shortwave. Bounces off the ionosphere — intercontinental reach.' },
  { id: 'vhf', name: 'VHF', longName: 'Very High Frequency', fStartHz: 30e6, fEndHz: 300e6, note: 'FM broadcast, airband, marine, 2 m ham. Mostly line-of-sight.' },
  { id: 'uhf', name: 'UHF', longName: 'Ultra High Frequency', fStartHz: 300e6, fEndHz: 3e9, note: 'TV, 70 cm ham, ISM, cellular, GPS, WiFi. The crowded workhorse.' },
  { id: 'shf', name: 'SHF', longName: 'Super High Frequency', fStartHz: 3e9, fEndHz: 10e9, note: 'Microwave: WiFi 5/6, radar, satellite links. Short wavelengths, high bandwidth.' },
];

export const BANDS: AcademyBand[] = [
  // --- MF / HF ---
  {
    id: 'am-bc', name: 'AM Broadcast', fStartHz: 530e3, fEndHz: 1700e3, tier: 1,
    summary: 'The original broadcast band. A steady carrier with audio sidebands — exactly what you demodulate in AM mode.',
    services: 'Commercial and public AM radio stations, 10 kHz spacing (9 kHz outside the Americas).',
    propagation: 'Ground wave by day (~100 km); at night the signal skips off the ionosphere and crosses continents.',
  },
  {
    id: 'sw-49m', name: 'Shortwave 49 m', fStartHz: 5.9e6, fEndHz: 6.2e6, tier: 2,
    summary: 'International broadcasters and state radio beaming across borders.',
    services: 'BBC, VOA, RNZ, music and propaganda from another hemisphere.',
    propagation: 'Nighttime ionospheric skip; daytime range limited.',
  },
  {
    id: 'ham-40m', name: 'Ham 40 m', fStartHz: 7.0e6, fEndHz: 7.3e6, tier: 1,
    scenarioId: 'morse-intercept',
    summary: 'The most popular HF amateur band — CW (Morse) at the bottom, SSB voice above. Our Morse Intercept mission parks you right here.',
    services: 'Amateur CW and SSB nets, QRP experimenters, beacons.',
    propagation: 'Reliable regional coverage by day (a few hundred km), continental at night.',
  },
  {
    id: 'sw-31m', name: 'Shortwave 31 m', fStartHz: 9.4e6, fEndHz: 9.9e6, tier: 2,
    summary: 'Prime international shortwave broadcast real estate.',
    services: 'World service radio, religious broadcasters, numbers-station lore.',
    propagation: 'Works day and night via ionospheric refraction.',
  },
  {
    id: 'ham-20m', name: 'Ham 20 m', fStartHz: 14.0e6, fEndHz: 14.35e6, tier: 1,
    summary: 'The DX band — where hams talk across oceans on a few watts.',
    services: 'Amateur SSB, CW, FT8 digital (14.074 MHz — the busiest data frequency on earth).',
    propagation: 'Daytime long-distance via F-layer; closes at night.',
  },
  {
    id: 'cb', name: 'CB Radio', fStartHz: 26.965e6, fEndHz: 27.405e6, tier: 2,
    summary: '40 channels of license-free AM/SSB chatter — truckers, hobbyists.',
    services: 'Citizens Band voice, channel 19 road talk.',
    propagation: 'Local ground wave; wild long-distance "skip" during sunspot years.',
  },
  // --- VHF ---
  {
    id: 'fm-bc', name: 'FM Broadcast', fStartHz: 88e6, fEndHz: 108e6, tier: 1,
    scenarioId: 'first-contact',
    summary: 'Wideband FM: ±75 kHz deviation gives music stations their fat ~180 kHz footprint. The First Contact mission lives here.',
    services: 'Commercial and public FM music/talk stations, 200 kHz spacing.',
    propagation: 'Line-of-sight, 50–100 km. Signals bend slightly around hills but not over the horizon.',
  },
  {
    id: 'airband', name: 'Airband', fStartHz: 118e6, fEndHz: 137e6, tier: 1,
    scenarioId: 'air-band',
    summary: 'Pilots and towers talking in AM, so a weak signal is not buried by a strong one (the capture effect would hide a mayday). The Air Band mission.',
    services: 'Tower, approach, ATIS, ground control; 8.33/25 kHz channels.',
    propagation: 'Excellent line-of-sight to aircraft at altitude — hundreds of km.',
  },
  {
    id: 'ham-2m', name: 'Ham 2 m', fStartHz: 144e6, fEndHz: 148e6, tier: 1,
    scenarioId: 'fox-hunt',
    summary: 'The first band most hams use: FM repeaters, simplex, and weak-signal CW/SSB. The Fox Hunt mission hides its beacon here.',
    services: 'FM voice repeaters, APRS (144.39 MHz), satellites at the top.',
    propagation: 'Local line-of-sight; repeaters on hilltops extend it to ~100 km.',
  },
  {
    id: 'noaa-wx', name: 'NOAA Weather', fStartHz: 162.4e6, fEndHz: 162.55e6, tier: 2,
    summary: 'Continuous weather radio broadcasts in narrow FM.',
    services: 'NWS weather stations WX1–WX7.',
    propagation: 'Regional line-of-sight.',
  },
  {
    id: 'marine', name: 'Marine VHF', fStartHz: 156e6, fEndHz: 162.05e6, tier: 2,
    summary: 'Ship-to-ship and ship-to-shore. Channel 16 (156.8 MHz) is the international calling and distress channel.',
    services: 'Port operations, ship traffic, coast guard.',
    propagation: 'Line-of-sight over water — travels well.',
  },
  // --- UHF ---
  {
    id: 'tv-uhf', name: 'UHF TV', fStartHz: 470e6, fEndHz: 698e6, tier: 2,
    summary: 'Digital broadcast television (ATSC). Wide 6 MHz channels of compressed video.',
    services: 'Over-the-air TV stations.',
    propagation: 'Line-of-sight; hills and buildings shadow it.',
  },
  {
    id: 'ham-70cm', name: 'Ham 70 cm', fStartHz: 420e6, fEndHz: 450e6, tier: 1,
    summary: 'The UHF companion to 2 m: repeaters, weak signal, and amateur satellites in the middle.',
    services: 'FM repeaters, DMR/D-Star digital voice, cubesats.',
    propagation: 'Strictly line-of-sight; easily blocked by structures.',
  },
  {
    id: 'ism-433', name: 'ISM 433', fStartHz: 433.05e6, fEndHz: 434.79e6, tier: 1,
    summary: 'License-free low-power devices: tire-pressure sensors, keyfobs, weather stations — mostly simple OOK/FSK bursts.',
    services: 'Car keys, garage remotes, sensors, LoRa (EU).',
    propagation: 'Short range by design (milliwatts).',
  },
  {
    id: 'ism-915', name: 'ISM 915', fStartHz: 902e6, fEndHz: 928e6, tier: 1,
    scenarioId: 'ism-sweep',
    summary: 'The American junk band: LoRa chirps, sensor OOK stutter, FSK telemetry. The ISM Sensor Sweep mission.',
    services: 'LoRaWAN (US), Zigbee, utility meters, RFID readers.',
    propagation: 'Good building penetration; tens of km for LoRa at low data rates.',
  },
  {
    id: 'ads-b', name: 'ADS-B 1090', fStartHz: 1080e6, fEndHz: 1100e6, tier: 2,
    summary: 'Aircraft broadcasting position, altitude, and identity twice a second — the feed behind flight trackers.',
    services: 'Transponder replies at exactly 1090 MHz, 1 µs pulses.',
    propagation: 'Line-of-sight; high-altitude aircraft are audible 300+ km away.',
  },
  {
    id: 'hydrogen', name: 'Hydrogen Line', fStartHz: 1.41e9, fEndHz: 1.43e9, tier: 2,
    summary: '1420.4 MHz: the spin-flip of neutral hydrogen. The universe hums here; radio astronomy protects it as a quiet zone.',
    services: 'Radio telescopes only — transmitting here is prohibited worldwide.',
    propagation: 'Comes from deep space; earthbound noise is the enemy.',
  },
  {
    id: 'gps-l1', name: 'GPS L1', fStartHz: 1.565e9, fEndHz: 1.585e9, tier: 1,
    summary: 'Satellites 20,000 km up shouting the time. Your phone solves for position from nanosecond timing.',
    services: 'GPS L1 C/A at 1575.42 MHz; GLONASS and Galileo neighbors.',
    propagation: 'Extremely weak (-130 dBm) — needs clear sky view; indoors it is gone.',
  },
  {
    id: 'cell-700', name: 'Cellular 700/850', fStartHz: 698e6, fEndHz: 894e6, tier: 2,
    summary: 'Low-band LTE/5G: the coverage layer. Long wavelengths reach deep into buildings.',
    services: 'Carrier LTE/5G NR blocks, sliced into licensed chunks.',
    propagation: 'Excellent penetration and rural reach.',
  },
  {
    id: 'cell-1900', name: 'Cellular 1900', fStartHz: 1.85e9, fEndHz: 1.99e9, tier: 2,
    summary: 'Mid-band cellular capacity layer in dense areas.',
    services: 'PCS LTE/5G blocks.',
    propagation: 'Urban cells of a few km.',
  },
  {
    id: 'wifi-24', name: 'WiFi 2.4 GHz', fStartHz: 2.4e9, fEndHz: 2.5e9, tier: 1,
    summary: 'Fourteen overlapping 20 MHz channels squeezed into 83.5 MHz — only 1, 6, and 11 fit without overlap. Congested but long-ranged.',
    services: '802.11b/g/n WiFi, Bluetooth, Zigbee, microwave ovens at 2.45 GHz.',
    propagation: 'Decent through walls; the oven is a 1000 W jammer.',
  },
  {
    id: 'wifi-5', name: 'WiFi 5 GHz', fStartHz: 5.15e9, fEndHz: 5.895e9, tier: 1,
    summary: 'Dozens of wider channels (up to 160 MHz), DFS radar-sharing gaps, and far less congestion.',
    services: '802.11a/n/ac/ax WiFi.',
    propagation: 'Shorter range, weaker through walls; needs a clear path.',
  },
  {
    id: 'wifi-6e', name: 'WiFi 6E', fStartHz: 5.925e9, fEndHz: 7.125e9, tier: 2,
    summary: '1.2 GHz of pristine new spectrum — the biggest WiFi land-grab in decades.',
    services: '802.11ax (WiFi 6E/7) with wide clean channels.',
    propagation: 'Short range; same-room speeds.',
  },
  {
    id: 'radar-x', name: 'X-band Radar', fStartHz: 8.5e9, fEndHz: 10.5e9, tier: 2,
    summary: 'Marine navigation and weather radar: short pulses, fine resolution.',
    services: 'Ship radar, airport surveillance, weather research.',
    propagation: 'Line-of-sight; rain attenuates (which is also how weather radar sees rain).',
  },
];

/** Explorer axis domain. */
export const AXIS_MIN_HZ = 100e3;
export const AXIS_MAX_HZ = 10e9;

export function fmtAxisFreq(hz: number): string {
  if (hz >= 1e9) {
    const v = hz / 1e9;
    return `${v >= 10 ? v.toFixed(0) : v.toFixed(2).replace(/\.?0+$/, '')} GHz`;
  }
  if (hz >= 1e6) {
    const v = hz / 1e6;
    return `${v >= 100 ? v.toFixed(0) : v.toFixed(1).replace(/\.?0+$/, '')} MHz`;
  }
  return `${(hz / 1e3).toFixed(0)} kHz`;
}

export function fmtWavelength(hz: number): string {
  const m = C / hz;
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  if (m >= 1) return `${m.toFixed(m >= 10 ? 0 : 1)} m`;
  return `${(m * 100).toFixed(0)} cm`;
}
