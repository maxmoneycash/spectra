import type { EmitterConfig } from '../sim/emitters';
import type { DemodMode, SignalKind } from '../sim/signal-kinds';
import type { SceneSpec } from '../engine/protocol';

export type Objective =
  | { type: 'count'; count: number; label: string }
  | { type: 'identify'; kind: SignalKind; label: string }
  | { type: 'tune'; offsetHz: number; mode: DemodMode; tolHz: number; label: string }
  | { type: 'decode'; text: string; label: string };

export interface Scenario {
  id: string;
  name: string;
  tagline: string;
  brief: string;
  difficulty: 'tutorial' | 'easy' | 'medium' | 'hard';
  band: string;
  centerFreqHz: number;
  noiseSigma: number;
  emitters: EmitterConfig[];
  objectives: Objective[];
}

const MHZ = 1_000_000;

export const SCENARIOS: Scenario[] = [
  {
    id: 'first-contact',
    name: 'First Contact',
    tagline: 'Learn the receiver on the FM broadcast band.',
    brief:
      'You are parked in the middle of the commercial FM band. Wide green blocks are music stations. Tune to one in WFM mode and listen, then identify it.',
    difficulty: 'tutorial',
    band: 'FM broadcast (88–108 MHz)',
    centerFreqHz: 98.5 * MHZ,
    noiseSigma: 0.02,
    emitters: [
      { id: 's1', kind: 'wfm', freqHz: 98.1 * MHZ, powerDb: -2, message: 'music', seed: 11 },
      { id: 's2', kind: 'wfm', freqHz: 98.7 * MHZ, powerDb: -4, message: 'music', seed: 22 },
      { id: 's3', kind: 'wfm', freqHz: 98.9 * MHZ, powerDb: -6, message: 'music', seed: 33 },
    ],
    objectives: [
      { type: 'count', count: 2, label: 'Find at least 2 stations' },
      { type: 'tune', offsetHz: -400_000, mode: 'wfm', tolHz: 60_000, label: 'Tune to the 98.1 station in WFM' },
      { type: 'identify', kind: 'wfm', label: 'Identify a Broadcast FM signal' },
    ],
  },
  {
    id: 'air-band',
    name: 'The Air Band',
    tagline: 'AM voice hides among the noise.',
    brief:
      'Aircraft and towers talk in AM. Look for a bright carrier spike with symmetric sidebands, tune it in AM, and identify it.',
    difficulty: 'easy',
    band: 'Airband (118–137 MHz)',
    centerFreqHz: 124.0 * MHZ,
    noiseSigma: 0.03,
    emitters: [
      { id: 'a1', kind: 'am', freqHz: 124.2 * MHZ, powerDb: -6, message: 'voice', seed: 5 },
      { id: 'a2', kind: 'am', freqHz: 123.7 * MHZ, powerDb: -9, message: 'voice', seed: 6 },
      { id: 'n1', kind: 'nfm', freqHz: 124.35 * MHZ, powerDb: -8, seed: 7 },
      { id: 'c1', kind: 'cw', freqHz: 123.55 * MHZ, powerDb: -10, wpm: 16, seed: 8 },
    ],
    objectives: [
      { type: 'identify', kind: 'am', label: 'Identify an AM voice signal' },
      { type: 'tune', offsetHz: 200_000, mode: 'am', tolHz: 20_000, label: 'Tune the 124.2 AM station' },
      { type: 'identify', kind: 'nfm', label: 'Identify a Narrowband FM signal' },
    ],
  },
  {
    id: 'morse-intercept',
    name: 'Morse Intercept',
    tagline: 'Decode the beacon.',
    brief:
      'A CW beacon is keying a message on 40 m. Tune it in CW mode, center the tone, and let the decoder read it. What is the callsign?',
    difficulty: 'medium',
    band: 'HF / 40 m (7 MHz)',
    centerFreqHz: 7.05 * MHZ,
    noiseSigma: 0.035,
    emitters: [
      { id: 'cw1', kind: 'cw', freqHz: 7.06 * MHZ, powerDb: -4, wpm: 18, text: 'CQ CQ DE SPECTRA SPECTRA K', seed: 3 },
      { id: 'l1', kind: 'lsb', freqHz: 7.02 * MHZ, powerDb: -8, message: 'voice', seed: 9 },
      { id: 'l2', kind: 'lsb', freqHz: 7.08 * MHZ, powerDb: -11, message: 'voice', seed: 12 },
    ],
    objectives: [
      { type: 'tune', offsetHz: 10_000, mode: 'cw', tolHz: 3_000, label: 'Tune the CW beacon in CW mode' },
      { type: 'decode', text: 'SPECTRA', label: "Decode the beacon's callsign" },
      { type: 'identify', kind: 'lsb', label: 'Identify a lower-sideband voice signal' },
    ],
  },
  {
    id: 'ism-sweep',
    name: 'ISM Sensor Sweep',
    tagline: 'Catalog the chatter in the 915 MHz junk band.',
    brief:
      'The ISM band is full of sensors, remotes, and IoT links. Find the diagonal LoRa chirps and the stuttering OOK/FSK sensor bursts. Catalog everything.',
    difficulty: 'medium',
    band: 'ISM (902–928 MHz)',
    centerFreqHz: 915.0 * MHZ,
    noiseSigma: 0.03,
    emitters: [
      { id: 'lo1', kind: 'lora', freqHz: 915.2 * MHZ, powerDb: -5, sf: 8, seed: 1 },
      { id: 'lo2', kind: 'lora', freqHz: 914.7 * MHZ, powerDb: -8, sf: 9, seed: 2 },
      { id: 'ok1', kind: 'ook', freqHz: 915.35 * MHZ, powerDb: -6, baud: 2000, seed: 4 },
      { id: 'ok2', kind: 'ook', freqHz: 914.85 * MHZ, powerDb: -9, baud: 4000, seed: 14 },
      { id: 'fs1', kind: 'fsk2', freqHz: 915.45 * MHZ, powerDb: -7, baud: 2400, seed: 15 },
    ],
    objectives: [
      { type: 'count', count: 4, label: 'Catalog at least 4 emitters' },
      { type: 'identify', kind: 'lora', label: 'Identify a LoRa chirp signal' },
      { type: 'identify', kind: 'ook', label: 'Identify an OOK/ASK sensor' },
    ],
  },
  {
    id: 'drone-hunt',
    name: 'Drone Hunt',
    tagline: 'A UAS is operating. Find its links.',
    brief:
      'Somewhere in this band a drone is transmitting a PSK telemetry downlink and a frequency-hopping control link, amid interference. Identify the drone links.',
    difficulty: 'hard',
    band: 'Tactical / 2.4 GHz-style',
    centerFreqHz: 2_440.0 * MHZ,
    noiseSigma: 0.04,
    emitters: [
      { id: 'psk1', kind: 'psk', freqHz: 2_440.25 * MHZ, powerDb: -5, symRate: 90_000, seed: 21 },
      { id: 'fh1', kind: 'fhss', freqHz: 2_440.0 * MHZ, powerDb: -7, hopSpanHz: 800_000, dwellMs: 45, seed: 31 },
      { id: 'wv1', kind: 'wfm', freqHz: 2_439.7 * MHZ, powerDb: -6, message: 'tone', seed: 41 },
      { id: 'nf1', kind: 'nfm', freqHz: 2_440.42 * MHZ, powerDb: -10, seed: 51 },
    ],
    objectives: [
      { type: 'identify', kind: 'psk', label: 'Identify the PSK telemetry burst' },
      { type: 'identify', kind: 'fhss', label: 'Identify the frequency-hopping control link' },
      { type: 'count', count: 3, label: 'Map at least 3 emitters in the band' },
    ],
  },
  {
    id: 'fox-hunt',
    name: 'Fox Hunt',
    tagline: 'One weak beacon. Lots of noise.',
    brief:
      'A low-power NFM beacon is hidden near the noise floor and only keys up intermittently. Raise the threshold in your head, find it, and tune it in.',
    difficulty: 'hard',
    band: '2 m (144 MHz)',
    centerFreqHz: 144.2 * MHZ,
    noiseSigma: 0.055,
    emitters: [
      { id: 'fox', kind: 'nfm', freqHz: 144.33 * MHZ, powerDb: -16, message: 'voice', devHz: 3000, seed: 77 },
      { id: 'd1', kind: 'fsk2', freqHz: 144.05 * MHZ, powerDb: -10, seed: 78 },
    ],
    objectives: [
      { type: 'tune', offsetHz: 130_000, mode: 'nfm', tolHz: 15_000, label: 'Zero in on the hidden beacon' },
      { type: 'identify', kind: 'nfm', label: 'Confirm it as Narrowband FM' },
    ],
  },
  {
    id: 'wideband',
    name: 'Wideband Sandbox',
    tagline: 'One of everything. Free play.',
    brief:
      'A dense band with every modulation the simulator knows. No objectives — explore, tune, identify, and record. Great for learning what each signal looks and sounds like.',
    difficulty: 'easy',
    band: 'Sandbox',
    centerFreqHz: 433.0 * MHZ,
    noiseSigma: 0.03,
    emitters: [
      { id: 'w', kind: 'wfm', freqHz: 432.62 * MHZ, powerDb: -4, message: 'music', seed: 101 },
      { id: 'n', kind: 'nfm', freqHz: 432.8 * MHZ, powerDb: -6, seed: 102 },
      { id: 'a', kind: 'am', freqHz: 432.95 * MHZ, powerDb: -6, seed: 103 },
      { id: 'u', kind: 'usb', freqHz: 433.08 * MHZ, powerDb: -8, seed: 104 },
      { id: 'c', kind: 'cw', freqHz: 433.16 * MHZ, powerDb: -6, wpm: 20, seed: 105 },
      { id: 'f', kind: 'fsk2', freqHz: 433.28 * MHZ, powerDb: -7, seed: 106 },
      { id: 'o', kind: 'ook', freqHz: 433.36 * MHZ, powerDb: -6, seed: 107 },
      { id: 'l', kind: 'lora', freqHz: 433.45 * MHZ, powerDb: -6, sf: 8, seed: 108 },
      { id: 'p', kind: 'psk', freqHz: 432.5 * MHZ, powerDb: -6, symRate: 70_000, seed: 109 },
      { id: 'r', kind: 'radar', freqHz: 433.0 * MHZ, powerDb: -3, priUs: 1500, seed: 110 },
    ],
    objectives: [],
  },
];

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

export function toSceneSpec(s: Scenario): SceneSpec {
  return {
    centerFreqHz: s.centerFreqHz,
    noiseSigma: s.noiseSigma,
    emitters: s.emitters,
  };
}
