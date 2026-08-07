import { create } from 'zustand';
import type { ElementId, PoolQuestion } from './types';
import { subelementOf } from './types';

const STORAGE_KEY = 'spectra.exam.v1';

/** Per-question spaced-repetition state (Leitner boxes 0–4). */
export interface Progress {
  box: number;
  seen: number;
  wrong: number;
  /** Timestamp of the last answer. */
  at: number;
}

type ProgressMap = Record<string, Progress>;

interface Persisted {
  progress: ProgressMap;
  pool: ElementId;
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Persisted;
      if (p && typeof p === 'object' && p.progress) {
        return { progress: p.progress, pool: p.pool ?? 'technician' };
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  return { progress: {}, pool: 'technician' };
}

function persist(state: Persisted): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode — progress is a nicety, not a requirement */
  }
}

/**
 * How badly a question needs review. Unseen questions come first, then the
 * ones you keep getting wrong; mastered ones resurface rarely.
 */
const BOX_WEIGHT = [80, 40, 20, 8, 3];
function weightOf(p: Progress | undefined): number {
  if (!p) return 140;
  return BOX_WEIGHT[Math.min(p.box, BOX_WEIGHT.length - 1)] + p.wrong * 6;
}

/** Weighted shuffle — heavier questions drift toward the front. */
function buildQueue(questions: PoolQuestion[], progress: ProgressMap): string[] {
  return questions
    .map((q) => ({ id: q.id, k: Math.random() ** (1 / Math.max(1, weightOf(progress[q.id]))) }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.id);
}

export interface ExamState {
  pool: ElementId;
  questions: PoolQuestion[];
  byId: Record<string, PoolQuestion>;
  loading: boolean;
  queue: string[];
  index: number;
  /** Chosen answer index for the current card, or null before answering. */
  chosen: number | null;
  subFilter: string | null;
  audio: boolean;
  progress: ProgressMap;
  /** Consecutive correct answers this session. */
  streak: number;
  bestStreak: number;
  answered: number;
  correct: number;

  loadPool: (id: ElementId) => Promise<void>;
  setSubFilter: (sub: string | null) => void;
  answer: (choice: number) => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  toggleAudio: () => void;
  resetProgress: () => void;
  current: () => PoolQuestion | null;
}

const LOADERS: Record<ElementId, () => Promise<{ default: PoolQuestion[] }>> = {
  technician: () => import('./pools/technician.gen'),
  general: () => import('./pools/general.gen'),
  extra: () => import('./pools/extra.gen'),
};

export const useExam = create<ExamState>((set, get) => {
  const saved = load();

  const rebuild = (questions: PoolQuestion[], sub: string | null, progress: ProgressMap) => {
    const pool = sub ? questions.filter((q) => subelementOf(q.id) === sub) : questions;
    return buildQueue(pool, progress);
  };

  return {
    pool: saved.pool,
    questions: [],
    byId: {},
    loading: false,
    queue: [],
    index: 0,
    chosen: null,
    subFilter: null,
    audio: false,
    progress: saved.progress,
    streak: 0,
    bestStreak: 0,
    answered: 0,
    correct: 0,

    async loadPool(id) {
      if (get().loading) return;
      set({ loading: true, pool: id, chosen: null, index: 0, subFilter: null });
      const mod = await LOADERS[id]();
      const questions = mod.default;
      const byId: Record<string, PoolQuestion> = {};
      for (const q of questions) byId[q.id] = q;
      const { progress } = get();
      set({
        questions,
        byId,
        queue: rebuild(questions, null, progress),
        loading: false,
      });
      persist({ progress, pool: id });
    },

    setSubFilter(sub) {
      const { questions, progress } = get();
      set({ subFilter: sub, queue: rebuild(questions, sub, progress), index: 0, chosen: null });
    },

    answer(choice) {
      const st = get();
      if (st.chosen !== null) return; // already graded this card
      const q = st.current();
      if (!q) return;
      const right = choice === q.c;
      const prev = st.progress[q.id];
      const box = right ? Math.min(4, (prev?.box ?? 0) + 1) : 0;
      const progress: ProgressMap = {
        ...st.progress,
        [q.id]: {
          box,
          seen: (prev?.seen ?? 0) + 1,
          wrong: (prev?.wrong ?? 0) + (right ? 0 : 1),
          at: Date.now(),
        },
      };
      const streak = right ? st.streak + 1 : 0;
      set({
        chosen: choice,
        progress,
        streak,
        bestStreak: Math.max(st.bestStreak, streak),
        answered: st.answered + 1,
        correct: st.correct + (right ? 1 : 0),
      });
      persist({ progress, pool: st.pool });
    },

    next() {
      const st = get();
      if (!st.queue.length) return;
      // Wrap around, reshuffling so a second pass isn't the same order.
      if (st.index + 1 >= st.queue.length) {
        set({
          queue: rebuild(st.questions, st.subFilter, st.progress),
          index: 0,
          chosen: null,
        });
        return;
      }
      set({ index: st.index + 1, chosen: null });
    },

    prev() {
      const st = get();
      set({ index: Math.max(0, st.index - 1), chosen: null });
    },

    skip() {
      get().next();
    },

    toggleAudio() {
      set((s) => ({ audio: !s.audio }));
    },

    resetProgress() {
      const st = get();
      const progress: ProgressMap = {};
      set({
        progress,
        queue: rebuild(st.questions, st.subFilter, progress),
        index: 0,
        chosen: null,
        streak: 0,
        bestStreak: 0,
        answered: 0,
        correct: 0,
      });
      persist({ progress, pool: st.pool });
    },

    current() {
      const st = get();
      const id = st.queue[st.index];
      return id ? (st.byId[id] ?? null) : null;
    },
  };
});

/** Mastery = questions in box 3+ (answered right several times running). */
export function masteryStats(questions: PoolQuestion[], progress: ProgressMap) {
  let mastered = 0;
  let seen = 0;
  for (const q of questions) {
    const p = progress[q.id];
    if (!p) continue;
    seen++;
    if (p.box >= 3) mastered++;
  }
  const total = questions.length;
  return { total, seen, mastered, pct: total ? Math.round((mastered / total) * 100) : 0 };
}
