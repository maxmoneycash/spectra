/**
 * The worker's bank of recorded transmissions (decoded on the main thread
 * from public/radio, sent over once). Speech-driven emitters read from it
 * lazily, so a scene built before the bank arrives simply stays quiet until
 * it does.
 */
import type { BankSetMsg, TxEvent } from '../engine/protocol';

const bank = new Map<string, BankSetMsg>();
let listener: ((e: TxEvent) => void) | null = null;

export function setVoiceBank(sets: Record<string, BankSetMsg>): void {
  for (const [id, set] of Object.entries(sets)) bank.set(id, set);
}

export function voiceSet(id: string): BankSetMsg | undefined {
  return bank.get(id);
}

/** For tests: start from an empty bank. */
export function clearVoiceBank(): void {
  bank.clear();
}

export function onTx(fn: ((e: TxEvent) => void) | null): void {
  listener = fn;
}

export function emitTx(e: TxEvent): void {
  listener?.(e);
}
