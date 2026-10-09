import { describe, it, expect } from 'vitest';
import { challengeById, toSceneSpec } from './challenges';
import { checkFlag } from './store';
import { detectScene, syntheticBank, nearestTrack, distinctEmitters, type DetectResult } from '../test/detectHarness';

/**
 * The eight non-CW challenges are graded on what the Stations list reports —
 * a count, a frequency, a bandwidth, a guess. ctf.test.ts checks the hashes;
 * it cannot see whether the DETECTOR reports something a player could read
 * the flag from. This runs each challenge's scene through the worker's
 * detection chain (src/test/detectHarness.ts) and validates the natural
 * reading of the panel against the stored flag.
 *
 * What it found (2026-10-09): the FM band counted 8 emitters for 4 and the
 * ISM band 10 for 5 — the tracker's dedup radius came from the candidate's
 * width, so flickers at a wide station's skirt and fragments of a LoRa chirp
 * were listed as emitters of their own. Fixed in the tracker; pinned here.
 *
 * The hopper used to list as a score of narrow "CW" entries — one per dwell —
 * until the tracker learned to fold a comb of narrow tracks into one hopping
 * track (dsp/detector.ts). It now lists once, FHSS first, and the wide PSK
 * sitting inside its span is still its own emitter; pinned below.
 *
 * The spectral width still over-reads a 125 kHz chirp by ~20% (its remembered
 * width spans the sweep); the chirp analyzer (dsp/chirp.ts) now reads the
 * sweep itself from the sub-frame sawtooth — 125 kHz, SF8 — and the signal
 * card shows it. Pinned below for both LoRa challenges.
 */
const MHZ = 1e6;
const bank = syntheticBank();
const run = (id: string, sec: number): DetectResult => detectScene({ spec: toSceneSpec(challengeById(id)!), sec, bank });
const mhz3 = (hz: number) => (hz / MHZ).toFixed(3);

describe('recon: counting emitters', () => {
  it('first-light: the FM band shows exactly the four transmitters, at the end and over time', async () => {
    const r = run('first-light', 20);
    expect(r.tracks.length).toBe(4);
    expect(distinctEmitters(r.everSeen).length).toBe(4);
    expect(await checkFlag('first-light', String(r.tracks.length))).toBe(true);
  });

  it('ism-census: a patient operator accumulates exactly five, bursty ones included', async () => {
    const r = run('ism-census', 30);
    const n = distinctEmitters(r.everSeen).length;
    expect(n).toBe(5);
    expect(await checkFlag('ism-census', String(n))).toBe(true);
  });
});

describe('analysis: reading a frequency or a width off the panel', () => {
  it('fox-hunt: the intermittent beacon is detected and its centre reads to the flag', async () => {
    const t = nearestTrack(run('fox-hunt', 30).everSeen, 144.33 * MHZ);
    expect(t).not.toBeNull();
    expect(await checkFlag('fox-hunt', mhz3(t!.centerFreqHz))).toBe(true);
  });

  it('carrier-hunt: the AM station is detected and its centre reads to the flag', async () => {
    const t = nearestTrack(run('carrier-hunt', 20).everSeen, 124.2 * MHZ);
    expect(t).not.toBeNull();
    expect(await checkFlag('carrier-hunt', mhz3(t!.centerFreqHz))).toBe(true);
  });

  it('chirp-width: the chirper reads near 125 kHz, and the standard width is the flag', async () => {
    const t = nearestTrack(run('chirp-width', 30).everSeen, 915.1 * MHZ);
    expect(t).not.toBeNull();
    // The spectral width over-reads a chirp (its remembered width spans the
    // sweep, ~148 kHz here); the chirp analyzer measures the sweep itself from
    // the sawtooth's fly-back — exactly 125 kHz — and SF8 from its rate.
    expect(t!.bandwidthHz).toBeGreaterThan(90_000);
    expect(t!.bandwidthHz).toBeLessThan(180_000);
    expect(t!.chirp?.bwHz).toBe(125_000);
    expect(t!.chirp?.sf).toBe(8);
    expect(await checkFlag('chirp-width', '125')).toBe(true);
  });
});

describe('identify: the panel offers the answer', () => {
  it("mode-id: LoRa is the chirper's first candidate", async () => {
    const t = nearestTrack(run('mode-id', 30).everSeen, 915.15 * MHZ);
    expect(t).not.toBeNull();
    expect(t!.chirp).toBeDefined();
    expect(t!.candidates[0]?.kind).toBe('lora');
    expect(await checkFlag('mode-id', 'lora')).toBe(true);
  });

  it('hopper: the hopper lists once with FHSS first, and the PSK inside its span is not absorbed', async () => {
    const r = run('hopper', 30);
    const kept = distinctEmitters(r.everSeen);
    // Exactly one hopper, however the holes fell, with one identity for the
    // whole run — nine short-lived ones used to be listed.
    const hoppers = kept.filter((t) => t.hopping);
    expect(hoppers.length).toBe(1);
    const hopper = hoppers[0];
    // Most of the 800 kHz hop range folded into it, many dwells wide, and the
    // classifier reads the flag and names FHSS first.
    expect(hopper.hopping!.spanHz).toBeGreaterThan(400_000);
    expect(hopper.hopping!.members).toBeGreaterThanOrEqual(6);
    expect(hopper.candidates[0]?.kind).toBe('fhss');
    // The 100 kHz PSK parked inside the span is its own emitter, not a dwell.
    const psk = nearestTrack(kept, 2440.3 * MHZ);
    expect(psk).not.toBeNull();
    expect(psk!.hopping).toBeUndefined();
    // Honest residue: dwells landing on the PSK's upper skirt merge with it
    // into 30–90 kHz blobs, so the ledger can hold the PSK twice plus one
    // such blob. Nothing in this scene is graded on a count.
    expect(kept.length).toBeLessThanOrEqual(4);
    expect(await checkFlag('hopper', 'fhss')).toBe(true);
  });

  it('sideband: the voice signal is detected with both sidebands offered — the ear decides', async () => {
    const t = nearestTrack(run('sideband', 20).everSeen, 7.16 * MHZ);
    expect(t).not.toBeNull();
    const kinds = t!.candidates.map((c) => c.kind);
    expect(kinds).toContain('usb');
    expect(kinds).toContain('lsb');
    expect(await checkFlag('sideband', 'lsb')).toBe(true);
  });
});
