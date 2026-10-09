import { describe, it, expect } from 'vitest';
import { CHALLENGES, challengeById, toSceneSpec } from './challenges';
import { checkFlag } from './store';
import { lessonById } from '../guide/lessons';
import { CLOSED_SQUELCH_DB, DEFAULT_SQUELCH_DB } from '../store/modes';
import { copyCw, cwBeaconHz } from '../test/cwHarness';

/**
 * Below the Gate shipped trivially solvable: its beacon peaks at -26 dB of
 * gated channel level, 54 dB above the -80 dB gate every challenge opened at,
 * so the flag copied the moment you tuned it — and every test passed, because
 * none ran the receiver. These do.
 */

/** Does any short run of decoded words validate against the stored flag? */
async function solves(id: string, text: string): Promise<boolean> {
  const words = text.split(' ').filter(Boolean);
  for (let i = 0; i < words.length; i++)
    for (let j = i + 1; j <= Math.min(words.length, i + 4); j++)
      if (await checkFlag(id, words.slice(i, j).join(' '))) return true;
  return false;
}

describe('Below the Gate: the gate really sits above the beacon', () => {
  const c = challengeById('squelch-down')!;
  const spec = toSceneSpec(c);
  const tuneHz = cwBeaconHz(spec);

  it('opens with a declared squelch, and at it the decoder prints nothing', async () => {
    expect(c.startSquelchDb).toBe(CLOSED_SQUELCH_DB);
    const r = copyCw({ spec, tuneHz, squelchDb: c.startSquelchDb, sec: 20 });
    expect(r.maxLevel, 'beacon peaks above the gate, so the squelch would open on its own').toBeLessThan(
      c.startSquelchDb!,
    );
    expect(r.text).toBe('');
    expect(await solves(c.id, r.text)).toBe(false);
  });

  it('copies once the squelch is opened', async () => {
    const r = copyCw({ spec, tuneHz, squelchDb: DEFAULT_SQUELCH_DB, sec: 26 });
    expect(await solves(c.id, r.text), r.text).toBe(true);
  });
});

describe('the squelch lesson starts silent for the same reason', () => {
  const l = lessonById('squelch')!;
  const tuneHz = cwBeaconHz(l.scene);

  it('declares the raised gate and prints nothing at it', () => {
    expect(l.startSquelchDb).toBe(CLOSED_SQUELCH_DB);
    const r = copyCw({ spec: l.scene, tuneHz, squelchDb: l.startSquelchDb, sec: 20 });
    expect(r.maxLevel).toBeLessThan(l.startSquelchDb!);
    expect(r.text).toBe('');
  });

  it('copies the beacon once the student lowers it', () => {
    const r = copyCw({ spec: l.scene, tuneHz, squelchDb: DEFAULT_SQUELCH_DB, sec: 24 });
    expect(r.text).toContain('TRAINEE');
  });
});

describe('every other CW challenge opens with the gate well below its beacon', () => {
  const others = CHALLENGES.filter(
    (x) => x.id !== 'squelch-down' && x.emitters.some((e) => e.kind === 'cw' && e.text),
  );
  for (const c of others) {
    it(c.id, () => {
      const spec = toSceneSpec(c);
      const start = c.startSquelchDb ?? DEFAULT_SQUELCH_DB;
      const r = copyCw({ spec, tuneHz: cwBeaconHz(spec), squelchDb: start, sec: 5 });
      // 10 dB of margin: a beacon this close to the gate would stutter.
      expect(start, `gate at ${start} dB vs beacon median ${r.medianLevel.toFixed(1)} dB`).toBeLessThan(
        r.medianLevel - 10,
      );
    });
  }
});
