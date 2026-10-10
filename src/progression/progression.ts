/**
 * One progression, derived from the four stores (guide, CTF, operator, exam)
 * every time any of them changes. Nothing is migrated: this reads what each
 * store already persists and adds nothing new of its own.
 */
import { useMemo } from 'react';
import { useStore } from '../store/store';
import { useCtf, score, type Solve } from '../ctf/store';
import { useGuide } from '../guide/store';
import { useExam, type ExamResult, type Progress } from '../exam/store';
import { LESSONS } from '../guide/lessons';
import { CHALLENGES, TOTAL_POINTS, challengeById } from '../ctf/challenges';
import { POOLS, type ElementId } from '../exam/types';
import POOL_IDS from '../exam/pools/index.gen';
import { predictScore, type Prediction } from '../exam/predict';
import { KIND_INFO, type SignalKind } from '../sim/signal-kinds';
import { activityLog, nextUp, rankOf, type LogEntry, type NextUp, type Rank } from './rank';

export interface ExamStanding extends Prediction {
  pool: ElementId;
  name: string;
  /** Questions in this pool answered at least once. */
  touched: number;
  passedPractice: boolean;
  best: ExamResult | null;
}

export interface Progression {
  lessons: { done: string[]; total: number };
  flags: { solved: string[]; points: number; totalPoints: number };
  identified: string[];
  exams: ExamStanding[];
  /** The pool to show on the board: the one with the most progress, General until any has some. */
  featured: ExamStanding;
  rank: Rank;
  next: NextUp;
  /** Newest first. */
  log: LogEntry[];
}

interface Inputs {
  completed: string[];
  completedAt: Record<string, number>;
  solved: Record<string, Solve>;
  identified: string[];
  identifiedAt: Record<string, number>;
  progress: Record<string, Progress>;
  results: ExamResult[];
}

function build(i: Inputs): Progression {
  const sc = score(i.solved);
  const exams: ExamStanding[] = POOLS.map((meta) => {
    const ids = POOL_IDS[meta.id];
    const mine = i.results.filter((r) => r.pool === meta.id);
    return {
      ...predictScore(ids, i.progress, meta),
      pool: meta.id,
      name: meta.name,
      touched: ids.reduce((n, id) => n + (i.progress[id]?.seen ? 1 : 0), 0),
      passedPractice: mine.some((r) => r.passed),
      best: mine.reduce<ExamResult | null>((b, r) => (!b || r.correct > b.correct ? r : b), null),
    };
  });
  const general = exams.find((e) => e.pool === 'general') ?? exams[0];
  const featured = exams.reduce((a, b) => (b.touched > a.touched ? b : a), general);

  const rank = rankOf({
    lessonsDone: i.completed.length,
    lessonsTotal: LESSONS.length,
    points: sc.points,
    totalPoints: TOTAL_POINTS,
    passedPractice: exams.some((e) => e.passedPractice),
  });

  // The featured pool is the one to sit first once the missions are done.
  const examOrder = [featured, ...exams.filter((e) => e !== featured)];
  const next = nextUp({
    lessons: LESSONS.map((l) => ({ id: l.id, challengeId: l.challengeId })),
    lessonsDone: i.completed,
    challenges: CHALLENGES.map((c) => ({ id: c.id, points: c.points })),
    solved: Object.keys(i.solved),
    exams: examOrder.map((e) => ({
      pool: e.pool,
      predicted: e.touched ? e.predicted : null,
      passing: e.passing,
      passedPractice: e.passedPractice,
    })),
  });

  const log = activityLog({
    lessonsAt: i.completedAt,
    lessonTitle: (id) => LESSONS.find((l) => l.id === id)?.title,
    solves: Object.entries(i.solved).map(([id, s]) => ({ id, at: s.at, points: s.points })),
    missionName: (id) => challengeById(id)?.name,
    exams: i.results,
    identifiedAt: i.identifiedAt,
    signalLabel: (k) => KIND_INFO[k as SignalKind]?.label,
  });

  return {
    lessons: { done: i.completed, total: LESSONS.length },
    flags: { solved: Object.keys(i.solved), points: sc.points, totalPoints: TOTAL_POINTS },
    identified: i.identified,
    exams,
    featured,
    rank,
    next,
    log,
  };
}

/** Imperative read, for code outside React. */
export function progression(): Progression {
  const g = useGuide.getState();
  const c = useCtf.getState();
  const op = useStore.getState().operator;
  const e = useExam.getState();
  return build({
    completed: g.completed,
    completedAt: g.completedAt,
    solved: c.solved,
    identified: op.identified,
    identifiedAt: op.identifiedAt,
    progress: e.progress,
    results: e.results,
  });
}

/**
 * Reactive read. Selects only the slow-changing slices, so the 70 Hz
 * detection traffic in the main store never re-renders a Station panel.
 */
export function useProgression(): Progression {
  const completed = useGuide((s) => s.completed);
  const completedAt = useGuide((s) => s.completedAt);
  const solved = useCtf((s) => s.solved);
  const operator = useStore((s) => s.operator);
  const progress = useExam((s) => s.progress);
  const results = useExam((s) => s.results);
  return useMemo(
    () =>
      build({
        completed,
        completedAt,
        solved,
        identified: operator.identified,
        identifiedAt: operator.identifiedAt,
        progress,
        results,
      }),
    [completed, completedAt, solved, operator, progress, results],
  );
}
