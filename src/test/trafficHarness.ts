import { readFileSync } from 'node:fs';
import { Scene } from '../sim/scene';
import { onTx, setVoiceBank, clearVoiceBank } from '../sim/voicebank';
import { inPassband } from '../store/intercept';
import { voiceLine } from './detectHarness';
import { SAMPLE_RATE, BLOCK_SIZE, type BankSetMsg, type SceneSpec, type TxEvent } from '../engine/protocol';

/**
 * The on-air traffic chain — scene → speech scheduler → intercept rule — for
 * tests that grade on the intercept log. `speech:` emitters are silent in
 * Node (the main thread supplies the rendered voice bank), so a scene's sets
 * are installed here with the real script's speakers and words over short
 * synthetic audio: the scheduler and the store's passband rule are what a
 * log-graded lesson or challenge depends on, not the voice.
 */

export interface ScriptLine {
  who: string;
  text: string;
}
export interface Script {
  sets: Record<string, { courtesy?: boolean; lines: ScriptLine[] }>;
}

/** scripts/radio-traffic.json — the source of truth for who says what. */
export const script: Script = JSON.parse(readFileSync('scripts/radio-traffic.json', 'utf8'));

/** The real set's speakers and words, with 2 s of synthetic audio per line. */
export function bankFrom(id: string): BankSetMsg {
  const set = script.sets[id];
  if (!set) throw new Error(`no traffic set '${id}'`);
  return {
    lines: set.lines.map((ln, i) => ({ ...voiceLine(700 + i, ln.who, 2), text: ln.text })),
    courtesy: !!set.courtesy,
    continuous: false,
  };
}

/** A bank covering every `speech:` set the scene's emitters name. */
export function bankForScene(spec: SceneSpec): Record<string, BankSetMsg> {
  const bank: Record<string, BankSetMsg> = {};
  for (const e of spec.emitters) if (e.speech && !bank[e.speech]) bank[e.speech] = bankFrom(e.speech);
  return bank;
}

/**
 * Transmissions the store would log with the VFO parked at `tuneHz` and the
 * filter `bwHz` wide for `sec` seconds of simulated air.
 */
export function monitor(spec: SceneSpec, tuneHz: number, bwHz: number, sec: number, bank = bankForScene(spec)): TxEvent[] {
  clearVoiceBank();
  setVoiceBank(bank);
  const scene = new Scene({ sampleRate: SAMPLE_RATE, centerFreqHz: spec.centerFreqHz, noiseSigma: spec.noiseSigma });
  for (const e of spec.emitters) scene.add(e);
  const heard: TxEvent[] = [];
  onTx((e) => {
    if (inPassband(tuneHz, bwHz, e.freqHz)) heard.push(e);
  });
  const re = new Float32Array(BLOCK_SIZE);
  const im = new Float32Array(BLOCK_SIZE);
  for (let b = 0, n = Math.round((sec * SAMPLE_RATE) / BLOCK_SIZE); b < n; b++) scene.generate(re, im, BLOCK_SIZE);
  onTx(null);
  clearVoiceBank();
  return heard;
}
