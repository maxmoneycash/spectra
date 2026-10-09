import type { EmitterConfig } from '../sim/emitters';
import type { SceneSpec } from '../engine/protocol';
import { CLOSED_SQUELCH_DB } from '../store/modes';

export type CtfCategory = 'recon' | 'decode' | 'identify' | 'analysis' | 'intercept';

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
  /**
   * Squelch the receiver is set to when the challenge opens, dB. Defaults to
   * wide open (`DEFAULT_SQUELCH_DB`). Only Below the Gate raises it: its whole
   * premise is a gate sitting above the beacon.
   */
  startSquelchDb?: number;
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
      { id: 'a', kind: 'wfm', freqHz: 98.1 * MHZ, powerDb: -3, speech: 'talk-fm-a', seed: 401 },
      { id: 'b', kind: 'wfm', freqHz: 98.7 * MHZ, powerDb: -5, speech: 'talk-fm-b', seed: 402 },
      { id: 'c', kind: 'wfm', freqHz: 98.9 * MHZ, powerDb: -7, speech: 'talk-fm-c', seed: 403 },
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
      'Something is keying a repeating message on 40 m. Tune it in CW, centre the tone, and read what it is sending. The flag is the two-word message after the callsign.',
    answerHint: 'Two words, e.g. GOOD MORNING',
    hints: [
      'Switch to CW mode — the decoder only runs there.',
      'Park the VFO right on the carrier; the tone should sit near 650 Hz.',
    ],
    flagHash: '8c0dc4931e053d877886ab7f09898f5f',
    centerFreqHz: 7.05 * MHZ,
    noiseSigma: 0.03,
    emitters: [
      {
        id: 'cw',
        kind: 'cw',
        freqHz: 7.061 * MHZ,
        powerDb: -4,
        wpm: 16,
        text: 'CQ DE SPECTRA LISTEN UP  ',
        seed: 405,
      },
      { id: 'v1', kind: 'lsb', freqHz: 7.022 * MHZ, powerDb: -9, speech: 'hf-ssb', seed: 406 },
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
      { id: 'am', kind: 'am', freqHz: 124.2 * MHZ, powerDb: -5, speech: 'airband', seed: 409 },
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
    answerHint: 'The protocol name, one word',
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
      'Measure the sweep width of that chirping emitter — the band each symbol sweeps across. Report it in kHz, to the nearest whole kHz.',
    answerHint: 'kHz, e.g. 250',
    hints: [
      "The Stations panel's bandwidth is what the detector sees above its threshold. A chirp's skirts make that read wide.",
      'Tap the signal. Once the receiver has watched a few symbols sweep, the card reads the sweep itself.',
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
    id: 'spread-factor',
    name: 'Spread Factor',
    category: 'analysis',
    points: 200,
    brief:
      'The LoRa node on 868.3 MHz is running a non-default spreading factor. Recover it from the chirp itself.',
    answerHint: 'The spreading factor, e.g. 7',
    hints: [
      'A chirp sweeps its whole bandwidth once per symbol, and a symbol lasts 2^SF samples of that bandwidth — the slope of the ramp is the spreading factor.',
      'Tap the signal and let the receiver watch a few symbols; the card reads SF and width from the sweep.',
    ],
    flagHash: '8274d59b3fb89ba2747026461747ea70',
    centerFreqHz: 868.0 * MHZ,
    noiseSigma: 0.026,
    emitters: [
      { id: 'l', kind: 'lora', freqHz: 868.3 * MHZ, powerDb: -5, sf: 9, bwHz: 125_000, seed: 515 },
      { id: 'f', kind: 'fsk2', freqHz: 867.7 * MHZ, powerDb: -8, baud: 2400, seed: 516 },
      { id: 'o', kind: 'ook', freqHz: 868.45 * MHZ, powerDb: -9, baud: 2000, seed: 517 },
    ],
    suggest: 'raw',
  },
  {
    id: 'net-traffic',
    name: 'Net Traffic',
    category: 'intercept',
    points: 250,
    brief:
      'A directed net is running on one of the repeaters in this span, and one check-in brought traffic for the net. Monitor the net and name that station.',
    answerHint: 'Callsign, e.g. KX6ABC',
    hints: [
      'Nets run on repeaters: an NFM voice signal that keys and unkeys with a courtesy tone. Stay on it — the log keeps only what you were tuned to.',
      'Net control hands the floor to whoever has traffic. Read the log.',
    ],
    flagHash: 'ce79465d91a7ed3bbbd5498ba39807e1',
    centerFreqHz: 442.5 * MHZ,
    noiseSigma: 0.03,
    emitters: [
      { id: 'net', kind: 'nfm', freqHz: 442.35 * MHZ, powerDb: -6, speech: 'net-70cm', seed: 601 },
      { id: 'rpt', kind: 'nfm', freqHz: 442.9 * MHZ, powerDb: -5, speech: 'repeater-2m', seed: 602 },
      { id: 'd', kind: 'fsk2', freqHz: 442.6 * MHZ, powerDb: -10, seed: 603 },
    ],
    suggest: 'nfm',
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
    answerHint: 'The four-letter abbreviation, e.g. OFDM',
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
      { id: 'v', kind: 'lsb', freqHz: 7.16 * MHZ, powerDb: -5, speech: 'hf-ssb', seed: 422 },
    ],
    suggest: 'lsb',
  },
  {
    id: 'deep-cut',
    name: 'Deep Cut',
    category: 'decode',
    points: 350,
    brief:
      'A weak beacon is keying near a much louder signal, and the noise floor is up. Find it on the waterfall, dig it out of the noise, and read its message. The flag is the two-word message after the callsign.',
    answerHint: 'Two words, e.g. GOOD MORNING',
    hints: [
      'The loud signal is a decoy. The beacon sits well below it in level, not under it in frequency.',
      'Narrow the bandwidth: CW needs only a few hundred Hz, and every hertz you exclude is noise you do not hear.',
    ],
    flagHash: '8aa3ecfcd0e0396a22c682132d47155e',
    centerFreqHz: 14.1 * MHZ,
    noiseSigma: 0.055,
    emitters: [
      {
        id: 'weak',
        kind: 'cw',
        freqHz: 14.118 * MHZ,
        powerDb: -13,
        wpm: 14,
        text: 'DE SPECTRA QUIET CARRIER  ',
        seed: 423,
      },
      { id: 'loud', kind: 'wfm', freqHz: 14.04 * MHZ, powerDb: -2, message: 'tone', seed: 424 },
    ],
    suggest: 'cw',
  },
  {
    id: 'split-the-pair',
    name: 'Split the Pair',
    category: 'intercept',
    points: 300,
    brief:
      'Two stations are keying 350 Hz apart on 20 m — close enough that a stock CW filter hears both at once and the copy comes out as interleaved nonsense. Separate them and copy the one sending a two-word message. The other is only sending test.',
    answerHint: 'Two words',
    hints: [
      'Your CW filter defaults to 500 Hz. The pair is inside that.',
      'Narrow the bandwidth until only one carrier is left in the passband, then tune onto it.',
    ],
    flagHash: '3f419efae0d2b9ef6ab05b2996534134',
    centerFreqHz: 14.02 * MHZ,
    noiseSigma: 0.028,
    emitters: [
      { id: 'flag', kind: 'cw', freqHz: 14.02 * MHZ, powerDb: -5, wpm: 15, text: 'DE SPECTRA NARROW FILTER  ', seed: 501 },
      { id: 'decoy', kind: 'cw', freqHz: 14.02035 * MHZ, powerDb: -5, wpm: 15, text: 'VVV VVV TEST DE TEST  ', seed: 502 },
    ],
    suggest: 'cw',
  },
  {
    id: 'repeater-input',
    name: 'Working the Input',
    category: 'intercept',
    points: 300,
    brief:
      "You've found a 2 m repeater's output — narrowband voice, easy copy. But the interesting traffic is what stations send *to* it. Find the repeater's input and copy the two-word message being keyed there.",
    answerHint: 'Two words',
    hints: [
      'A repeater receives on one frequency and retransmits on another.',
      'The standard 2 m offset is 600 kHz, and below 147 MHz it is conventionally negative.',
    ],
    flagHash: 'c944711df5f1ab93b747bb463a7fa833',
    centerFreqHz: 146.64 * MHZ,
    noiseSigma: 0.03,
    emitters: [
      { id: 'output', kind: 'nfm', freqHz: 146.94 * MHZ, powerDb: -4, speech: 'repeater-2m', seed: 503 },
      { id: 'input', kind: 'cw', freqHz: 146.34 * MHZ, powerDb: -7, wpm: 16, text: 'DE SPECTRA SPLIT SHIFT  ', seed: 504 },
    ],
    suggest: 'nfm',
  },
  {
    id: 'squelch-down',
    name: 'Below the Gate',
    category: 'intercept',
    points: 250,
    brief:
      'There is a beacon here, but your receiver is not passing it — the squelch is set above the signal, so the audio stays muted and the decoder never sees a thing. Open the receiver up and copy the two-word message.',
    answerHint: 'Two words',
    hints: [
      'The waterfall shows the carrier even when you cannot hear it — the gate is downstream of the display.',
      'Squelch mutes the audio the CW decoder listens to. Lower it until the signal passes.',
    ],
    flagHash: 'dc5e8fb39331f6f91229b2e810ebbf70',
    centerFreqHz: 10.12 * MHZ,
    noiseSigma: 0.02,
    emitters: [
      { id: 'weak', kind: 'cw', freqHz: 10.125 * MHZ, powerDb: -26, wpm: 14, text: 'DE SPECTRA OPEN THE GATE  ', seed: 505 },
    ],
    // The gate really is above the beacon: it peaks at -26 dB of channel
    // level, and at the stock -80 this copied the moment you tuned it.
    startSquelchDb: CLOSED_SQUELCH_DB,
    suggest: 'cw',
  },
  {
    id: 'catch-the-rotation',
    name: 'Catch the Rotation',
    category: 'intercept',
    points: 300,
    brief:
      'The NCDXF network shares 14.100 MHz between eighteen beacons worldwide. Each transmits for exactly ten seconds — callsign, four long dashes, grid square — then hands off, in a fixed order that repeats every three minutes. Find the beacon, settle in CW, and copy the rotation. The flag is the callsign of the beacon that transmits immediately after W6WX.',
    answerHint: 'A callsign, e.g. ZL6B',
    hints: [
      'Ten seconds per station. Let the decoder run through a whole rotation instead of chasing single letters.',
      'The order never changes. Once you have copied W6WX, the very next slot is your answer.',
    ],
    flagHash: '44138339109914c3e794996613d81ba4',
    // The beacon keeps its real frequency; the band is centred below it so
    // it has to be found and tuned, not handed over at the centre marker.
    centerFreqHz: 14.085 * MHZ,
    noiseSigma: 0.028,
    emitters: [
      { id: 'ncdxf-live', kind: 'cw', freqHz: 14.1 * MHZ, powerDb: -4, ncdxfBand: 0 },
      { id: 'v', kind: 'lsb', freqHz: 14.07 * MHZ, powerDb: -10, speech: 'hf-ssb', seed: 506 },
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
  intercept: 'Intercept',
};
