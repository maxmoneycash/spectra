import { describe, it, expect } from 'vitest';
import { lessonById } from './lessons';
import { copyCw, cwBeaconHz } from '../test/cwHarness';

/**
 * The repeater lesson's last step: "Someone is keying Morse on the input.
 * Switch to CW and read it." Pinned through the receiver (2026-10-09):
 * the input copies clean in CW, there is nothing to copy on the output, and
 * NFM on the input yields only keyer chatter — the worker also gates the
 * decoder to CW, so the mode switch the lesson teaches is really required.
 */
const lesson = lessonById('repeater')!;
const inputHz = cwBeaconHz(lesson.scene);
const outputHz = lesson.scene.emitters.find((e) => e.kind === 'nfm')!.freqHz;

describe('repeater lesson: the input copies in CW and nowhere else', () => {
  it('is 600 kHz above the output, the 2 m offset the lesson teaches', () => {
    expect(inputHz - outputHz).toBe(600_000);
  });

  it('copies the keyed message on the input in CW', () => {
    expect(copyCw({ spec: lesson.scene, tuneHz: inputHz, sec: 24 }).text).toContain('PLUS SIDE');
  });

  it('has nothing to copy on the output, so the retune is real', () => {
    expect(copyCw({ spec: lesson.scene, tuneHz: outputHz, sec: 12 }).text).toBe('');
  });

  it('does not copy on the input in NFM, so the mode switch is real', () => {
    expect(copyCw({ spec: lesson.scene, tuneHz: inputHz, mode: 'nfm', sec: 24 }).text).not.toContain('PLUS');
  });
});
