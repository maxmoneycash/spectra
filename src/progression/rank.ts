/**
 * The one rank ladder, the "next up" resolver, and the activity log — all
 * pure. `progression.ts` feeds these from the live stores; tests feed them
 * directly. Nothing here imports a store, so the CTF store and the Operator
 * Card can both depend on it without a cycle.
 *
 * Why one ladder: the Operator Card used to rank by signals identified and
 * the CTF by points share, so one person could hold two ranks.
 */
import type { ElementId } from '../exam/types';

export type Rank = 'Unlicensed' | 'Listener' | 'Operator' | 'Analyst' | 'Signals Officer';

/** Lowest to highest. */
export const RANK_ORDER: readonly Rank[] = [
  'Unlicensed',
  'Listener',
  'Operator',
  'Analyst',
  'Signals Officer',
];

export interface RankInputs {
  lessonsDone: number;
  lessonsTotal: number;
  points: number;
  totalPoints: number;
  /** Any pool's practice exam passed at least once. */
  passedPractice: boolean;
}

export function rankOf(i: RankInputs): Rank {
  const allLessons = i.lessonsTotal > 0 && i.lessonsDone >= i.lessonsTotal;
  const share = i.totalPoints > 0 ? i.points / i.totalPoints : 0;
  if (allLessons && share >= 1 && i.passedPractice) return 'Signals Officer';
  if (allLessons && share >= 0.6) return 'Analyst';
  if (allLessons || share >= 0.4) return 'Operator';
  if (i.lessonsDone >= 1 || i.points > 0) return 'Listener';
  return 'Unlicensed';
}

export type NextUp =
  | { kind: 'lesson'; id: string }
  | { kind: 'mission'; id: string }
  | { kind: 'exam'; pool: ElementId }
  | { kind: 'clear' };

export interface NextInputs {
  /** In course order; each lesson names the mission that tests it. */
  lessons: { id: string; challengeId: string }[];
  lessonsDone: string[];
  /** All missions, in Tasking order. */
  challenges: { id: string; points: number }[];
  solved: string[];
  /** Pools in order; `predicted` is null until that pool has any progress. */
  exams: { pool: ElementId; predicted: number | null; passing: number; passedPractice: boolean }[];
}

/**
 * What to do next. Lesson, then the mission that tests it, then the next
 * lesson — so a skill is tested while it's fresh. Missions with no lesson
 * come after the course, cheapest first. Then the first pool not yet passed.
 */
export function nextUp(i: NextInputs): NextUp {
  const done = new Set(i.lessonsDone);
  const solved = new Set(i.solved);
  for (const l of i.lessons) {
    if (!done.has(l.id)) return { kind: 'lesson', id: l.id };
    if (!solved.has(l.challengeId)) return { kind: 'mission', id: l.challengeId };
  }
  const lessonMissions = new Set(i.lessons.map((l) => l.challengeId));
  const rest = i.challenges
    .filter((c) => !lessonMissions.has(c.id) && !solved.has(c.id))
    .sort((a, b) => a.points - b.points);
  if (rest.length) return { kind: 'mission', id: rest[0].id };
  for (const e of i.exams) {
    if (!e.passedPractice) return { kind: 'exam', pool: e.pool };
  }
  return { kind: 'clear' };
}

export type LogKind = 'lesson' | 'flag' | 'exam' | 'identified';

export interface LogEntry {
  at: number;
  kind: LogKind;
  /** Short upper-case tag for the mono column, e.g. "FLAG CAPTURED  +300". */
  tag: string;
  /** What it was, in lower case: the lesson, mission, pool, or signal. */
  detail: string;
}

export interface LogInputs {
  lessonsAt: Record<string, number>;
  lessonTitle: (id: string) => string | undefined;
  solves: { id: string; at: number; points: number }[];
  missionName: (id: string) => string | undefined;
  exams: { pool: ElementId; correct: number; total: number; passed: boolean; at: number }[];
  identifiedAt: Record<string, number>;
  signalLabel: (kind: string) => string | undefined;
}

/** Everything that happened, newest first. */
export function activityLog(i: LogInputs): LogEntry[] {
  const out: LogEntry[] = [];
  for (const [id, at] of Object.entries(i.lessonsAt)) {
    out.push({ at, kind: 'lesson', tag: 'TASKING CONFIRMED', detail: i.lessonTitle(id) ?? id });
  }
  for (const s of i.solves) {
    out.push({ at: s.at, kind: 'flag', tag: `FLAG CAPTURED  +${s.points}`, detail: i.missionName(s.id) ?? s.id });
  }
  for (const e of i.exams) {
    out.push({
      at: e.at,
      kind: 'exam',
      tag: `EXAM SAT  ${e.correct}/${e.total}`,
      detail: `${e.pool} · ${e.passed ? 'pass' : 'below passing'}`,
    });
  }
  for (const [kind, at] of Object.entries(i.identifiedAt)) {
    out.push({ at, kind: 'identified', tag: 'EMITTER IDENTIFIED', detail: i.signalLabel(kind) ?? kind });
  }
  return out.sort((a, b) => b.at - a.at);
}
