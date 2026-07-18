/** Every modulation the simulator can emit and the receiver can identify. */
export type SignalKind =
  | 'wfm'
  | 'nfm'
  | 'am'
  | 'usb'
  | 'lsb'
  | 'cw'
  | 'fsk2'
  | 'ook'
  | 'lora'
  | 'psk'
  | 'fhss'
  | 'radar';

/** Receiver demodulation modes. */
export type DemodMode = 'wfm' | 'nfm' | 'am' | 'usb' | 'lsb' | 'cw' | 'raw';

export type SignalCategory =
  | 'broadcast'
  | 'voice'
  | 'data'
  | 'beacon'
  | 'radar'
  | 'spread';

export interface KindInfo {
  kind: SignalKind;
  label: string;
  /** Nominal occupied bandwidth in Hz (ground truth for detection scoring). */
  bandwidthHz: number;
  category: SignalCategory;
  /** The demod mode that best recovers this signal. */
  recommendedDemod: DemodMode;
  /** Waterfall/marker colour. */
  color: string;
  /** Whether the emission is continuous or transmitted in bursts. */
  continuous: boolean;
  /** Short "what is it" blurb for the signal library. */
  blurb: string;
  /** Real-world examples and where you'd hear it. */
  realWorld: string;
  /** Visual signature on a waterfall. */
  waterfall: string;
}

export const KIND_INFO: Record<SignalKind, KindInfo> = {
  wfm: {
    kind: 'wfm',
    label: 'Broadcast FM',
    bandwidthHz: 180_000,
    category: 'broadcast',
    recommendedDemod: 'wfm',
    color: '#4ade80',
    continuous: true,
    blurb:
      'Wideband frequency modulation carrying high-fidelity audio. ±75 kHz deviation gives it a fat, ~180 kHz-wide footprint.',
    realWorld: 'Commercial FM radio (88–108 MHz), stereo music stations.',
    waterfall:
      'A wide, solid block that flickers in width with the loudness of the audio.',
  },
  nfm: {
    kind: 'nfm',
    label: 'Narrowband FM',
    bandwidthHz: 12_000,
    category: 'voice',
    recommendedDemod: 'nfm',
    color: '#38bdf8',
    continuous: true,
    blurb:
      'Narrow FM voice, ±2.5–5 kHz deviation. The workhorse of two-way radio.',
    realWorld:
      'Ham 2 m/70 cm repeaters, PMR446, public-service and business handhelds.',
    waterfall: 'A slim solid bar, keying up and down as people talk.',
  },
  am: {
    kind: 'am',
    label: 'AM Voice',
    bandwidthHz: 8_000,
    category: 'voice',
    recommendedDemod: 'am',
    color: '#fbbf24',
    continuous: true,
    blurb:
      'Amplitude modulation: a steady carrier with sidebands. The carrier shows as a bright centre spike.',
    realWorld: 'Aircraft band (118–137 MHz), AM broadcast, CB radio.',
    waterfall:
      'A bright central carrier line flanked by two symmetric audio sidebands.',
  },
  usb: {
    kind: 'usb',
    label: 'SSB (Upper)',
    bandwidthHz: 2_700,
    category: 'voice',
    recommendedDemod: 'usb',
    color: '#f472b6',
    continuous: true,
    blurb:
      'Single sideband, upper. Suppressed carrier and one sideband — spectrum-efficient voice used on HF.',
    realWorld: 'Ham HF above 10 MHz, marine/aeronautical HF, military voice.',
    waterfall:
      'A narrow, ragged band with no carrier line, only on one side of the tuned point.',
  },
  lsb: {
    kind: 'lsb',
    label: 'SSB (Lower)',
    bandwidthHz: 2_700,
    category: 'voice',
    recommendedDemod: 'lsb',
    color: '#f472b6',
    continuous: true,
    blurb:
      'Single sideband, lower. Same as USB but the audio lives below the carrier frequency.',
    realWorld: 'Ham HF below 10 MHz (80 m / 40 m voice nets).',
    waterfall:
      'A narrow ragged band with no carrier line, on the lower side of the tuned point.',
  },
  cw: {
    kind: 'cw',
    label: 'CW / Morse',
    bandwidthHz: 200,
    category: 'beacon',
    recommendedDemod: 'cw',
    color: '#e879f9',
    continuous: false,
    blurb:
      'On/off keyed carrier — Morse code. Extremely narrow, punches through noise better than any voice mode.',
    realWorld: 'Ham CW, beacons, maritime NAVTEX-adjacent, emergency keying.',
    waterfall:
      'A single hair-thin line blinking on and off in dot/dash rhythm.',
  },
  fsk2: {
    kind: 'fsk2',
    label: '2-FSK Data',
    bandwidthHz: 12_000,
    category: 'data',
    recommendedDemod: 'nfm',
    color: '#22d3ee',
    continuous: false,
    blurb:
      'Binary frequency-shift keying: bits toggle between two tones. Sent in short packets.',
    realWorld: 'POCSAG pagers, telemetry, AX.25 packet, some IoT links.',
    waterfall: 'Two parallel rails that light up together in short bursts.',
  },
  ook: {
    kind: 'ook',
    label: 'OOK / ASK',
    bandwidthHz: 6_000,
    category: 'data',
    recommendedDemod: 'am',
    color: '#fb923c',
    continuous: false,
    blurb:
      'On/off keying — the carrier simply switches on and off to send bits. Dead simple, everywhere in the ISM bands.',
    realWorld:
      'Weather/temperature sensors, garage remotes, keyfobs, doorbells (433/315 MHz).',
    waterfall: 'A single line stuttering in fast irregular bursts (a packet).',
  },
  lora: {
    kind: 'lora',
    label: 'LoRa (CSS)',
    bandwidthHz: 125_000,
    category: 'spread',
    recommendedDemod: 'raw',
    color: '#a78bfa',
    continuous: false,
    blurb:
      'Chirp spread spectrum: each symbol is a frequency sweep. Trades data rate for astonishing range and noise immunity.',
    realWorld: 'LoRaWAN IoT sensors, Meshtastic, long-range telemetry.',
    waterfall:
      'Unmistakable diagonal sawtooth ramps sweeping across the channel.',
  },
  psk: {
    kind: 'psk',
    label: 'PSK Burst',
    bandwidthHz: 100_000,
    category: 'data',
    recommendedDemod: 'raw',
    color: '#f87171',
    continuous: false,
    blurb:
      'Phase-shift-keyed digital burst. Constant-ish envelope, rectangular occupied bandwidth — a modern data/telemetry link.',
    realWorld: 'Drone command & telemetry, satellite downlinks, digital modes.',
    waterfall:
      'A flat-topped rectangular block that appears and vanishes as frames pass.',
  },
  fhss: {
    kind: 'fhss',
    label: 'Freq Hopper',
    bandwidthHz: 20_000,
    category: 'spread',
    recommendedDemod: 'nfm',
    color: '#facc15',
    continuous: false,
    blurb:
      'Frequency-hopping spread spectrum. A narrow carrier that leaps pseudo-randomly across the band to resist jamming and interception.',
    realWorld:
      'Bluetooth, some drone control links, military/tactical radios, cordless phones.',
    waterfall:
      'Scattered short dashes sprinkled unpredictably across the whole span.',
  },
  radar: {
    kind: 'radar',
    label: 'Pulsed Radar',
    bandwidthHz: 300_000,
    category: 'radar',
    recommendedDemod: 'raw',
    color: '#fca5a5',
    continuous: false,
    blurb:
      'Periodic high-power pulses, often chirped. The pulse repetition interval sets the rhythm.',
    realWorld: 'Weather, marine and air-surveillance radar; ranging systems.',
    waterfall:
      'A bright wide line strobing at a steady pulse-repetition rhythm.',
  },
};

export const ALL_KINDS: SignalKind[] = Object.keys(KIND_INFO) as SignalKind[];
