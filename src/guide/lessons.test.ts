import { describe, it, expect } from 'vitest';
import { LESSONS, type GuideCtx, type Lesson } from './lessons';
import { CHALLENGES } from '../ctf/challenges';
import { SAMPLE_RATE } from '../engine/protocol';
import { encodeMorse, MorseDecoder, MORSE } from '../sim/morse';
import { MODE_BW } from '../store/modes';

const MHZ = 1_000_000;

/** What `useGuide.start()` leaves the receiver looking like, with step `i`'s steering applied. */
function entryCtx(lesson: Lesson, i: number): GuideCtx {
  const mode = lesson.startMode ?? 'nfm';
  const step = lesson.steps[i];
  return {
    running: lesson.id !== LESSONS[0].id,
    tunedHz: lesson.scene.centerFreqHz,
    mode,
    bandwidthHz: MODE_BW[mode],
    squelchDb: -80,
    morseText: '',
    deckPage: step.deckPage ?? 'mode',
    panel: step.panel ?? 'signals',
    scanStatus: 'idle',
    selectedId: null,
    identified: [],
    newIntercepts: 0,
  };
}

/** Run a lesson's CW text through the real encoder and decoder. */
function decodedCw(lesson: Lesson): string {
  const e = lesson.scene.emitters.find((x) => x.kind === 'cw' && x.text);
  if (!e?.text) return '';
  const d = new MorseDecoder();
  for (const seg of encodeMorse(e.text, e.wpm ?? 18)) d.push(seg.on, seg.durSec);
  return d.output;
}

/**
 * The state that should satisfy each step, by lesson. `null` = reading step.
 * CW steps use the decoder's actual output from a single pass, so a lesson
 * whose message the decoder can't produce fails here — the bug that once
 * made two CTF flags unsolvable. One pass is the strict case: the decoder
 * misreads the first character until its timing settles, so a check keyed
 * on a message's first word would only pass on the beacon's second loop.
 */
function solutions(lesson: Lesson): (Partial<GuideCtx> | null)[] {
  const heard = decodedCw(lesson);
  switch (lesson.id) {
    case 'tune':
      return [{ running: true }, { tunedHz: 100.9 * MHZ, mode: 'wfm' }, { tunedHz: 101.5 * MHZ, mode: 'wfm' }];
    case 'modes':
      return [
        { tunedHz: 119.25 * MHZ, mode: 'am' },
        { tunedHz: 119.25 * MHZ, mode: 'nfm' },
        { tunedHz: 119.25 * MHZ, mode: 'am' },
        { tunedHz: 118.8 * MHZ, mode: 'nfm' },
      ];
    case 'filter':
      return [{ tunedHz: 7.0302 * MHZ, mode: 'cw' }, null, { mode: 'cw', bandwidthHz: 200 }, { morseText: heard }];
    case 'squelch':
      return [{ tunedHz: 3.565 * MHZ, mode: 'cw' }, null, { morseText: heard }];
    case 'repeater':
      return [{ tunedHz: 147.3 * MHZ, mode: 'nfm' }, null, { tunedHz: 147.9 * MHZ }, { morseText: heard }];
    case 'scan':
      return [{ scanStatus: 'scanning' }, { scanStatus: 'hold' }, { newIntercepts: 1 }];
    case 'identify':
      return [null, { selectedId: 'track-1' }, { identified: ['wfm'] }];
    default:
      return [];
  }
}

describe('walkthroughs', () => {
  it('have unique ids and each leads to a real challenge', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    for (const l of LESSONS) expect(CHALLENGES.some((c) => c.id === l.challengeId), l.id).toBe(true);
  });

  it('keep every emitter inside the visible band', () => {
    for (const l of LESSONS)
      for (const e of l.scene.emitters)
        expect(Math.abs(e.freqHz - l.scene.centerFreqHz), `${l.id}/${e.id}`).toBeLessThan(SAMPLE_RATE * 0.47);
  });

  it('only transmit characters Morse can send', () => {
    for (const l of LESSONS)
      for (const e of l.scene.emitters.filter((x) => x.kind === 'cw' && x.text))
        expect(
          e.text!.toUpperCase().split('').filter((ch) => ch !== ' ').every((ch) => ch in MORSE),
          `${l.id}/${e.id}`,
        ).toBe(true);
  });

  it('never share a scene with the challenge they lead to', () => {
    for (const l of LESSONS) {
      const c = CHALLENGES.find((x) => x.id === l.challengeId)!;
      expect(l.scene.centerFreqHz, `${l.id} practices on ${c.id}'s band`).not.toBe(c.centerFreqHz);
    }
  });

  for (const lesson of LESSONS) {
    describe(lesson.id, () => {
      const sols = solutions(lesson);

      it('has a solution entry for every step', () => {
        expect(sols.length).toBe(lesson.steps.length);
      });

      it('never completes a step the moment it appears', () => {
        // Each step is entered in the state the previous steps left behind.
        // A check that already holds there finishes itself before the
        // student does anything: the bug where tapping a station auto-picked
        // WFM and silently completed "set the mode to WFM".
        let carry: Partial<GuideCtx> = {};
        lesson.steps.forEach((step, i) => {
          if (step.check && i > 0) {
            expect(step.check({ ...entryCtx(lesson, i), ...carry }), `step ${i + 1} "${step.title}"`).toBe(false);
          }
          if (sols[i]) carry = { ...carry, ...sols[i] };
        });
      });

      lesson.steps.forEach((step, i) => {
        if (!step.check) {
          it(`step ${i + 1} "${step.title}" is a reading step`, () => expect(sols[i]).toBeNull());
          return;
        }
        it(`step ${i + 1} "${step.title}" can be completed`, () => {
          const sol = sols[i];
          expect(sol, 'missing solution').not.toBeNull();
          expect(step.check!({ ...entryCtx(lesson, i), ...sol })).toBe(true);
        });
        it(`step ${i + 1} "${step.title}" does not pass on its own`, () => {
          // The power step is allowed to pass instantly if the receiver is
          // already on; every other step must wait for the student.
          if (lesson.id === LESSONS[0].id && i === 0) return;
          expect(step.check!(entryCtx(lesson, i))).toBe(false);
        });
      });
    });
  }
});
