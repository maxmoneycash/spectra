import { describe, it, expect } from 'vitest';
import { challengeById, toSceneSpec } from './challenges';
import { checkFlag } from './store';
import { script, monitor, type ScriptLine } from '../test/trafficHarness';

/**
 * Net Traffic is graded on the intercept log, which keeps a transmission only
 * if the receiver was tuned inside its passband when it started. So the flag
 * is reachable only by finding the net's repeater and staying on it through a
 * rotation — and unreachable from the decoy repeater or empty air. The
 * expected answer is derived from scripts/radio-traffic.json — the station
 * net control hands the floor to — so a stale hash fails loudly.
 */
const spec = toSceneSpec(challengeById('net-traffic')!);
const MHZ = 1e6;
const NET_HZ = 442.35 * MHZ;
const DECOY_HZ = 442.9 * MHZ;
const NFM_BW = 12_000;

function stationWithTraffic(lines: ScriptLine[]): string {
  for (const ln of lines) {
    const m = /([A-Z0-9](?: [A-Z0-9])+), go ahead with your traffic/i.exec(ln.text);
    if (m) return m[1].replace(/\s+/g, '').toUpperCase();
  }
  throw new Error('the net script has no traffic handoff');
}

describe('Net Traffic: the flag is in the log, and only on the net', () => {
  const expected = stationWithTraffic(script.sets['net-70cm'].lines);
  const decoyWhos = new Set(script.sets['repeater-2m'].lines.map((l) => l.who));

  it('the script hands traffic to one station, and that is the flag', async () => {
    expect(decoyWhos.has(expected)).toBe(false);
    expect(await checkFlag('net-traffic', expected)).toBe(true);
    expect(await checkFlag('net-traffic', [...decoyWhos][0])).toBe(false);
  });

  it('monitoring the net through a rotation logs every station, including the one with traffic', () => {
    const whos = new Set(monitor(spec, NET_HZ, NFM_BW, 60).map((e) => e.who));
    for (const ln of script.sets['net-70cm'].lines) expect(whos.has(ln.who)).toBe(true);
    expect(whos.has(expected)).toBe(true);
  });

  it('monitoring the decoy repeater fills the log with the wrong conversation', () => {
    const whos = new Set(monitor(spec, DECOY_HZ, NFM_BW, 60).map((e) => e.who));
    expect(whos.size).toBeGreaterThan(0);
    for (const w of whos) expect(decoyWhos.has(w)).toBe(true);
    expect(whos.has(expected)).toBe(false);
  });

  it('parked on the data burst between them, nothing is logged', () => {
    expect(monitor(spec, 442.6 * MHZ, NFM_BW, 60).length).toBe(0);
  });
});
