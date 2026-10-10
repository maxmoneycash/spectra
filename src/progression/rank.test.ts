import { describe, expect, it } from 'vitest';
import { activityLog, nextUp, rankOf, RANK_ORDER, type RankInputs } from './rank';

const base: RankInputs = {
  lessonsDone: 0,
  lessonsTotal: 9,
  points: 0,
  totalPoints: 3650,
  passedPractice: false,
};

describe('rankOf — one ladder', () => {
  it('starts unlicensed', () => {
    expect(rankOf(base)).toBe('Unlicensed');
  });

  it('a first lesson or a first flag makes a Listener', () => {
    expect(rankOf({ ...base, lessonsDone: 1 })).toBe('Listener');
    expect(rankOf({ ...base, points: 100 })).toBe('Listener');
  });

  it('Operator by finishing the course OR by 40% of the points', () => {
    expect(rankOf({ ...base, lessonsDone: 9 })).toBe('Operator');
    expect(rankOf({ ...base, points: 1460 })).toBe('Operator');
    expect(rankOf({ ...base, points: 1459 })).toBe('Listener');
  });

  it('Analyst needs the whole course and 60% of the points', () => {
    expect(rankOf({ ...base, lessonsDone: 9, points: 2190 })).toBe('Analyst');
    expect(rankOf({ ...base, lessonsDone: 8, points: 3650 })).toBe('Operator');
  });

  it('Signals Officer needs everything, including a passed practice exam', () => {
    const full = { ...base, lessonsDone: 9, points: 3650 };
    expect(rankOf(full)).toBe('Analyst');
    expect(rankOf({ ...full, passedPractice: true })).toBe('Signals Officer');
  });

  it('is monotone along the ladder', () => {
    const steps: RankInputs[] = [
      base,
      { ...base, lessonsDone: 1 },
      { ...base, lessonsDone: 9 },
      { ...base, lessonsDone: 9, points: 2190 },
      { ...base, lessonsDone: 9, points: 3650, passedPractice: true },
    ];
    const idx = steps.map((s) => RANK_ORDER.indexOf(rankOf(s)));
    for (let k = 1; k < idx.length; k++) expect(idx[k]).toBeGreaterThan(idx[k - 1]);
  });
});

describe('nextUp — lesson, its mission, next lesson', () => {
  const lessons = [
    { id: 'tune', challengeId: 'first-light' },
    { id: 'modes', challengeId: 'carrier-hunt' },
  ];
  const challenges = [
    { id: 'first-light', points: 100 },
    { id: 'carrier-hunt', points: 150 },
    { id: 'deep-cut', points: 350 },
    { id: 'morse-beacon', points: 200 },
  ];
  const exams = [
    { pool: 'technician' as const, predicted: null, passing: 26, passedPractice: false },
    { pool: 'general' as const, predicted: null, passing: 26, passedPractice: false },
  ];

  it('new operator: the first lesson', () => {
    expect(nextUp({ lessons, lessonsDone: [], challenges, solved: [], exams })).toEqual({ kind: 'lesson', id: 'tune' });
  });

  it('after a lesson: the mission that tests it, before the next lesson', () => {
    expect(nextUp({ lessons, lessonsDone: ['tune'], challenges, solved: [], exams })).toEqual({
      kind: 'mission',
      id: 'first-light',
    });
    expect(nextUp({ lessons, lessonsDone: ['tune'], challenges, solved: ['first-light'], exams })).toEqual({
      kind: 'lesson',
      id: 'modes',
    });
  });

  it('after the course: lesson-less missions, cheapest first', () => {
    const r = nextUp({
      lessons,
      lessonsDone: ['tune', 'modes'],
      challenges,
      solved: ['first-light', 'carrier-hunt'],
      exams,
    });
    expect(r).toEqual({ kind: 'mission', id: 'morse-beacon' });
  });

  it('after all missions: the first pool not yet passed, then clear', () => {
    const allSolved = challenges.map((c) => c.id);
    expect(nextUp({ lessons, lessonsDone: ['tune', 'modes'], challenges, solved: allSolved, exams })).toEqual({
      kind: 'exam',
      pool: 'technician',
    });
    const passed = exams.map((e) => ({ ...e, passedPractice: true }));
    expect(nextUp({ lessons, lessonsDone: ['tune', 'modes'], challenges, solved: allSolved, exams: passed })).toEqual({
      kind: 'clear',
    });
  });
});

describe('activityLog', () => {
  it('merges all four sources, newest first, with readable tags', () => {
    const log = activityLog({
      lessonsAt: { tune: 1000 },
      lessonTitle: (id) => ({ tune: 'Tune and listen' })[id],
      solves: [{ id: 'first-light', at: 3000, points: 100 }],
      missionName: (id) => ({ 'first-light': 'First light' })[id],
      exams: [{ pool: 'general', correct: 24, total: 35, passed: false, at: 2000 }],
      identifiedAt: { lora: 4000 },
      signalLabel: (k) => ({ lora: 'LoRa (CSS)' })[k],
    });
    expect(log.map((e) => e.kind)).toEqual(['identified', 'flag', 'exam', 'lesson']);
    expect(log[1].tag).toBe('FLAG CAPTURED  +100');
    expect(log[2].tag).toBe('EXAM SAT  24/35');
    expect(log[2].detail).toBe('general · below passing');
    expect(log[3].detail).toBe('Tune and listen');
  });
});
