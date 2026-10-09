import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Scene } from '../sim/scene';
import { onTx, setVoiceBank, clearVoiceBank } from '../sim/voicebank';
import { challengeById, toSceneSpec } from './challenges';
import { checkFlag } from './store';
import { inPassband } from '../store/intercept';
import { voiceLine } from '../test/detectHarness';
import { SAMPLE_RATE, BLOCK_SIZE, type BankSetMsg, type TxEvent } from '../engine/protocol';

/**
 * Net Traffic is graded on the intercept log, which keeps a transmission only
 * if the receiver was tuned inside its passband when it started (store.ts).
 * So the flag is reachable only by finding the net's repeater and staying on
 * it through a rotation — and unreachable from the decoy repeater or empty
 * air. This runs the scene's speech scheduler with the real script's
 * speakers and lines (short synthetic audio; the scheduler is what matters)
 * and applies the store's rule to the transmissions it emits.
 *
 * The expected answer is derived from scripts/radio-traffic.json — the
 * station net control hands the floor to — so a stale hash fails loudly.
 */
interface ScriptLine {
  who: string;
  text: string;
}
interface Script {
  sets: Record<string, { courtesy?: boolean; lines: ScriptLine[] }>;
}
const script: Script = JSON.parse(readFileSync('scripts/radio-traffic.json', 'utf8'));
const challenge = challengeById('net-traffic')!;
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

/** The real set's speakers and words, with 2 s of synthetic audio per line. */
const bankFrom = (id: string): BankSetMsg => ({
  lines: script.sets[id].lines.map((ln, i) => ({ ...voiceLine(700 + i, ln.who, 2), text: ln.text })),
  courtesy: !!script.sets[id].courtesy,
  continuous: false,
});

/** Transmissions the store would log with the VFO parked at `tuneHz` for `sec` seconds. */
function monitor(tuneHz: number, sec: number): TxEvent[] {
  clearVoiceBank();
  setVoiceBank({ 'net-70cm': bankFrom('net-70cm'), 'repeater-2m': bankFrom('repeater-2m') });
  const spec = toSceneSpec(challenge);
  const scene = new Scene({ sampleRate: SAMPLE_RATE, centerFreqHz: spec.centerFreqHz, noiseSigma: spec.noiseSigma });
  for (const e of spec.emitters) scene.add(e);
  const heard: TxEvent[] = [];
  onTx((e) => {
    if (inPassband(tuneHz, NFM_BW, e.freqHz)) heard.push(e);
  });
  const re = new Float32Array(BLOCK_SIZE);
  const im = new Float32Array(BLOCK_SIZE);
  for (let b = 0, n = Math.round((sec * SAMPLE_RATE) / BLOCK_SIZE); b < n; b++) scene.generate(re, im, BLOCK_SIZE);
  onTx(null);
  clearVoiceBank();
  return heard;
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
    const whos = new Set(monitor(NET_HZ, 60).map((e) => e.who));
    for (const ln of script.sets['net-70cm'].lines) expect(whos.has(ln.who)).toBe(true);
    expect(whos.has(expected)).toBe(true);
  });

  it('monitoring the decoy repeater fills the log with the wrong conversation', () => {
    const whos = new Set(monitor(DECOY_HZ, 60).map((e) => e.who));
    expect(whos.size).toBeGreaterThan(0);
    for (const w of whos) expect(decoyWhos.has(w)).toBe(true);
    expect(whos.has(expected)).toBe(false);
  });

  it('parked on the data burst between them, nothing is logged', () => {
    expect(monitor(442.6 * MHZ, 60).length).toBe(0);
  });
});
