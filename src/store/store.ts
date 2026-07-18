import { create } from 'zustand';
import { getEngine } from '../engine/engine';
import type { TrackMsg } from '../engine/protocol';
import type { DemodMode, SignalKind } from '../sim/signal-kinds';
import { KIND_INFO } from '../sim/signal-kinds';
import { SCENARIOS, scenarioById, toSceneSpec } from '../scenarios/scenarios';
import { scoreIdentification } from '../scenarios/scoring';

export const MODE_BW: Record<DemodMode, number> = {
  wfm: 180_000,
  nfm: 12_000,
  am: 8_000,
  usb: 2_700,
  lsb: 2_700,
  cw: 500,
  raw: 20_000,
};

export const DEMOD_MODES: DemodMode[] = ['wfm', 'nfm', 'am', 'usb', 'lsb', 'cw', 'raw'];

export type PanelTab = 'signals' | 'library' | 'scenario';

export type AppView = 'console' | 'academy';

export interface Recording {
  name: string;
  durationSec: number;
  centerFreqHz: number;
  at: number;
}

/** Label of the nearest detected emission to the current VFO, if any. */
export function nearestLabel(detections: TrackMsg[], tuningOffsetHz: number): string | null {
  let best: TrackMsg | null = null;
  let bd = Infinity;
  for (const d of detections) {
    const dd = Math.abs(d.offsetHz - tuningOffsetHz);
    if (dd < Math.max(d.bandwidthHz, 12000) && dd < bd) {
      bd = dd;
      best = d;
    }
  }
  return best ? best.guessLabel : null;
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
  audioStarted: boolean;
  cmapIndex: number;
  floorDb: number;
  ceilDb: number;
  recordings: Recording[];
  playingSince: number | null;

  start: () => Promise<void>;
  stop: () => void;
  loadScenario: (id: string) => void;
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
  toggleReveal: () => void;
  toggleRecording: () => void;
  injectSignal: (kind: SignalKind) => void;
  selectTrack: (id: string | null) => void;
  setPanel: (p: PanelTab) => void;
  setView: (v: AppView) => void;
  setCmap: (i: number) => void;
  setDbRange: (floorDb: number, ceilDb: number) => void;
}

const engine = getEngine();

export const useStore = create<AppState>((set, get) => {
  // Wire engine events into the store (once).
  engine.on('detections', (tracks) => set({ detections: tracks }));
  engine.on('morse', (text) => set({ morseText: text }));
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
    audioStarted: false,
    cmapIndex: 0,
    floorDb: -80,
    ceilDb: -22,
    recordings: [],
    playingSince: null,

    start: async () => {
      const st = get();
      if (!st.audioStarted) {
        // First start: load the current scenario into the worker.
        const sc = scenarioById(st.scenarioId)!;
        engine.loadScene(toSceneSpec(sc));
        engine.setTuning(st.tuningOffsetHz);
        engine.setMode(st.mode);
        engine.setBandwidth(st.bandwidthHz);
        engine.setSquelch(st.squelchDb);
        engine.setVolume(st.volume);
      }
      await engine.start();
      set({ running: true, audioStarted: true, playingSince: Date.now() });
    },

    stop: () => {
      engine.stop();
      set({ running: false, playingSince: null });
    },

    loadScenario: (id) => {
      const sc = scenarioById(id);
      if (!sc) return;
      engine.loadScene(toSceneSpec(sc));
      set({
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
      engine.setCenter(hz);
      set({ centerFreqHz: hz, tuningOffsetHz: 0, detections: [] });
    },

    setTuning: (offsetHz) => {
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
      get().tuneToTrack(list[ni]);
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
      } else if (res.actualLabel) {
        message = `Not quite — that emitter is actually ${res.actualLabel}.`;
      } else {
        message = 'No known emitter at that frequency.';
      }
      set({ idFeedback: { correct: res.correct, message, at: Date.now() } });
    },

    tuneToTrack: (track) => {
      const info = Object.values(KIND_INFO).find((k) => k.label === track.guessLabel);
      const mode = info?.recommendedDemod ?? get().mode;
      const bw = MODE_BW[mode];
      engine.setTuning(track.offsetHz);
      engine.setMode(mode);
      engine.setBandwidth(bw);
      set({ tuningOffsetHz: track.offsetHz, mode, bandwidthHz: bw, selectedId: track.id });
    },

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
    setCmap: (i) => set({ cmapIndex: i }),
    setDbRange: (floorDb, ceilDb) => set({ floorDb, ceilDb }),
  };
});
