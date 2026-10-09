import { create } from 'zustand';
import { getEngine } from '../engine/engine';
import type { SceneSpec, TrackMsg } from '../engine/protocol';
import type { DemodMode, SignalKind } from '../sim/signal-kinds';
import { KIND_INFO } from '../sim/signal-kinds';
import { SCENARIOS, scenarioById, toSceneSpec } from '../scenarios/scenarios';
import { scoreIdentification } from '../scenarios/scoring';
import { Scanner, type ScanSnapshot } from '../engine/scanner';
import { SAMPLE_RATE } from '../engine/protocol';

export { MODE_BW, BW_RANGE, DEMOD_MODES } from './modes';
import { MODE_BW } from './modes';

export type PanelTab = 'signals' | 'scan' | 'log' | 'library' | 'scenario';

export type AppView = 'console' | 'academy' | 'exam' | 'ctf';

/** Pages of the phone receiver deck (lifted here so walkthroughs can steer it). */
export type DeckPage = 'mode' | 'filter' | 'audio' | 'scan';

/** Persisted operator record powering the shareable Operator Card. */
export interface OperatorRecord {
  since: number;
  identified: SignalKind[];
  missions: string[];
}

const OPERATOR_KEY = 'spectra.operator.v1';

function loadOperator(): OperatorRecord {
  try {
    const raw = JSON.parse(localStorage.getItem(OPERATOR_KEY) || 'null');
    if (raw && Array.isArray(raw.identified) && Array.isArray(raw.missions)) {
      return { since: raw.since ?? Date.now(), identified: raw.identified, missions: raw.missions };
    }
  } catch {
    /* ignore */
  }
  return { since: Date.now(), identified: [], missions: [] };
}

function saveOperator(rec: OperatorRecord): void {
  try {
    localStorage.setItem(OPERATOR_KEY, JSON.stringify(rec));
  } catch {
    /* ignore */
  }
}

export interface Recording {
  name: string;
  durationSec: number;
  centerFreqHz: number;
  at: number;
}

/** Label of the nearest detected emission to the current VFO, if any. */
/** The detected signal the VFO is sitting on, if any. */
export function nearestTrack(detections: TrackMsg[], tuningOffsetHz: number): TrackMsg | null {
  let best: TrackMsg | null = null;
  let bd = Infinity;
  for (const d of detections) {
    const dd = Math.abs(d.offsetHz - tuningOffsetHz);
    if (dd < Math.max(d.bandwidthHz, 12000) && dd < bd) {
      bd = dd;
      best = d;
    }
  }
  return best;
}

export function nearestLabel(detections: TrackMsg[], tuningOffsetHz: number): string | null {
  return nearestTrack(detections, tuningOffsetHz)?.guessLabel ?? null;
}

/** Someone transmitting right now (from the simulator's tx events). */
export interface OnAir {
  freqHz: number;
  who: string;
  text: string;
  set: string;
  line: number;
  startedAt: number;
  until: number;
}

/** A transmission you were tuned to — the SIGINT intercept log. */
export interface Intercept {
  id: string;
  at: number;
  freqHz: number;
  mode: DemodMode;
  who: string;
  text: string;
}

/** What the header chip says when the scene isn't a built-in scenario. */
export interface SceneLabel {
  name: string;
  /** Short tag beside the name, e.g. "training" or "tasking". */
  tag: string;
  /** Where the chip leads back to. */
  from: AppView;
}

/** A tap on the waterfall that snapped the VFO onto a signal. */
export interface LockFx {
  offsetHz: number;
  bandwidthHz: number;
  label: string;
  mode: DemodMode;
  trackId: string;
  at: number;
}

interface IdFeedback {
  correct: boolean;
  message: string;
  at: number;
}

interface AppState {
  running: boolean;
  scenarioId: string;
  centerFreqHz: number;
  tuningOffsetHz: number;
  mode: DemodMode;
  bandwidthHz: number;
  squelchDb: number;
  volume: number;
  noiseSigma: number;
  detections: TrackMsg[];
  morseText: string;
  revealTruth: boolean;
  correctlyIdentified: SignalKind[];
  idFeedback: IdFeedback | null;
  selectedId: string | null;
  recording: boolean;
  panel: PanelTab;
  view: AppView;
  cardOpen: boolean;
  operator: OperatorRecord;
  audioStarted: boolean;
  /** True once any view has pushed a scene to the worker. */
  sceneLoaded: boolean;
  cmapIndex: number;
  floorDb: number;
  ceilDb: number;
  recordings: Recording[];
  playingSince: number | null;
  lockFx: LockFx | null;
  onAir: Record<string, OnAir>;
  intercepts: Intercept[];
  scan: ScanSnapshot | null;
  deckPage: DeckPage;
  /** Set for walkthrough and Tasking scenes; null for built-in scenarios. */
  sceneLabel: SceneLabel | null;

  start: () => Promise<void>;
  stop: () => void;
  loadScenario: (id: string) => void;
  /** Load an ad-hoc scene (a CTF challenge or a walkthrough) into the engine. */
  loadSpec: (spec: SceneSpec, label?: SceneLabel) => void;
  setCenter: (hz: number) => void;
  setTuning: (offsetHz: number) => void;
  tuneTo: (freqHz: number) => void;
  tuneStep: (dir: 1 | -1) => void;
  setMode: (mode: DemodMode) => void;
  setBandwidth: (hz: number) => void;
  setSquelch: (db: number) => void;
  setVolume: (v: number) => void;
  setNoise: (sigma: number) => void;
  identify: (trackId: string, kind: SignalKind) => void;
  tuneToTrack: (track: TrackMsg) => void;
  /** Snap onto a detected signal: center, recommended mode and filter. */
  lockOn: (track: TrackMsg, opts?: { fromScanner?: boolean }) => void;
  setDeckPage: (p: DeckPage) => void;
  scanToggle: () => void;
  scanStep: (hz: number) => void;
  scanLockout: () => void;
  scanNext: () => void;
  scanClearLockouts: () => void;
  toggleReveal: () => void;
  toggleRecording: () => void;
  injectSignal: (kind: SignalKind) => void;
  selectTrack: (id: string | null) => void;
  setPanel: (p: PanelTab) => void;
  setView: (v: AppView) => void;
  setCardOpen: (open: boolean) => void;
  recordMission: (id: string) => void;
  markSceneLoaded: () => void;
  setCmap: (i: number) => void;
  setDbRange: (floorDb: number, ceilDb: number) => void;
}

const engine = getEngine();

export const useStore = create<AppState>((set, get) => {
  // Wire engine events into the store (once).
  engine.on('detections', (tracks) => set({ detections: tracks }));
  engine.on('morse', (text) => set({ morseText: text }));
  engine.on('tx', (e) => {
    const now = Date.now();
    const st = get();
    const onAir = { ...st.onAir };
    // Forget transmissions that ended a while ago.
    for (const [k, v] of Object.entries(onAir)) if (v.until < now - 5000) delete onAir[k];
    onAir[e.emitterId] = {
      freqHz: e.freqHz,
      who: e.who,
      text: e.text,
      set: e.set,
      line: e.line,
      startedAt: now,
      until: now + e.durSec * 1000 + 350,
    };
    // Log it if the receiver is actually tuned to it: inside the passband.
    const tuned = st.centerFreqHz + st.tuningOffsetHz;
    const heard = st.running && Math.abs(tuned - e.freqHz) <= Math.max(1500, st.bandwidthHz / 2);
    const intercepts = heard
      ? [
          { id: `${e.emitterId}-${now}`, at: now, freqHz: e.freqHz, mode: st.mode, who: e.who, text: e.text },
          ...st.intercepts,
        ].slice(0, 300)
      : st.intercepts;
    set({ onAir, intercepts });
  });
  const scanner = new Scanner({
    centerHz: () => get().centerFreqHz,
    setTuning: (off) => {
      const clamped = Math.max(-SAMPLE_RATE / 2, Math.min(SAMPLE_RATE / 2, off));
      engine.setTuning(clamped);
      set({ tuningOffsetHz: clamped, selectedId: null });
    },
    squelchDb: () => get().squelchDb,
    publish: (snap) => set({ scan: snap }),
    onHold: (freqHz) => {
      // Snap exactly onto the detected emission behind the hit, if any.
      const st = get();
      const off = freqHz - st.centerFreqHz;
      let best: TrackMsg | null = null;
      for (const d of st.detections) {
        if (Math.abs(d.offsetHz - off) <= d.bandwidthHz / 2 + 12_500) {
          if (!best || Math.abs(d.offsetHz - off) < Math.abs(best.offsetHz - off)) best = d;
        }
      }
      if (best) st.lockOn(best, { fromScanner: true });
    },
  });
  engine.on('meter', (db) => scanner.onLevel(db));

  engine.on('recordingSaved', (r) =>
    set((s) => ({ recordings: [{ ...r, at: Date.now() }, ...s.recordings].slice(0, 20) })),
  );

  return {
    running: false,
    scenarioId: SCENARIOS[0].id,
    centerFreqHz: SCENARIOS[0].centerFreqHz,
    tuningOffsetHz: 0,
    mode: 'wfm',
    bandwidthHz: MODE_BW.wfm,
    squelchDb: -80,
    volume: 0.7,
    noiseSigma: SCENARIOS[0].noiseSigma,
    detections: [],
    morseText: '',
    revealTruth: false,
    correctlyIdentified: [],
    idFeedback: null,
    selectedId: null,
    recording: false,
    panel: 'signals',
    view: 'console',
    cardOpen: false,
    operator: loadOperator(),
    audioStarted: false,
    sceneLoaded: false,
    cmapIndex: 0,
    floorDb: -80,
    ceilDb: -22,
    recordings: [],
    playingSince: null,
    lockFx: null,
    onAir: {},
    intercepts: [],
    scan: null,
    deckPage: 'mode',
    sceneLabel: null,

    start: async () => {
      const st = get();
      if (!st.audioStarted) {
        // First start: push the default scenario only if nothing else has
        // already loaded a scene. The CTF and deep links load their own, and
        // clobbering them here left the UI labelling the wrong spectrum.
        if (!st.sceneLoaded) {
          const sc = scenarioById(st.scenarioId)!;
          engine.loadScene(toSceneSpec(sc));
        }
        engine.setTuning(st.tuningOffsetHz);
        engine.setMode(st.mode);
        engine.setBandwidth(st.bandwidthHz);
        engine.setSquelch(st.squelchDb);
        engine.setVolume(st.volume);
      }
      await engine.start();
      set({ running: true, audioStarted: true, sceneLoaded: true, playingSince: Date.now() });
    },

    stop: () => {
      engine.stop();
      set({ running: false, playingSince: null });
    },

    loadSpec: (spec, label) => {
      scanner.reset();
      engine.loadScene(spec);
      set({
        sceneLabel: label ?? { name: 'Custom scene', tag: 'sandbox', from: 'console' },
        sceneLoaded: true,
        centerFreqHz: spec.centerFreqHz,
        noiseSigma: spec.noiseSigma,
        tuningOffsetHz: 0,
        detections: [],
        morseText: '',
        correctlyIdentified: [],
        idFeedback: null,
        selectedId: null,
      });
      engine.setTuning(0);
    },

    loadScenario: (id) => {
      const sc = scenarioById(id);
      if (!sc) return;
      scanner.reset();
      engine.loadScene(toSceneSpec(sc));
      set({
        sceneLabel: null,
        sceneLoaded: true,
        scenarioId: id,
        centerFreqHz: sc.centerFreqHz,
        noiseSigma: sc.noiseSigma,
        tuningOffsetHz: 0,
        detections: [],
        morseText: '',
        correctlyIdentified: [],
        idFeedback: null,
        revealTruth: false,
        selectedId: null,
      });
      engine.setTuning(0);
    },

    setCenter: (hz) => {
      scanner.reset();
      engine.setCenter(hz);
      set({ centerFreqHz: hz, tuningOffsetHz: 0, detections: [] });
    },

    setTuning: (offsetHz) => {
      // Turning the dial takes the receiver back from the scanner.
      if (scanner.active) scanner.stop();
      engine.setTuning(offsetHz);
      set({ tuningOffsetHz: offsetHz });
    },

    tuneTo: (freqHz) => {
      const st = get();
      const span = engine.sampleRate;
      const offset = freqHz - st.centerFreqHz;
      if (Math.abs(offset) <= span * 0.45) {
        engine.setTuning(Math.round(offset));
        set({ tuningOffsetHz: Math.round(offset) });
      } else {
        engine.setCenter(freqHz);
        set({ centerFreqHz: freqHz, tuningOffsetHz: 0, detections: [] });
      }
    },

    tuneStep: (dir) => {
      const st = get();
      const list = [...st.detections].sort((a, b) => a.centerFreqHz - b.centerFreqHz);
      if (!list.length) return;
      const curFreq = st.centerFreqHz + st.tuningOffsetHz;
      let idx = 0;
      let best = Infinity;
      list.forEach((d, i) => {
        const dd = Math.abs(d.centerFreqHz - curFreq);
        if (dd < best) {
          best = dd;
          idx = i;
        }
      });
      let ni = idx + dir;
      if (ni < 0) ni = list.length - 1;
      else if (ni >= list.length) ni = 0;
      get().lockOn(list[ni]);
    },

    setMode: (mode) => {
      const bw = MODE_BW[mode];
      engine.setMode(mode);
      engine.setBandwidth(bw);
      set({ mode, bandwidthHz: bw });
    },

    setBandwidth: (hz) => {
      engine.setBandwidth(hz);
      set({ bandwidthHz: hz });
    },

    setSquelch: (db) => {
      engine.setSquelch(db);
      set({ squelchDb: db });
    },

    setVolume: (v) => {
      engine.setVolume(v);
      set({ volume: v });
    },

    setNoise: (sigma) => {
      engine.setNoise(sigma);
      set({ noiseSigma: sigma });
    },

    identify: (trackId, kind) => {
      const track = get().detections.find((t) => t.id === trackId);
      if (!track) return;
      const res = scoreIdentification(track, kind, engine.groundTruth());
      let message: string;
      if (res.correct) {
        message = `Correct — ${KIND_INFO[kind].label} confirmed.`;
        const cur = get().correctlyIdentified;
        if (!cur.includes(kind)) set({ correctlyIdentified: [...cur, kind] });
        const op = get().operator;
        if (!op.identified.includes(kind)) {
          const next = { ...op, identified: [...op.identified, kind] };
          saveOperator(next);
          set({ operator: next });
        }
      } else if (res.actualLabel) {
        message = `Not quite — that emitter is actually ${res.actualLabel}.`;
      } else {
        message = 'No known emitter at that frequency.';
      }
      set({ idFeedback: { correct: res.correct, message, at: Date.now() } });
    },

    tuneToTrack: (track) => {
      const info = Object.values(KIND_INFO).find((k) => k.label === track.guessLabel);
      const st = get();
      const mode = info?.recommendedDemod ?? st.mode;
      // Keep the operator's filter if the mode isn't changing: re-tapping a CW
      // signal to center it must not throw a narrowed filter back to 500 Hz.
      const bw = mode === st.mode ? st.bandwidthHz : MODE_BW[mode];
      engine.setTuning(track.offsetHz);
      engine.setMode(mode);
      engine.setBandwidth(bw);
      set({ tuningOffsetHz: track.offsetHz, mode, bandwidthHz: bw, selectedId: track.id });
    },

    lockOn: (track, opts) => {
      if (!opts?.fromScanner && scanner.active) scanner.stop();
      get().tuneToTrack(track);
      const { mode, bandwidthHz } = get();
      set({
        lockFx: {
          offsetHz: track.offsetHz,
          bandwidthHz: Math.max(bandwidthHz, track.bandwidthHz),
          label: track.guessLabel,
          mode,
          trackId: track.id,
          at: Date.now(),
        },
      });
    },

    scanToggle: () => {
      if (scanner.active) scanner.stop();
      else {
        const mode = get().mode;
        // Sensible raster for the mode, unless the operator already chose one.
        if (!get().scan) scanner.stepHz = mode === 'wfm' ? 100_000 : mode === 'am' ? 25_000 : mode === 'nfm' ? 12_500 : 5_000;
        scanner.start(get().tuningOffsetHz);
      }
    },
    setDeckPage: (p) => set({ deckPage: p }),
    scanStep: (hz) => scanner.setStep(hz),
    scanLockout: () => scanner.lockout(),
    scanNext: () => scanner.next(),
    scanClearLockouts: () => scanner.clearLockouts(),

    toggleReveal: () => set((s) => ({ revealTruth: !s.revealTruth })),

    toggleRecording: () => {
      const rec = get().recording;
      if (rec) engine.stopRecording();
      else engine.startRecording();
      set({ recording: !rec });
    },

    injectSignal: (kind) => {
      const st = get();
      // Place near the tuned point (or centre) with a small offset.
      const offset = st.tuningOffsetHz || (Math.random() - 0.5) * 400_000;
      const freqHz = st.centerFreqHz + offset;
      const id = `user-${Date.now().toString(36)}`;
      engine.addEmitter({ id, kind, freqHz, powerDb: -5 });
    },

    selectTrack: (id) => set({ selectedId: id }),
    setPanel: (p) => set({ panel: p }),
    setView: (v) => set({ view: v }),
    setCardOpen: (open) => set({ cardOpen: open }),
    recordMission: (id) => {
      const op = get().operator;
      if (op.missions.includes(id)) return;
      const next = { ...op, missions: [...op.missions, id] };
      saveOperator(next);
      set({ operator: next });
    },
    markSceneLoaded: () => set({ sceneLoaded: true }),

    setCmap: (i) => set({ cmapIndex: i }),
    setDbRange: (floorDb, ceilDb) => set({ floorDb, ceilDb }),
  };
});
