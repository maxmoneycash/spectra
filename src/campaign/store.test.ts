import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrackMsg } from '../engine/protocol';
import { encodeMorse, MorseDecoder } from '../sim/morse';
import { CORRECT_SITE, FOX_TRAIL, LISTENING_POSTS, campaignSceneLabel, restoreProgress, sceneForPost, type PostId } from './model';

const { engine, listeners } = vi.hoisted(() => {
  const listeners = new Map<string, (value: unknown) => void>();
  return {
    listeners,
    engine: {
      on: (name: string, fn: (value: unknown) => void) => { listeners.set(name, fn); return () => listeners.delete(name); },
      start: vi.fn(async () => {}), stop: vi.fn(), closeCapture: vi.fn(), loadScene: vi.fn(),
      setTuning: vi.fn(), setMode: vi.fn(), setBandwidth: vi.fn(), setSquelch: vi.fn(), setVolume: vi.fn(),
    },
  };
});
vi.mock('../engine/engine', () => ({ getEngine: () => engine }));

let useCampaign: typeof import('./store')['useCampaign'];
let useStore: typeof import('../store/store')['useStore'];
let useGuide: typeof import('../guide/store')['useGuide'];
let useCtf: typeof import('../ctf/store')['useCtf'];
let key: string;
const storage = new Map<string, string>();

beforeEach(async () => {
  vi.resetModules();
  storage.clear();
  listeners.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
  });
  ({ useCampaign, CAMPAIGN_STORAGE_KEY: key } = await import('./store'));
  ({ useStore } = await import('../store/store'));
  ({ useGuide } = await import('../guide/store'));
  ({ useCtf } = await import('../ctf/store'));
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

function detection(snrDb: number): TrackMsg {
  return {
    id: 'beacon-track', centerFreqHz: FOX_TRAIL.targetHz,
    offsetHz: FOX_TRAIL.targetHz - FOX_TRAIL.centerFreqHz,
    bandwidthHz: 500, snrDb, crestDb: 12, duty: 0.5,
    guessKind: 'cw', guessLabel: 'Morse code', guessConfidence: 0.9, candidates: [],
  };
}
async function operate(post: PostId, snrDb = 25, samples = 3) {
  useCampaign.getState().visit(post);
  useStore.getState().setMode('cw');
  useStore.getState().setTuning(FOX_TRAIL.targetHz - FOX_TRAIL.centerFreqHz);
  await useStore.getState().start();
  for (let i = 0; i < samples; i++) listeners.get('detections')!([detection(snrDb)]);
}
async function survey() {
  useCampaign.getState().start();
  for (const [i, post] of LISTENING_POSTS.entries()) {
    await operate(post.id, 20 + i * 8);
    expect(useCampaign.getState().recordObservation().ok).toBe(true);
  }
}

describe('Fox trail receiver workflow', () => {
  it('exits captures and previous lessons/taskings before loading a post', () => {
    useStore.setState({ capture: { name: 'old.capture', sampleRate: 1_152_000, datatype: 'ci16_le', centerFreqHz: 7e6, totalSec: 15 } });
    useGuide.setState({ lessonId: 'tune', step: 2, finishedId: 'modes' });
    useCtf.getState().setActive('cold-case');
    useCampaign.getState().start();
    expect(useStore.getState()).toMatchObject({ capture: null, centerFreqHz: FOX_TRAIL.centerFreqHz, sceneLabel: campaignSceneLabel('south-gate'), view: 'console' });
    expect(useGuide.getState()).toMatchObject({ lessonId: null, finishedId: null });
    expect(useCtf.getState().activeId).toBeNull();
    expect(engine.closeCapture).toHaveBeenCalledOnce();
    expect(engine.loadScene).toHaveBeenLastCalledWith(sceneForPost('south-gate'));
  });

  it('requires real detector updates, then logs a post once with the measured peak', async () => {
    useCampaign.getState().start();
    await operate('south-gate', 21, 2);
    expect(useCampaign.getState().recordObservation().ok).toBe(false);
    expect(storage.has(key)).toBe(false);
    listeners.get('detections')!([detection(28)]);
    expect(useCampaign.getState().recordObservation().ok).toBe(true);
    expect(useCampaign.getState().observations[0].snrDb).toBe(28);
    expect(useCampaign.getState().recordObservation().ok).toBe(false);
    expect(useCampaign.getState().observations).toHaveLength(1);
  });

  it('keeps receiver settings between posts, but requires fresh signal measurements', async () => {
    useCampaign.getState().start();
    await operate('south-gate');
    expect(useCampaign.getState().recordObservation().ok).toBe(true);
    useCampaign.getState().visit('footbridge');
    expect(useStore.getState()).toMatchObject({ mode: 'cw', tuningOffsetHz: FOX_TRAIL.targetHz - FOX_TRAIL.centerFreqHz });
    expect(useCampaign.getState().liveSignal).toBeNull();
    expect(useCampaign.getState().recordObservation().ok).toBe(false);
    for (let i = 0; i < 3; i++) listeners.get('detections')!([detection(31)]);
    expect(useCampaign.getState().recordObservation().ok).toBe(true);
  });

  it.each(['paused', 'retuned', 'mode', 'scene', 'capture'] as const)('rejects %s receiver evidence', async (change) => {
    useCampaign.getState().start();
    await operate('south-gate');
    const rx = useStore.getState();
    if (change === 'paused') rx.stop();
    if (change === 'retuned') rx.setTuning(0);
    if (change === 'mode') rx.setMode('am');
    if (change === 'scene') rx.loadScenario(rx.scenarioId);
    if (change === 'capture') useStore.setState({ capture: { name: 'other', sampleRate: 1_152_000, datatype: 'cf32_le', centerFreqHz: FOX_TRAIL.centerFreqHz, totalSec: 1 } });
    expect(useCampaign.getState().recordObservation().ok).toBe(false);
    expect(useCampaign.getState().liveSignal).toBeNull();
    expect(useCampaign.getState().observations).toHaveLength(0);
  });

  it('requires new decoder evidence after surveying and invalidates it on a retune', async () => {
    await survey();
    expect(useCampaign.getState().stage).toBe('identify');
    expect(useCampaign.getState().copyIdentifier().ok).toBe(false);
    listeners.get('morse')!('VVV FOX 70');
    expect(useCampaign.getState().copyIdentifier().ok).toBe(false);
    listeners.get('morse')!(''); // a fresh decoder run, not an edit of old copy
    listeners.get('morse')!('VVV FOX 7');
    expect(useCampaign.getState().liveIdentifier).toBe('VVV FOX 7');
    useStore.getState().setTuning(0);
    useStore.getState().setTuning(FOX_TRAIL.targetHz - FOX_TRAIL.centerFreqHz);
    expect(useCampaign.getState().copyIdentifier().ok).toBe(false);
    listeners.get('morse')!('VVV FOX 7 V');
    expect(useCampaign.getState().copyIdentifier().ok).toBe(false);
    listeners.get('morse')!('VVV FOX 7 VVV FOX 7');
    expect(useCampaign.getState().copyIdentifier().ok).toBe(true);
    expect(useCampaign.getState().stage).toBe('locate');
  });

  it.each([false, true])('accepts real decoder character revisions with an existing rolling window: %s', async (rolling) => {
    await survey();
    const decoder = new MorseDecoder();
    const receive = (message: string) => {
      for (const segment of encodeMorse(message, 18)) {
        decoder.push(segment.on, segment.durSec);
        // Match worker.ts: incomplete letters are revised in place, and only
        // the final 40 characters are sent to the receiver store.
        listeners.get('morse')!(decoder.output.slice(-40));
      }
    };
    if (rolling) {
      receive('VVV FOX 7  '.repeat(6));
      expect(useStore.getState().morseText).toHaveLength(40);
      useStore.getState().setBandwidth(1000);
      expect(useCampaign.getState().liveIdentifier).toBeNull();
    }
    receive('VVV ');
    expect(useCampaign.getState().copyIdentifier().ok).toBe(false);
    receive('FOX 7  ');
    expect(useCampaign.getState().liveIdentifier).not.toBeNull();
    expect(useCampaign.getState().copyIdentifier().ok).toBe(true);
  });

  it('does not mistake a repeated old window for new text when its last letter changes', async () => {
    await survey();
    const decoder = new MorseDecoder();
    const receive = (segments: ReturnType<typeof encodeMorse>) => {
      for (const segment of segments) {
        decoder.push(segment.on, segment.durSec);
        listeners.get('morse')!(decoder.output.slice(-40));
      }
    };
    receive(encodeMorse('VVV FOX 7  '.repeat(6) + 'VVV FOX ', 18));
    const seven = encodeMorse('7  ', 18);
    receive(seven.slice(0, 8)); // --.. is provisionally Z, before the final dot.
    expect(useStore.getState().morseText).toHaveLength(40);
    expect(useStore.getState().morseText.endsWith('FOX Z')).toBe(true);
    useStore.getState().setBandwidth(1000);
    receive(seven.slice(8));
    expect(useStore.getState().morseText.endsWith('FOX 7')).toBe(true);
    expect(useCampaign.getState().copyIdentifier().ok).toBe(false);
    receive(encodeMorse('VVV FOX 7  ', 18));
    expect(useCampaign.getState().copyIdentifier().ok).toBe(true);
  });

  it.each(['paused', 'mode', 'bandwidth', 'scene'] as const)('discards a copied live identifier after %s changes', async (change) => {
    await survey();
    listeners.get('morse')!('VVV FOX 7');
    expect(useCampaign.getState().liveIdentifier).not.toBeNull();
    const rx = useStore.getState();
    if (change === 'paused') rx.stop();
    if (change === 'mode') rx.setMode('am');
    if (change === 'bandwidth') rx.setBandwidth(1000);
    if (change === 'scene') rx.loadScenario(rx.scenarioId);
    expect(useCampaign.getState().liveIdentifier).toBeNull();
    expect(useCampaign.getState().copyIdentifier().ok).toBe(false);
    listeners.get('morse')!('VVV FOX 7 V');
    expect(useCampaign.getState().copyIdentifier().ok).toBe(false);
    expect(useCampaign.getState().identification).toBeNull();
  });

  it('does not recycle an identifier copied before the survey finished', async () => {
    useCampaign.getState().start();
    for (const post of LISTENING_POSTS) {
      await operate(post.id);
      listeners.get('morse')!('VVV FOX 7');
      expect(useCampaign.getState().recordObservation().ok).toBe(true);
    }
    listeners.get('morse')!('VVV FOX 7 V');
    expect(useCampaign.getState().copyIdentifier().ok).toBe(false);
    listeners.get('morse')!('VVV FOX 7 VVV FOX 7');
    expect(useCampaign.getState().copyIdentifier().ok).toBe(true);
  });

  it('keeps failed guesses out of the journal and restores completion without live proof', async () => {
    await survey();
    expect(useCampaign.getState().locate(CORRECT_SITE).ok).toBe(false);
    listeners.get('morse')!('VVV FOX 7');
    expect(useCampaign.getState().copyIdentifier().ok).toBe(true);
    const before = storage.get(key);
    expect(useCampaign.getState().locate('old-mill').ok).toBe(false);
    expect(storage.get(key)).toBe(before);
    expect(useCampaign.getState().locate(CORRECT_SITE).ok).toBe(true);
    const persisted = JSON.parse(storage.get(key)!);
    expect(restoreProgress(persisted).completedAt).not.toBeNull();
    expect(persisted).not.toHaveProperty('liveIdentifier');
    expect(persisted).not.toHaveProperty('active');
    vi.resetModules();
    const reloaded = (await import('./store')).useCampaign.getState();
    expect(reloaded).toMatchObject({ active: false, stage: 'complete', liveSignal: null, liveIdentifier: null });
    expect(reloaded.completedAt).toBe(persisted.completedAt);
    expect(reloaded.observations).toHaveLength(3);
  });

  it('resumes a partial expedition on its actual post after another scene was opened', async () => {
    useCampaign.getState().start();
    await operate('footbridge');
    expect(useCampaign.getState().recordObservation().ok).toBe(true);
    useStore.getState().loadScenario(useStore.getState().scenarioId);
    expect(useCampaign.getState().active).toBe(false);
    useCampaign.getState().resume();
    expect(useStore.getState().sceneLabel).toEqual(campaignSceneLabel('footbridge'));
    expect(useCampaign.getState()).toMatchObject({ active: true, postId: 'footbridge', liveSignal: null, liveIdentifier: null });
    expect(useCampaign.getState().observations).toHaveLength(1);
    expect(engine.loadScene).toHaveBeenLastCalledWith(sceneForPost('footbridge'));
  });

  it('lets a verified journal support the final choice while paused, but leaves another scene alone', async () => {
    await survey();
    listeners.get('morse')!('VVV FOX 7');
    expect(useCampaign.getState().copyIdentifier().ok).toBe(true);
    useStore.getState().stop();
    useStore.getState().loadScenario(useStore.getState().scenarioId);
    expect(useCampaign.getState().active).toBe(false);
    expect(useCampaign.getState().locate(CORRECT_SITE).ok).toBe(false);
    useCampaign.getState().resume();
    expect(useStore.getState()).toMatchObject({ running: false, mode: 'nfm', tuningOffsetHz: 0 });
    expect(useCampaign.getState().locate(CORRECT_SITE).ok).toBe(true);
  });
});
