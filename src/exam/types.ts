/** One question from an FCC/NCVEC amateur radio exam pool. */
export interface PoolQuestion {
  /** Canonical NCVEC id, e.g. "T1A01" — encodes element, subelement, group. */
  id: string;
  /** Question text. */
  q: string;
  /** The four answer choices, in A–D order. */
  a: [string, string, string, string];
  /** Index of the correct answer within `a` (0 = A). */
  c: 0 | 1 | 2 | 3;
  /** FCC Part 97 references, e.g. "[97.1]". Empty when the pool cites none. */
  refs?: string;
  /** Figure filename served from /exam/figures/, when the question needs one. */
  fig?: string;
}

export type ElementId = 'technician' | 'general' | 'extra';

export interface PoolMeta {
  id: ElementId;
  /** Display name, e.g. "Technician". */
  name: string;
  /** FCC element number (2, 3, 4). */
  element: number;
  /** Single-letter question-id prefix: T, G, or E. */
  prefix: 'T' | 'G' | 'E';
  /** Validity window as published by NCVEC. */
  valid: string;
  /** Questions on the actual exam. */
  examQuestions: number;
  /** Correct answers needed to pass. */
  passing: number;
  blurb: string;
}

export const POOLS: PoolMeta[] = [
  {
    id: 'technician',
    name: 'Technician',
    element: 2,
    prefix: 'T',
    valid: 'Jul 1 2026 – Jun 30 2030',
    examQuestions: 35,
    passing: 26,
    blurb: 'Your entry licence. VHF/UHF privileges, plus a slice of HF.',
  },
  {
    id: 'general',
    name: 'General',
    element: 3,
    prefix: 'G',
    valid: 'Jul 1 2023 – Jun 30 2027',
    examQuestions: 35,
    passing: 26,
    blurb: 'Opens up most of the HF bands — the worldwide ticket.',
  },
  {
    id: 'extra',
    name: 'Extra',
    element: 4,
    prefix: 'E',
    valid: 'Jul 1 2024 – Jun 30 2028',
    examQuestions: 50,
    passing: 37,
    blurb: 'Every privilege the service offers. The deep end.',
  },
];

export const poolMeta = (id: ElementId): PoolMeta => POOLS.find((p) => p.id === id)!;

/** "T1A01" → "T1" (subelement). */
export const subelementOf = (id: string): string => id.slice(0, 2);
/** "T1A01" → "T1A" (question group). */
export const groupOf = (id: string): string => id.slice(0, 3);
