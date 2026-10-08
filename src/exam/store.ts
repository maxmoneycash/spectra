import { create } from 'zustand';
import type { ElementId, PoolQuestion } from './types';
import { groupOf, poolMeta, subelementOf } from './types';

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

/** Narration and mode preferences — separate key so progress keeps its shape. */
export type StudyMode = 'quiz' | 'listen';
interface Prefs {
  audio: boolean;
  rate: number;
  mode: StudyMode;
  /** Last question heard in Listen mode, per pool. */
  listenAt: Partial<Record<ElementId, string>>;
}
const PREFS_KEY = 'spectra.exam.prefs.v1';
function loadPrefs(): Prefs {
  const d: Prefs = { audio: true, rate: 1, mode: 'quiz', listenAt: {} };
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      return {
        audio: typeof raw.audio === 'boolean' ? raw.audio : d.audio,
        rate: typeof raw.rate === 'number' && raw.rate >= 0.5 && raw.rate <= 2 ? raw.rate : d.rate,
        mode: raw.mode === 'listen' ? 'listen' : 'quiz',
        listenAt: raw.listenAt && typeof raw.listenAt === 'object' ? raw.listenAt : {},
      };
    }
  } catch {
    /* ignore */
  }
  return d;
}
function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
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

/**
 * A sat practice exam. The VEC builds a real exam by drawing exactly one
 * question from each group in the pool, so that is how `startExam` draws it —
 * the score here means the same thing the score at a test session means.
 */
/** Fisher-Yates, so presentation order is not group order. */
function shuffled<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Draw a practice exam the way a VE session does: one question from every
 * group in the pool. For all three current pools the group count already
 * equals the exam length (General: 35 groups, 35 questions), but pad from the
 * leftovers / trim if NCVEC ever republishes with a different split, so the
 * exam is always exactly `count` questions.
 */
function drawExam(questions: PoolQuestion[], count: number): string[] {
  const byGroup = new Map<string, PoolQuestion[]>();
  for (const q of questions) {
    const g = groupOf(q.id);
    const arr = byGroup.get(g);
    if (arr) arr.push(q);
    else byGroup.set(g, [q]);
  }
  const picked: string[] = [];
  const spares: string[] = [];
  for (const arr of byGroup.values()) {
    const shuf = shuffled(arr);
    picked.push(shuf[0].id);
    for (let i = 1; i < shuf.length; i++) spares.push(shuf[i].id);
  }
  if (picked.length > count) return shuffled(picked).slice(0, count);
  const pad = shuffled(spares).slice(0, Math.max(0, count - picked.length));
  return shuffled([...picked, ...pad]);
}

export interface ExamSession {
  /** The drawn questions, in presentation order. */
  ids: string[];
  /** Answers so far. No verdict is shown until the exam is submitted. */
  answers: Record<string, number>;
  startedAt: number;
  /** Null until submitted. */
  finishedAt: number | null;
}

export interface ExamState {
  pool: ElementId;
  questions: PoolQuestion[];
  byId: Record<string, PoolQuestion>;
  loading: boolean;
  queue: string[];
  index: number;
  /** Chosen answer index per question id — the feed grades each card independently. */
  chosenById: Record<string, number>;
  subFilter: string | null;
  audio: boolean;
  /** Narration playback rate (1 = as rendered). */
  rate: number;
  mode: StudyMode;
  listenAt: Partial<Record<ElementId, string>>;
  progress: ProgressMap;
  /** Consecutive correct answers this session. */
  streak: number;
  bestStreak: number;
  answered: number;
  correct: number;
  /** Non-null while a practice exam is in progress or being reviewed. */
  session: ExamSession | null;
  /** Study feed: restrict to questions previously answered wrong. */
  missedOnly: boolean;

  loadPool: (id: ElementId) => Promise<void>;
  setSubFilter: (sub: string | null) => void;
  setIndex: (i: number) => void;
  answer: (id: string, choice: number) => void;
  toggleAudio: () => void;
  setRate: (rate: number) => void;
  setMode: (mode: StudyMode) => void;
  setListenAt: (pool: ElementId, id: string) => void;
  /** Listen mode: "knew it" / "review" feeds the same Leitner boxes as answering. */
  selfGrade: (id: string, knew: boolean) => void;
  resetProgress: () => void;
  setMissedOnly: (v: boolean) => void;
  startExam: () => void;
  answerExam: (id: string, choice: number) => void;
  finishExam: () => void;
  exitExam: () => void;
}

const LOADERS: Record<ElementId, () => Promise<{ default: PoolQuestion[] }>> = {
  technician: () => import('./pools/technician.gen'),
  general: () => import('./pools/general.gen'),
  extra: () => import('./pools/extra.gen'),
};

export const useExam = create<ExamState>((set, get) => {
  const saved = load();
  const prefs = loadPrefs();
  const savePrefsFrom = () => {
    const { audio, rate, mode, listenAt } = get();
    savePrefs({ audio, rate, mode, listenAt });
  };

  const rebuild = (
    questions: PoolQuestion[],
    sub: string | null,
    progress: ProgressMap,
    missedOnly = false,
  ) => {
    let pool = sub ? questions.filter((q) => subelementOf(q.id) === sub) : questions;
    if (missedOnly) pool = pool.filter((q) => (progress[q.id]?.wrong ?? 0) > 0);
    return buildQueue(pool, progress);
  };

  return {
    pool: saved.pool,
    questions: [],
    byId: {},
    loading: false,
    queue: [],
    index: 0,
    chosenById: {},
    subFilter: null,
    audio: prefs.audio,
    rate: prefs.rate,
    mode: prefs.mode,
    listenAt: prefs.listenAt,
    progress: saved.progress,
    streak: 0,
    bestStreak: 0,
    answered: 0,
    correct: 0,
    session: null,
    missedOnly: false,

    async loadPool(id) {
      // Deliberately not gated on `loading`: bailing there dropped a second
      // click entirely. Concurrent calls are allowed and resolved latest-wins.
      set({ loading: true, pool: id, chosenById: {}, index: 0, subFilter: null, session: null, missedOnly: false });
      const mod = await LOADERS[id]();
      // A newer selection landed while this chunk was in flight — it owns the
      // store now, including clearing `loading`. Drop this result.
      if (get().pool !== id) return;
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
      set({ subFilter: sub, queue: rebuild(questions, sub, progress, get().missedOnly), index: 0, chosenById: {} });
    },

    setIndex(i) {
      if (get().index !== i) set({ index: i });
    },

    answer(id, choice) {
      const st = get();
      if (st.chosenById[id] !== undefined) return; // already graded this card
      const q = st.byId[id];
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
        chosenById: { ...st.chosenById, [id]: choice },
        progress,
        streak,
        bestStreak: Math.max(st.bestStreak, streak),
        answered: st.answered + 1,
        correct: st.correct + (right ? 1 : 0),
      });
      persist({ progress, pool: st.pool });
    },

    selfGrade(id, knew) {
      const st = get();
      const prev = st.progress[id];
      // Self-report is weaker evidence than picking from four choices, so a
      // "knew it" climbs one box but never past 3 on its own; only a real
      // answer can certify mastery-plus. A "review" sends it back to box 0.
      const box = knew ? Math.min(3, (prev?.box ?? 0) + 1) : 0;
      const progress: ProgressMap = {
        ...st.progress,
        [id]: {
          box: Math.max(box, knew ? prev?.box ?? 0 : 0),
          seen: (prev?.seen ?? 0) + 1,
          wrong: (prev?.wrong ?? 0) + (knew ? 0 : 1),
          at: Date.now(),
        },
      };
      set({ progress });
      persist({ progress, pool: st.pool });
    },

    setMissedOnly(v) {
      const st = get();
      set({
        missedOnly: v,
        queue: rebuild(st.questions, st.subFilter, st.progress, v),
        index: 0,
        chosenById: {},
      });
    },

    startExam() {
      const st = get();
      if (!st.questions.length) return;
      set({
        session: {
          ids: drawExam(st.questions, poolMeta(st.pool).examQuestions),
          answers: {},
          startedAt: Date.now(),
          finishedAt: null,
        },
      });
    },

    answerExam(id, choice) {
      const st = get();
      const s0 = st.session;
      // Locked once submitted: review must show what you actually answered.
      if (!s0 || s0.finishedAt !== null) return;
      set({ session: { ...s0, answers: { ...s0.answers, [id]: choice } } });
    },

    finishExam() {
      const st = get();
      const s0 = st.session;
      if (!s0 || s0.finishedAt !== null) return;
      // Fold the exam into spaced repetition in one pass, so a missed exam
      // question resurfaces in the study feed straight away.
      const progress: ProgressMap = { ...st.progress };
      const now = Date.now();
      for (const id of s0.ids) {
        const q = st.byId[id];
        if (!q) continue;
        const chosen = s0.answers[id];
        const right = chosen === q.c;
        const prev = progress[id];
        progress[id] = {
          box: right ? Math.min(4, (prev?.box ?? 0) + 1) : 0,
          seen: (prev?.seen ?? 0) + 1,
          wrong: (prev?.wrong ?? 0) + (right ? 0 : 1),
          at: now,
        };
      }
      set({
        session: { ...s0, finishedAt: now },
        progress,
        queue: rebuild(st.questions, st.subFilter, progress, st.missedOnly),
      });
      persist({ progress, pool: st.pool });
    },

    exitExam() {
      set({ session: null });
    },

    toggleAudio() {
      set((s) => ({ audio: !s.audio }));
      savePrefsFrom();
    },

    setRate(rate) {
      set({ rate });
      savePrefsFrom();
    },

    setMode(mode) {
      set({ mode });
      savePrefsFrom();
    },

    setListenAt(pool, id) {
      set((s) => ({ listenAt: { ...s.listenAt, [pool]: id } }));
      savePrefsFrom();
    },

    resetProgress() {
      const st = get();
      const progress: ProgressMap = {};
      set({
        progress,
        queue: rebuild(st.questions, st.subFilter, progress, st.missedOnly),
        session: null,
        index: 0,
        chosenById: {},
        streak: 0,
        bestStreak: 0,
        answered: 0,
        correct: 0,
      });
      persist({ progress, pool: st.pool });
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

/** Score a session against the pool's real pass mark. */
export function examScore(
  session: ExamSession,
  byId: Record<string, PoolQuestion>,
  pool: ElementId,
) {
  const meta = poolMeta(pool);
  let correct = 0;
  for (const id of session.ids) {
    const q = byId[id];
    if (q && session.answers[id] === q.c) correct++;
  }
  const total = session.ids.length;
  return {
    correct,
    total,
    passing: meta.passing,
    passed: correct >= meta.passing,
    pct: total ? Math.round((correct / total) * 100) : 0,
    answered: Object.keys(session.answers).length,
    elapsedMs: (session.finishedAt ?? Date.now()) - session.startedAt,
  };
}

/** Per-subelement readiness, weakest first — where the remaining study time goes. */
export function subelementReadiness(questions: PoolQuestion[], progress: ProgressMap) {
  const rows = new Map<string, { sub: string; total: number; mastered: number; wrong: number }>();
  for (const q of questions) {
    const sub = subelementOf(q.id);
    const row = rows.get(sub) ?? { sub, total: 0, mastered: 0, wrong: 0 };
    row.total++;
    const pr = progress[q.id];
    if (pr) {
      if (pr.box >= 3) row.mastered++;
      if (pr.wrong > 0) row.wrong++;
    }
    rows.set(sub, row);
  }
  return [...rows.values()]
    .map((r) => ({ ...r, pct: r.total ? Math.round((r.mastered / r.total) * 100) : 0 }))
    .sort((a, b) => a.pct - b.pct || a.sub.localeCompare(b.sub));
}
