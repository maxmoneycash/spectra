import type { EmitterConfig } from '../sim/emitters';
import type { SceneSpec } from '../engine/protocol';

export type CtfCategory = 'recon' | 'decode' | 'identify' | 'analysis';

export interface Challenge {
  id: string;
  name: string;
  category: CtfCategory;
  points: number;
  /** What the player has to do, in operator language. */
  brief: string;
  /** Shape of the expected answer, so nobody loses points to formatting. */
  answerHint: string;
  /** Progressive hints — taking one costs points. */
  hints: string[];
  /** Truncated SHA-256 of `spectra-ctf-v1|<normalised answer>`. */
  flagHash: string;
  centerFreqHz: number;
  noiseSigma: number;
  emitters: EmitterConfig[];
  /** Suggested starting demod mode, shown as a nudge. */
  suggest?: string;
}

const MHZ = 1_000_000;

/**
 * Challenges are graded against the simulator's ground truth, so every answer
 * is checkable and nothing depends on a server. Flags are stored as hashes —
 * not to be unbreakable, but so the answers aren't sitting in plain sight in
 * the bundle for anyone who opens devtools out of idle curiosity.
 */
export const CHALLENGES: Challenge[] = [
  {
    id: 'first-light',
    name: 'First Light',
    category: 'recon',
    points: 100,
    brief:
      'A quiet stretch of the FM broadcast band. Count every distinct transmitter you can see in the span — the detector will help once the waterfall fills in.',
    answerHint: 'A number, e.g. 3',
    hints: ['Wide solid blocks are broadcast FM.', 'Check the Stations panel once it settles.'],
    flagHash: '67325042694dd5ad3d3e18bc47a1528e',
    centerFreqHz: 98.5 * MHZ,
    noiseSigma: 0.022,
    emitters: [
      { id: 'a', kind: 'wfm', freqHz: 98.1 * MHZ, powerDb: -3, message: 'music', seed: 401 },
      { id: 'b', kind: 'wfm', freqHz: 98.7 * MHZ, powerDb: -5, message: 'music', seed: 402 },
      { id: 'c', kind: 'wfm', freqHz: 98.9 * MHZ, powerDb: -7, message: 'music', seed: 403 },
      { id: 'd', kind: 'nfm', freqHz: 98.32 * MHZ, powerDb: -9, seed: 404 },
    ],
    suggest: 'wfm',
  },
  {
    id: 'morse-beacon',
    name: 'Beacon Traffic',
    category: 'decode',
    points: 200,
    brief:
      'Something is keying a repeating message on 40 m. Tune it in CW, centre the tone, and read what it is sending. The flag is the whole braced string.',
    answerHint: 'SPECTRA{...}',
    hints: [
      'Switch to CW mode — the decoder only runs there.',
      'Park the VFO right on the carrier; the tone should sit near 650 Hz.',
    ],
    flagHash: '87d3fa9191018db0400a28f40effe815',
    centerFreqHz: 7.05 * MHZ,
    noiseSigma: 0.03,
    emitters: [
      {
        id: 'cw',
        kind: 'cw',
        freqHz: 7.061 * MHZ,
        powerDb: -4,
        wpm: 16,
        text: 'SPECTRA{LISTEN UP}  ',
        seed: 405,
      },
      { id: 'v1', kind: 'lsb', freqHz: 7.022 * MHZ, powerDb: -9, message: 'voice', seed: 406 },
    ],
    suggest: 'cw',
  },
  {
    id: 'fox-hunt',
    name: 'Fox Hunt',
    category: 'analysis',
    points: 250,
    brief:
      'A low-power beacon is hiding just above the noise on 2 m, and it only keys up now and then. Report its centre frequency in MHz to three decimals.',
    answerHint: 'MHz to 3 decimals, e.g. 144.250',
    hints: [
      'Let the waterfall run — an intermittent signal paints a dashed line.',
      'Zoom in with the scroll wheel; the readout follows your cursor.',
    ],
    flagHash: '25534b319b0811aa6a0315f3f1b67ac0',
    centerFreqHz: 144.2 * MHZ,
    noiseSigma: 0.05,
    emitters: [
      { id: 'fox', kind: 'nfm', freqHz: 144.33 * MHZ, powerDb: -15, devHz: 3000, seed: 407 },
      { id: 'd1', kind: 'fsk2', freqHz: 144.06 * MHZ, powerDb: -10, seed: 408 },
    ],
    suggest: 'nfm',
  },
  {
    id: 'carrier-hunt',
    name: 'Carrier in the Clear',
    category: 'analysis',
    points: 150,
    brief:
      'Airband. One transmitter shows the bright centre spike of a full carrier with symmetric sidebands. Give its frequency in MHz to three decimals.',
    answerHint: 'MHz to 3 decimals, e.g. 124.200',
    hints: [
      'AM keeps its carrier; FM does not.',
      'The spike is the tallest single line, not the widest block.',
    ],
    flagHash: '1ef3450659306409ff042b6b92420006',
    centerFreqHz: 124.0 * MHZ,
    noiseSigma: 0.03,
    emitters: [
      { id: 'am', kind: 'am', freqHz: 124.2 * MHZ, powerDb: -5, message: 'voice', seed: 409 },
      { id: 'n', kind: 'nfm', freqHz: 123.78 * MHZ, powerDb: -8, seed: 410 },
      { id: 'f', kind: 'fsk2', freqHz: 124.42 * MHZ, powerDb: -9, seed: 411 },
    ],
    suggest: 'am',
  },
  {
    id: 'mode-id',
    name: 'Diagonal Rain',
    category: 'identify',
    points: 150,
    brief:
      'One emitter in this ISM band paints unmistakable diagonal ramps across its channel. Name the modulation.',
    answerHint: 'One word, e.g. nfm',
    hints: [
      'The signature is a frequency sweep repeated per symbol.',
      'Check the Library tab if the waterfall shape looks familiar.',
    ],
    flagHash: '44f1105ab3c39425a3ebdc87ac6a36c4',
    centerFreqHz: 915.0 * MHZ,
    noiseSigma: 0.028,
    emitters: [
      { id: 'l', kind: 'lora', freqHz: 915.15 * MHZ, powerDb: -5, sf: 8, seed: 412 },
      { id: 'o', kind: 'ook', freqHz: 914.8 * MHZ, powerDb: -8, baud: 2000, seed: 413 },
    ],
    suggest: 'raw',
  },
  {
    id: 'chirp-width',
    name: 'How Wide Is It',
    category: 'analysis',
    points: 200,
    brief:
      'Measure the occupied bandwidth of that chirping emitter. Report it in kHz, to the nearest whole kHz.',
    answerHint: 'kHz, e.g. 125',
    hints: [
      'The Stations panel reports a bandwidth per signal.',
      'Chirp spread spectrum uses a small set of standard channel widths.',
    ],
    flagHash: 'c9ac6edd606391462d00592170131641',
    centerFreqHz: 915.0 * MHZ,
    noiseSigma: 0.026,
    emitters: [
      { id: 'l', kind: 'lora', freqHz: 915.1 * MHZ, powerDb: -4, sf: 8, bwHz: 125_000, seed: 414 },
    ],
    suggest: 'raw',
  },
  {
    id: 'ism-census',
    name: 'ISM Census',
    category: 'recon',
    points: 200,
    brief:
      'The junk band is busy. Count every distinct emitter present — the bursty ones count too, so give the waterfall time to catch them.',
    answerHint: 'A number, e.g. 4',
    hints: [
      'Bursty transmitters only appear when they key up.',
      'The Stations list holds a signal after it stops, so let it accumulate.',
    ],
    flagHash: '559ea6cbcc5dd9a5cabbe6c335fa8f4a',
    centerFreqHz: 915.0 * MHZ,
    noiseSigma: 0.03,
    emitters: [
      { id: 'l1', kind: 'lora', freqHz: 915.2 * MHZ, powerDb: -5, sf: 8, seed: 415 },
      { id: 'l2', kind: 'lora', freqHz: 914.68 * MHZ, powerDb: -8, sf: 9, seed: 416 },
      { id: 'o1', kind: 'ook', freqHz: 915.38 * MHZ, powerDb: -6, baud: 2000, seed: 417 },
      { id: 'o2', kind: 'ook', freqHz: 914.86 * MHZ, powerDb: -9, baud: 4000, seed: 418 },
      { id: 'f1', kind: 'fsk2', freqHz: 915.46 * MHZ, powerDb: -7, baud: 2400, seed: 419 },
    ],
    suggest: 'raw',
  },
  {
    id: 'hopper',
    name: 'Now You See It',
    category: 'identify',
    points: 250,
    brief:
      'One emitter here refuses to sit still — it scatters short bursts across the whole span instead of holding a channel. Name that technique.',
    answerHint: 'One word, e.g. psk',
    hints: [
      'It is deliberate, not drift: the transmitter changes channel on a schedule.',
      'Bluetooth and tactical radios use it to resist jamming.',
    ],
    flagHash: '6620017677471a17cac22ed1db046623',
    centerFreqHz: 2_440.0 * MHZ,
    noiseSigma: 0.035,
    emitters: [
      {
        id: 'fh',
        kind: 'fhss',
        freqHz: 2_440.0 * MHZ,
        powerDb: -6,
        hopSpanHz: 800_000,
        dwellMs: 45,
        seed: 420,
      },
      { id: 'p', kind: 'psk', freqHz: 2_440.3 * MHZ, powerDb: -6, symRate: 90_000, seed: 421 },
    ],
    suggest: 'nfm',
  },
  {
    id: 'sideband',
    name: 'Which Sideband',
    category: 'identify',
    points: 200,
    brief:
      'A single suppressed-carrier voice signal sits on 40 m. Work out which sideband it is using — the wrong choice sounds like nonsense.',
    answerHint: 'usb or lsb',
    hints: [
      'Try both and listen: only one resolves into intelligible speech.',
      'Below 10 MHz, convention favours one of the two.',
    ],
    flagHash: 'f30afdffe3ec3dd984876bbefaf036f2',
    centerFreqHz: 7.15 * MHZ,
    noiseSigma: 0.03,
    emitters: [
      { id: 'v', kind: 'lsb', freqHz: 7.16 * MHZ, powerDb: -5, message: 'voice', seed: 422 },
    ],
    suggest: 'lsb',
  },
  {
    id: 'deep-cut',
    name: 'Deep Cut',
    category: 'decode',
    points: 350,
    brief:
      'A weak beacon is buried under a loud neighbour and the noise floor is up. Dig it out and read its message. The flag is the whole braced string.',
    answerHint: 'SPECTRA{...}',
    hints: [
      'Narrow the bandwidth — CW needs only a few hundred Hz.',
      'The loud one is a decoy. The beacon sits below it in level, not in frequency.',
    ],
    flagHash: '604ba5d8cfd11d36af721595da64eb35',
    centerFreqHz: 14.1 * MHZ,
    noiseSigma: 0.055,
    emitters: [
      {
        id: 'weak',
        kind: 'cw',
        freqHz: 14.118 * MHZ,
        powerDb: -13,
        wpm: 14,
        text: 'SPECTRA{QUIET CARRIER}  ',
        seed: 423,
      },
      { id: 'loud', kind: 'wfm', freqHz: 14.04 * MHZ, powerDb: -2, message: 'tone', seed: 424 },
    ],
    suggest: 'cw',
  },
];

export const challengeById = (id: string) => CHALLENGES.find((c) => c.id === id);

export const toSceneSpec = (c: Challenge): SceneSpec => ({
  centerFreqHz: c.centerFreqHz,
  noiseSigma: c.noiseSigma,
  emitters: c.emitters,
});

export const TOTAL_POINTS = CHALLENGES.reduce((s, c) => s + c.points, 0);

export const CATEGORY_LABEL: Record<CtfCategory, string> = {
  recon: 'Recon',
  decode: 'Decode',
  identify: 'Identify',
  analysis: 'Analysis',
};
