import { describe, it, expect } from 'vitest';
import { lessonById } from './lessons';
import { script, monitor } from '../test/trafficHarness';

/**
 * The traffic lesson's premises, through the scheduler and the store's
 * passband rule: on the repeater the log fills within the time a student
 * will wait; on the simplex pair it fills with a different conversation; and
 * off both, with nothing. Pinned so "wait for two transmissions" can never
 * become a step that cannot complete.
 */
const lesson = lessonById('traffic')!;
const MHZ = 1e6;
const NFM_BW = 12_000;

describe('traffic lesson: the log fills on the repeater, and only with its stations', () => {
  const rptWhos = new Set(script.sets['repeater-2m'].lines.map((l) => l.who));
  const sxWhos = new Set(script.sets['simplex-2m'].lines.map((l) => l.who));

  it('two transmissions land within 45 s on the repeater, all from its conversation', () => {
    const heard = monitor(lesson.scene, 146.76 * MHZ, NFM_BW, 45);
    expect(heard.length).toBeGreaterThanOrEqual(2);
    for (const e of heard) expect(rptWhos.has(e.who), e.who).toBe(true);
  });

  it('the simplex pair logs its own speakers, so tuning the wrong signal reads differently', () => {
    const whos = new Set(monitor(lesson.scene, 146.52 * MHZ, NFM_BW, 45).map((e) => e.who));
    expect(whos.size).toBeGreaterThan(0);
    for (const w of whos) expect(sxWhos.has(w), w).toBe(true);
  });

  it('parked between them, nothing is logged', () => {
    expect(monitor(lesson.scene, 146.7 * MHZ, NFM_BW, 30).length).toBe(0);
  });
});
