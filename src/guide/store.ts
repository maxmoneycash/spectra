import { create } from 'zustand';
import { useStore, nearestTrack } from '../store/store';
import { useCtf } from '../ctf/store';
import { challengeById, toSceneSpec } from '../ctf/challenges';
import { LESSONS, lessonById, type GuideCtx } from './lessons';
import { DEFAULT_SQUELCH_DB } from '../store/modes';

const KEY = 'spectra.guide.v1';

interface Saved {
  completed: string[];
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Saved>;
      return { completed: Array.isArray(p.completed) ? p.completed.filter((x) => typeof x === 'string') : [] };
    }
  } catch {
    /* private mode or corrupt — start fresh */
  }
  return { completed: [] };
}

function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* quota or private mode — progress just won't persist */
  }
}

interface GuideState {
  /** Lesson in progress, or null. */
  lessonId: string | null;
  step: number;
  /** Intercept count when the lesson began, so "log one" means a new one. */
  baseIntercepts: number;
  completed: string[];
  /** Lesson that just finished — drives the completion card. */
  finishedId: string | null;

  start: (id: string) => void;
  /** Advance one step (reading steps, a passed check, or Skip). */
  next: () => void;
  quit: () => void;
  dismissFinished: () => void;
  /** Hand off to the CTF challenge that tests the lesson's skill. */
  openChallenge: (lessonId: string) => void;
  reset: () => void;
}

/** Snapshot the receiver state that lesson checks read. */
export function guideCtx(baseIntercepts: number): GuideCtx {
  const s = useStore.getState();
  return {
    running: s.running,
    tunedHz: s.centerFreqHz + s.tuningOffsetHz,
    mode: s.mode,
    bandwidthHz: s.bandwidthHz,
    squelchDb: s.squelchDb,
    morseText: s.morseText,
    deckPage: s.deckPage,
    panel: s.panel,
    scanStatus: s.scan?.status ?? null,
    selectedId: s.selectedId,
    identified: s.correctlyIdentified,
    newIntercepts: Math.max(0, s.intercepts.length - baseIntercepts),
    chirpSf: (s.detections.find((d) => d.id === s.selectedId) ?? nearestTrack(s.detections, s.tuningOffsetHz))?.chirp?.sf ?? null,
  };
}

/** Bring the step's controls on screen: deck page on phones, inspector tab on desktop. */
function steer(lessonId: string, step: number) {
  const st = lessonById(lessonId)?.steps[step];
  if (!st) return;
  const s = useStore.getState();
  if (st.deckPage && s.deckPage !== st.deckPage) s.setDeckPage(st.deckPage);
  if (st.panel && s.panel !== st.panel) s.setPanel(st.panel);
}

export const useGuide = create<GuideState>((set, get) => ({
  lessonId: null,
  step: 0,
  baseIntercepts: 0,
  completed: load().completed,
  finishedId: null,

  start(id) {
    const lesson = lessonById(id);
    if (!lesson) return;
    const s = useStore.getState();
    s.loadSpec(lesson.scene, { name: lesson.title, tag: 'training', from: 'academy' });
    // A clean receiver, so earlier fiddling can't skip or block a lesson.
    s.setMode(lesson.startMode ?? 'nfm');
    s.setSquelch(lesson.startSquelchDb ?? DEFAULT_SQUELCH_DB);
    s.setView('console');
    useCtf.getState().setActive(null);
    // The first lesson teaches the power button; the rest assume it.
    if (id !== LESSONS[0].id && !s.running) void s.start();
    set({ lessonId: id, step: 0, baseIntercepts: s.intercepts.length, finishedId: null });
    steer(id, 0);
  },

  next() {
    const { lessonId, step, completed } = get();
    const lesson = lessonId ? lessonById(lessonId) : undefined;
    if (!lesson) return;
    if (step + 1 < lesson.steps.length) {
      set({ step: step + 1 });
      steer(lesson.id, step + 1);
      return;
    }
    const done = completed.includes(lesson.id) ? completed : [...completed, lesson.id];
    save({ completed: done });
    set({ lessonId: null, step: 0, completed: done, finishedId: lesson.id });
  },

  quit: () => set({ lessonId: null, step: 0 }),
  dismissFinished: () => set({ finishedId: null }),

  openChallenge(lessonId) {
    const lesson = lessonById(lessonId);
    const c = lesson && challengeById(lesson.challengeId);
    if (!c) return;
    const s = useStore.getState();
    s.loadSpec(toSceneSpec(c), { name: c.name, tag: 'tasking', from: 'ctf' });
    s.setSquelch(c.startSquelchDb ?? DEFAULT_SQUELCH_DB);
    useCtf.getState().setActive(c.id);
    s.setView('ctf');
    set({ finishedId: null });
  },

  reset() {
    save({ completed: [] });
    set({ completed: [], lessonId: null, step: 0, finishedId: null });
  },
}));
