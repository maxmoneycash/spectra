import type { SceneSpec } from '../engine/protocol';
import type { ScanStatus } from '../engine/scanner';
import type { DemodMode, SignalKind } from '../sim/signal-kinds';
import type { DeckPage, PanelTab } from '../store/store';
import { CLOSED_SQUELCH_DB } from '../store/modes';

const MHZ = 1_000_000;

/** Everything a step's completion check can see. Built fresh from the store. */
export interface GuideCtx {
  running: boolean;
  /** Absolute tuned frequency, Hz. */
  tunedHz: number;
  mode: DemodMode;
  bandwidthHz: number;
  squelchDb: number;
  morseText: string;
  deckPage: DeckPage;
  panel: PanelTab;
  scanStatus: ScanStatus | null;
  selectedId: string | null;
  identified: SignalKind[];
  /** Intercepts logged since the lesson started. */
  newIntercepts: number;
}

/** UI the coach can point at. Matches `data-guide` attributes in the decks. */
export type GuideTarget = 'power' | 'mode' | 'bandwidth' | 'squelch' | 'tune' | 'scan' | 'waterfall';

export interface GuideStep {
  title: string;
  /** What to do, in one or two plain sentences. */
  body: string;
  /** Why it works — shown under the instruction, the actual teaching. */
  why?: string;
  target?: GuideTarget;
  /** Steer the phone deck / desktop inspector so the target is on screen. */
  deckPage?: DeckPage;
  panel?: PanelTab;
  /** Passes when the live receiver state shows the skill was done. Absent = a reading step. */
  check?: (c: GuideCtx) => boolean;
}

export interface Lesson {
  id: string;
  title: string;
  /** The receiver skill this lesson teaches. */
  skill: string;
  minutes: number;
  /** A practice range: same skill as its challenge, different signals and answers. */
  scene: SceneSpec;
  /** Mode to start in, if the lesson doesn't teach choosing one. */
  startMode?: DemodMode;
  /**
   * Squelch to start at, dB. Defaults to wide open. The squelch lesson starts
   * with the gate raised above its beacon — otherwise "the decoder prints
   * nothing" is false and the lesson completes itself.
   */
  startSquelchDb?: number;
  steps: GuideStep[];
  /** CTF challenge that tests this skill for points. */
  challengeId: string;
}

const near = (c: GuideCtx, hz: number, tol: number) => Math.abs(c.tunedHz - hz) <= tol;

export const LESSONS: Lesson[] = [
  {
    id: 'tune',
    title: 'Tune and listen',
    skill: 'Reading the waterfall, tuning a signal, choosing a demodulator',
    minutes: 2,
    challengeId: 'first-light',
    startMode: 'nfm',
    scene: {
      centerFreqHz: 101.3 * MHZ,
      noiseSigma: 0.02,
      emitters: [
        { id: 'g1', kind: 'wfm', freqHz: 100.9 * MHZ, powerDb: -3, message: 'music', seed: 901 },
        { id: 'g2', kind: 'wfm', freqHz: 101.5 * MHZ, powerDb: -4, speech: 'talk-fm-b', seed: 902 },
        { id: 'g3', kind: 'wfm', freqHz: 101.7 * MHZ, powerDb: -6, message: 'music', seed: 903 },
      ],
    },
    steps: [
      {
        title: 'Power on the receiver',
        body: 'Press the power button.',
        why: 'The waterfall starts scrolling: every row is one moment in time, and frequency runs left to right.',
        target: 'power',
        check: (c) => c.running,
      },
      {
        title: 'Lock onto a station',
        body: 'Tap one of the bright bands on the waterfall.',
        why: 'Bright means strong. Tapping snaps the receiver to the station’s center and picks a demodulator to fit its shape: WFM here, because broadcast FM is about 180 kHz wide.',
        target: 'waterfall',
        check: (c) => c.mode === 'wfm' && [100.9, 101.5, 101.7].some((f) => near(c, f * MHZ, 60_000)),
      },
      {
        title: 'Find the talk station',
        body: 'Tune 101.5 MHz, the station with a voice instead of music.',
        why: 'Use the frequency pill to type it in, or tap the band. Same mode, new station: retuning is just moving along the band.',
        target: 'tune',
        check: (c) => c.mode === 'wfm' && near(c, 101.5 * MHZ, 50_000),
      },
    ],
  },
  {
    id: 'modes',
    title: 'Pick the right mode',
    skill: 'Matching AM and FM demodulators to what you see',
    minutes: 3,
    challengeId: 'carrier-hunt',
    startMode: 'wfm',
    scene: {
      centerFreqHz: 119.0 * MHZ,
      noiseSigma: 0.025,
      emitters: [
        { id: 'twr', kind: 'am', freqHz: 119.25 * MHZ, powerDb: -6, speech: 'airband', seed: 911 },
        { id: 'fm', kind: 'nfm', freqHz: 118.8 * MHZ, powerDb: -7, message: 'voice', seed: 912 },
      ],
    },
    steps: [
      {
        title: 'Tune the tower',
        body: 'Tune 119.25 MHz.',
        why: 'Aircraft and towers use AM. On the waterfall it shows as a sharp carrier line with a sideband on each side.',
        target: 'tune',
        check: (c) => near(c, 119.25 * MHZ, 8_000),
      },
      {
        title: 'Hear a mismatch',
        body: 'Set the mode to NFM while you stay on the tower.',
        why: 'An FM demodulator ignores amplitude, which is exactly where AM keeps its audio. The voice goes quiet or distorted.',
        target: 'mode',
        deckPage: 'mode',
        check: (c) => c.mode === 'nfm' && near(c, 119.25 * MHZ, 8_000),
      },
      {
        title: 'Match the mode',
        body: 'Now set AM.',
        why: 'With the matching demodulator, the same signal comes through clean. When a signal sounds wrong, check the mode before anything else.',
        target: 'mode',
        deckPage: 'mode',
        check: (c) => c.mode === 'am' && near(c, 119.25 * MHZ, 8_000),
      },
      {
        title: 'Read the other signal',
        body: 'Tap the signal at 118.8 MHz and see which mode the receiver picks.',
        why: 'It picks NFM: no center carrier, one smooth hump about 12 kHz wide. Real radios have no auto-pick, and now you know how to choose yourself.',
        target: 'waterfall',
        check: (c) => c.mode === 'nfm' && near(c, 118.8 * MHZ, 8_000),
      },
    ],
  },
  {
    id: 'filter',
    title: 'Narrow the filter',
    skill: 'Using bandwidth to separate stations that overlap',
    minutes: 3,
    challengeId: 'split-the-pair',
    startMode: 'cw',
    scene: {
      centerFreqHz: 7.05 * MHZ,
      noiseSigma: 0.028,
      emitters: [
        { id: 'p1', kind: 'cw', freqHz: 7.03 * MHZ, powerDb: -5, wpm: 15, text: 'PRACTICE COPY  ', seed: 921 },
        // 250 Hz apart, measured (2026-10-09): at the stock 500 Hz filter the
        // copy is garbled anywhere within the pair — including dialled exactly
        // onto p1 — and a 200–250 Hz filter centred on p1 copies clean. At 300
        // or 450 Hz the keyer rejected the neighbour by pitch, so a student
        // who dialled 7.030 as instructed saw a clean copy and step 2 was false.
        { id: 'p2', kind: 'cw', freqHz: 7.03025 * MHZ, powerDb: -5, wpm: 15, text: 'VVV VVV TEST  ', seed: 922 },
      ],
    },
    steps: [
      {
        title: 'Tune the pair',
        body: 'Tune onto the pair at 7.030 MHz in CW: tap it, or dial to anywhere between the two stations.',
        why: 'Two Morse stations are keying 250 Hz apart. On a wide view they look like one line.',
        target: 'tune',
        // Within the pair. 25 Hz below the lower station the stock filter
        // already copies it clean, which would make the next step a lie.
        check: (c) => c.mode === 'cw' && near(c, 7.030125 * MHZ, 125),
      },
      {
        title: 'Why the copy is garbled',
        body: 'Look at the decoder output: words half-form and break up.',
        why: 'Your CW filter is 500 Hz wide, so both stations fit inside it and the decoder hears their dots and dashes interleaved.',
      },
      {
        title: 'Narrow the filter',
        body: 'Turn the bandwidth down to 250 Hz or less.',
        why: 'A narrower filter passes less of the band. Now only one station can fit inside it.',
        target: 'bandwidth',
        deckPage: 'filter',
        check: (c) => c.mode === 'cw' && c.bandwidthHz <= 250,
      },
      {
        title: 'Center one station',
        body: 'Fine-tune with the dial until the decoder prints clean words.',
        why: 'With one carrier in the passband the copy turns clean. This is exactly how operators pull a weak station out from beside a loud one.',
        target: 'tune',
        // The full phrase: a half-centred filter still prints "COPY" inside garbage.
        check: (c) => c.morseText.includes('PRACTICE COPY'),
      },
    ],
  },
  {
    id: 'squelch',
    title: 'Open the squelch',
    skill: 'Setting the squelch gate so weak signals get through',
    minutes: 2,
    challengeId: 'squelch-down',
    startMode: 'cw',
    startSquelchDb: CLOSED_SQUELCH_DB,
    scene: {
      centerFreqHz: 3.56 * MHZ,
      noiseSigma: 0.02,
      emitters: [
        { id: 'qrp', kind: 'cw', freqHz: 3.565 * MHZ, powerDb: -26, wpm: 14, text: 'QRP TEST DE TRAINEE  ', seed: 931 },
      ],
    },
    steps: [
      {
        title: 'Find the faint carrier',
        body: 'Tune 3.565 MHz in CW.',
        why: 'The trace is faint but visible. It is a low-power beacon, which hams call QRP.',
        target: 'tune',
        check: (c) => c.mode === 'cw' && near(c, 3.565 * MHZ, 300),
      },
      {
        title: 'Why it is silent',
        body: 'You can see the signal, but the decoder prints nothing.',
        why: 'The waterfall draws everything the antenna picks up. The squelch comes after it and mutes audio below a threshold, and the decoder only hears what the squelch lets through.',
      },
      {
        title: 'Lower the squelch',
        body: 'Turn the squelch down until the beacon gets through.',
        why: 'Too high and you miss weak stations; too low and you hear hiss all day. Operators set it just below the signal they want.',
        target: 'squelch',
        deckPage: 'filter',
        check: (c) => c.morseText.includes('TRAINEE'),
      },
    ],
  },
  {
    id: 'repeater',
    title: 'Work a repeater',
    skill: 'Repeater inputs, outputs, and the 2 m offset',
    minutes: 3,
    challengeId: 'repeater-input',
    startMode: 'nfm',
    scene: {
      centerFreqHz: 147.6 * MHZ,
      noiseSigma: 0.03,
      emitters: [
        { id: 'out', kind: 'nfm', freqHz: 147.3 * MHZ, powerDb: -4, speech: 'repeater-2m', seed: 941 },
        { id: 'in', kind: 'cw', freqHz: 147.9 * MHZ, powerDb: -7, wpm: 16, text: 'DE TRAINEE PLUS SIDE  ', seed: 942 },
      ],
    },
    steps: [
      {
        title: 'Tune the output',
        body: 'Tune 147.300 MHz in NFM and listen.',
        why: 'This is a repeater output: a hilltop station retransmitting whatever it hears, so handheld radios can reach much farther.',
        target: 'tune',
        check: (c) => c.mode === 'nfm' && near(c, 147.3 * MHZ, 6_000),
      },
      {
        title: 'Input and output',
        body: 'A repeater listens on one frequency and transmits on another.',
        why: 'On 2 m the two are 600 kHz apart. Above 147 MHz the input is the higher one, so this repeater listens at 147.900.',
      },
      {
        title: 'Tune the input',
        body: 'Tune 147.900 MHz.',
        why: 'The input is where stations talk to the repeater. You can hear people there even when they are out of the repeater’s range.',
        target: 'tune',
        check: (c) => near(c, 147.9 * MHZ, 6_000),
      },
      {
        title: 'Copy the input',
        body: 'Someone is keying Morse on the input. Switch to CW and read it.',
        target: 'mode',
        deckPage: 'mode',
        check: (c) => c.morseText.includes('PLUS'),
      },
    ],
  },
  {
    id: 'scan',
    title: 'Scan the band',
    skill: 'Using a scanner to find activity, and logging what you hear',
    minutes: 3,
    challengeId: 'ism-census',
    startMode: 'nfm',
    scene: {
      centerFreqHz: 146.52 * MHZ,
      noiseSigma: 0.025,
      emitters: [
        { id: 'sx', kind: 'nfm', freqHz: 146.4 * MHZ, powerDb: -5, speech: 'simplex-2m', seed: 951 },
        { id: 'rp', kind: 'nfm', freqHz: 146.7 * MHZ, powerDb: -6, speech: 'repeater-2m', seed: 952 },
      ],
    },
    steps: [
      {
        title: 'Start scanning',
        body: 'Press Scan the band.',
        why: 'Busy bands are mostly silence. A scanner steps through channels and stops on anything above the squelch.',
        target: 'scan',
        deckPage: 'scan',
        panel: 'scan',
        check: (c) => c.scanStatus === 'scanning' || c.scanStatus === 'hold',
      },
      {
        title: 'Stop on activity',
        body: 'Let it run until it stops on a transmission.',
        why: 'When a signal breaks squelch, the scanner holds there so you can listen, then moves on once the channel goes quiet.',
        check: (c) => c.scanStatus === 'hold',
      },
      {
        title: 'Log an intercept',
        body: 'Listen through a transmission.',
        why: 'Everything you hear is stamped into the intercept log with the time, frequency, and mode, like a real listening post’s logbook.',
        check: (c) => c.newIntercepts > 0,
      },
    ],
  },
  {
    id: 'identify',
    title: 'Identify a signal',
    skill: 'Naming a modulation from its shape and sound',
    minutes: 3,
    challengeId: 'mode-id',
    startMode: 'nfm',
    scene: {
      centerFreqHz: 433.0 * MHZ,
      noiseSigma: 0.03,
      emitters: [
        { id: 'w', kind: 'wfm', freqHz: 432.62 * MHZ, powerDb: -4, message: 'music', seed: 961 },
        { id: 'n', kind: 'nfm', freqHz: 432.8 * MHZ, powerDb: -6, seed: 962 },
        { id: 'a', kind: 'am', freqHz: 432.95 * MHZ, powerDb: -6, seed: 963 },
        { id: 'c', kind: 'cw', freqHz: 433.16 * MHZ, powerDb: -6, wpm: 20, seed: 964 },
        { id: 'l', kind: 'lora', freqHz: 433.45 * MHZ, powerDb: -6, sf: 8, seed: 965 },
      ],
    },
    steps: [
      {
        title: 'What the detector does',
        body: 'The Signals list shows everything the receiver has found in this band.',
        why: 'It measures each signal’s width and duty cycle and makes a guess. Your job is to confirm it, the way an analyst checks a machine’s call.',
        panel: 'signals',
      },
      {
        title: 'Pick one',
        body: 'Open Signals and select one from the list.',
        why: 'Selecting it tunes the receiver there, so you can listen while you decide.',
        panel: 'signals',
        check: (c) => c.selectedId !== null,
      },
      {
        title: 'Name it',
        body: 'Choose what you think it is.',
        why: 'Use the clues: width, whether it is continuous or bursty, and how it sounds. A diagonal sweep is LoRa; a single thin line keyed on and off is CW.',
        panel: 'signals',
        check: (c) => c.identified.length > 0,
      },
    ],
  },
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
