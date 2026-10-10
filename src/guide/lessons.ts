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
  /**
   * Spreading factor the signal card is reading for the selected signal (or
   * the one the VFO sits on), once the chirp analyzer has seen its sweep.
   */
  chirpSf: number | null;
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
        title: 'Bring the receiver up',
        body: 'Power on. The stage is live once the waterfall starts scrolling.',
        why: 'Each waterfall row is one moment in time, newest at the top; frequency runs left to right. Every intercept starts as a shape on this display.',
        target: 'power',
        check: (c) => c.running,
      },
      {
        title: 'Acquire the strongest emitter',
        body: 'Tap the brightest band on the waterfall to lock on.',
        why: 'Brightness is received power. A tap snaps the VFO to the emitter’s center and picks a demodulator to fit its width: WFM here, because broadcast FM occupies about 180 kHz.',
        target: 'waterfall',
        check: (c) => c.mode === 'wfm' && [100.9, 101.5, 101.7].some((f) => near(c, f * MHZ, 60_000)),
      },
      {
        title: 'Retune to the voice carrier',
        body: 'Move to 101.500 MHz, the station carrying speech instead of music.',
        why: 'Type it into the frequency readout or tap the band. Same mode, new target: retuning is moving the passband along the span.',
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
        title: 'Acquire the tower',
        body: 'Tune 119.250 MHz.',
        why: 'Air traffic uses AM. On the waterfall: a sharp carrier line with one sideband on each side.',
        target: 'tune',
        check: (c) => near(c, 119.25 * MHZ, 8_000),
      },
      {
        title: 'Force a mode mismatch',
        body: 'Hold on the tower and set the demodulator to NFM.',
        why: 'An FM detector discards amplitude, which is exactly where AM carries its audio. The voice goes thin or vanishes. Remember the sound: this is what a wrong mode does.',
        target: 'mode',
        deckPage: 'mode',
        check: (c) => c.mode === 'nfm' && near(c, 119.25 * MHZ, 8_000),
      },
      {
        title: 'Correct the demodulator',
        body: 'Set AM.',
        why: 'Same signal, matching detector, clean audio. When an intercept sounds wrong, check the mode before anything else.',
        target: 'mode',
        deckPage: 'mode',
        check: (c) => c.mode === 'am' && near(c, 119.25 * MHZ, 8_000),
      },
      {
        title: 'Classify the second emitter',
        body: 'Tap the signal at 118.800 MHz and note which mode the receiver selects.',
        why: 'It selects NFM: no center carrier, one smooth hump about 12 kHz wide. Field receivers don’t auto-select; you now read the shape yourself.',
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
        title: 'Acquire the pair',
        body: 'Tune onto the pair at 7.030 MHz in CW: tap it, or dial anywhere between the two carriers.',
        why: 'Two CW emitters 250 Hz apart. At full span they render as a single line.',
        target: 'tune',
        // Within the pair. 25 Hz below the lower station the stock filter
        // already copies it clean, which would make the next step a lie.
        check: (c) => c.mode === 'cw' && near(c, 7.030125 * MHZ, 125),
      },
      {
        title: 'Assess the copy',
        body: 'Watch the decoder: words half-form and collapse.',
        why: 'The CW filter is 500 Hz wide. Both carriers sit inside it, so the decoder hears two keyers interleaved.',
      },
      {
        title: 'Narrow the passband',
        body: 'Bring the bandwidth down to 250 Hz or less.',
        why: 'A narrower filter admits less of the band. Only one carrier fits now.',
        target: 'bandwidth',
        deckPage: 'filter',
        check: (c) => c.mode === 'cw' && c.bandwidthHz <= 250,
      },
      {
        title: 'Center and copy',
        body: 'Fine-tune with the dial until the decoder prints clean words.',
        why: 'One carrier in the passband, clean copy. This is how an operator pulls a weak station out from beside a loud one.',
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
        title: 'Acquire the faint carrier',
        body: 'Tune 3.565 MHz in CW.',
        why: 'The trace is faint but present: a low-power beacon. Hams call it QRP.',
        target: 'tune',
        check: (c) => c.mode === 'cw' && near(c, 3.565 * MHZ, 300),
      },
      {
        title: 'Assess: visible, not audible',
        body: 'The signal is on the waterfall, but the decoder prints nothing.',
        why: 'The waterfall shows everything the front end receives. The squelch sits after it and mutes audio below a threshold, and the decoder only hears what the squelch passes.',
      },
      {
        title: 'Open the gate',
        body: 'Lower the squelch until the beacon gets through.',
        why: 'Too high and weak stations never reach you; too low and you listen to hiss all day. Set it just under the signal you want.',
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
        title: 'Acquire the repeater output',
        body: 'Tune 147.300 MHz in NFM and listen.',
        why: 'A repeater output: a hilltop station re-transmitting whatever it hears, so handhelds reach far beyond their own range.',
        target: 'tune',
        check: (c) => c.mode === 'nfm' && near(c, 147.3 * MHZ, 6_000),
      },
      {
        title: 'Tradecraft: the offset',
        body: 'A repeater listens on one frequency and transmits on another.',
        why: 'On 2 m they’re 600 kHz apart. Above 147 MHz the input is the higher one, so this repeater listens at 147.900.',
      },
      {
        title: 'Move to the input',
        body: 'Tune 147.900 MHz.',
        why: 'The input is where stations talk to the repeater. You can hear them there even when they’re outside the repeater’s coverage.',
        target: 'tune',
        check: (c) => near(c, 147.9 * MHZ, 6_000),
      },
      {
        title: 'Copy the input',
        body: 'Something is keying Morse on the input. Switch to CW and copy it.',
        why: 'Monitoring an input catches traffic the output never carries: the station too weak to key the repeater, or one deliberately staying off it.',
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
        title: 'Start the scan',
        body: 'Press Scan the band.',
        why: 'Busy bands are mostly silence. The scanner steps through channels and stops on anything above the squelch.',
        target: 'scan',
        deckPage: 'scan',
        panel: 'scan',
        check: (c) => c.scanStatus === 'scanning' || c.scanStatus === 'hold',
      },
      {
        title: 'Hold on activity',
        body: 'Let it run until it holds on a transmission.',
        why: 'When a signal breaks squelch the scanner holds so you can listen, then resumes once the channel clears.',
        check: (c) => c.scanStatus === 'hold',
      },
      {
        title: 'Take the intercept',
        body: 'Listen through one transmission.',
        why: 'Everything heard is stamped into the intercept log with time, frequency, and mode: the station logbook of a listening post.',
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
        title: 'Tradecraft: the detector',
        body: 'The Signals list is every emitter the receiver has found in this span.',
        why: 'It measures width and duty cycle and calls a type. Your job is to confirm it, the way an analyst checks the machine.',
        panel: 'signals',
      },
      {
        title: 'Select a track',
        body: 'Open Signals and select one.',
        why: 'Selecting tunes the receiver there, so you listen while you decide.',
        panel: 'signals',
        check: (c) => c.selectedId !== null,
      },
      {
        title: 'Call the modulation',
        body: 'Choose what you think it is.',
        why: 'Use the clues: width, continuous or bursty, how it sounds. A diagonal sweep is LoRa; a single thin line keyed on and off is CW.',
        panel: 'signals',
        check: (c) => c.identified.length > 0,
      },
    ],
  },
  {
    id: 'traffic',
    title: 'Read the log',
    skill: 'Monitoring a frequency and reading who is talking to whom',
    minutes: 3,
    challengeId: 'net-traffic',
    startMode: 'nfm',
    scene: {
      centerFreqHz: 146.7 * MHZ,
      noiseSigma: 0.03,
      emitters: [
        { id: 'rpt', kind: 'nfm', freqHz: 146.76 * MHZ, powerDb: -6, speech: 'repeater-2m', seed: 971 },
        { id: 'sx', kind: 'nfm', freqHz: 146.52 * MHZ, powerDb: -8, speech: 'simplex-2m', seed: 972 },
        { id: 'd', kind: 'fsk2', freqHz: 146.95 * MHZ, powerDb: -10, seed: 973 },
      ],
    },
    steps: [
      {
        title: 'Acquire the repeater',
        body: 'Tune 146.760 MHz in NFM, a 2 m repeater output.',
        why: 'Repeaters are where traffic concentrates: one frequency, many stations, a courtesy tone after each unkey.',
        target: 'tune',
        check: (c) => c.mode === 'nfm' && near(c, 146.76 * MHZ, 8_000),
      },
      {
        title: 'Collect two transmissions',
        body: 'Stay on it. Open the Log and wait for two transmissions to land.',
        why: 'The log keeps only what you were tuned to. An intercept log records where you were listening, not everything on the air.',
        panel: 'log',
        check: (c) => c.newIntercepts >= 2,
      },
      {
        title: 'Traffic analysis',
        body: 'Read the callsigns and what each station said. One broke in asking for a signal report.',
        why: 'Who calls whom, who controls the net, who has traffic to pass. Tasking will ask you for exactly this.',
        panel: 'log',
      },
    ],
  },
  {
    id: 'chirp',
    title: 'Read a chirp',
    skill: "Recovering a chirp's bandwidth and spreading factor from its sweep",
    minutes: 2,
    challengeId: 'spread-factor',
    startMode: 'nfm',
    scene: {
      centerFreqHz: 915.0 * MHZ,
      noiseSigma: 0.028,
      emitters: [
        { id: 'l', kind: 'lora', freqHz: 915.4 * MHZ, powerDb: -5, sf: 10, bwHz: 125_000, seed: 981 },
        { id: 'o', kind: 'ook', freqHz: 914.75 * MHZ, powerDb: -9, baud: 2000, seed: 982 },
        { id: 'f', kind: 'fsk2', freqHz: 915.1 * MHZ, powerDb: -10, seed: 983 },
      ],
    },
    steps: [
      {
        title: 'Acquire the chirp',
        body: 'Tap the emitter painting diagonal ramps near 915.400 MHz.',
        why: 'Each ramp is one symbol: the carrier sweeps the channel, snaps back, and sweeps again.',
        target: 'waterfall',
        check: (c) => c.selectedId !== null && near(c, 915.4 * MHZ, 80_000),
      },
      {
        title: 'Let the receiver measure the sweep',
        body: 'Hold on it. The card will read the sweep width and the spreading factor.',
        why: 'The receiver times the sweep in short sub-frames: fly-back plus one step is the width, and width² over the rate gives 2^SF. It needs a few symbols to be sure.',
        target: 'waterfall',
        check: (c) => c.chirpSf !== null,
      },
      {
        title: 'Tradecraft: SF and width',
        body: 'Width is the channel. SF is how long a symbol takes to sweep it: higher SF is slower, reaches further, and is harder to pick out of a busy band.',
        why: 'Meshtastic LongFast runs SF11 on 250 kHz; LoRaWAN uses SF7–12 on 125 kHz channels. Recovering them off the air is what Tasking asks for.',
      },
    ],
  },
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
