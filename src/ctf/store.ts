import { create } from 'zustand';
import { CHALLENGES, TOTAL_POINTS, challengeById } from './challenges';

const STORAGE_KEY = 'spectra.ctf.v1';
const SALT = 'spectra-ctf-v1|';
/** Each hint taken costs this share of the challenge's points. */
const HINT_COST = 0.15;

export interface Solve {
  at: number;
  /** Points actually banked, after any hint penalty. */
  points: number;
  hintsUsed: number;
}

interface Persisted {
  solved: Record<string, Solve>;
  hints: Record<string, number>;
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Persisted;
      if (p && typeof p === 'object') return { solved: p.solved ?? {}, hints: p.hints ?? {} };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return { solved: {}, hints: {} };
}

function persist(p: Persisted): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* progress is a nicety, not a requirement */
  }
}

/**
 * Answers are compared loosely so nobody loses a flag to formatting. Spaces and
 * underscores both collapse, because a flag keyed in Morse reads as
 * `LISTEN UP` but people habitually type `listen_up`.
 */
export function normalise(answer: string): string {
  return answer.trim().toLowerCase().replace(/[\s_]+/g, '');
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function checkFlag(challengeId: string, answer: string): Promise<boolean> {
  const c = challengeById(challengeId);
  if (!c) return false;
  const hex = await sha256Hex(SALT + normalise(answer));
  return hex.slice(0, 32) === c.flagHash;
}

export interface CtfState {
  solved: Record<string, Solve>;
  hints: Record<string, number>;
  activeId: string | null;
  /** Transient feedback for the submit box. */
  verdict: { id: string; ok: boolean; msg: string } | null;
  checking: boolean;

  setActive: (id: string | null) => void;
  submit: (id: string, answer: string) => Promise<boolean>;
  takeHint: (id: string) => void;
  clearVerdict: () => void;
  reset: () => void;
}

export const useCtf = create<CtfState>((set, get) => {
  const saved = load();
  return {
    solved: saved.solved,
    hints: saved.hints,
    activeId: null,
    verdict: null,
    checking: false,

    setActive: (id) => set({ activeId: id, verdict: null }),

    async submit(id, answer) {
      if (!answer.trim() || get().checking) return false;
      set({ checking: true });
      let ok = false;
      try {
        ok = await checkFlag(id, answer);
      } catch {
        // crypto.subtle is undefined outside a secure context. Surface it
        // rather than leaving Submit disabled for the rest of the session.
        set({
          checking: false,
          verdict: { id, ok: false, msg: 'Could not check the flag here — needs https or localhost.' },
        });
        return false;
      }
      const st = get();
      if (!ok) {
        set({ checking: false, verdict: { id, ok: false, msg: 'Not it — try again.' } });
        return false;
      }
      const c = challengeById(id)!;
      const hintsUsed = st.hints[id] ?? 0;
      const points = Math.max(
        Math.round(c.points * 0.4),
        Math.round(c.points * (1 - hintsUsed * HINT_COST)),
      );
      const solved = { ...st.solved, [id]: { at: Date.now(), points, hintsUsed } };
      set({
        solved,
        checking: false,
        verdict: { id, ok: true, msg: `Solved — +${points} pts` },
      });
      persist({ solved, hints: st.hints });
      return true;
    },

    takeHint(id) {
      const st = get();
      const c = challengeById(id);
      if (!c) return;
      const used = st.hints[id] ?? 0;
      if (used >= c.hints.length) return;
      const hints = { ...st.hints, [id]: used + 1 };
      set({ hints });
      persist({ solved: st.solved, hints });
    },

    clearVerdict: () => set({ verdict: null }),

    reset() {
      const empty = { solved: {}, hints: {} };
      set({ ...empty, verdict: null, activeId: null });
      persist(empty);
    },
  };
});

export function score(solved: Record<string, Solve>) {
  const entries = Object.values(solved);
  const points = entries.reduce((s, e) => s + e.points, 0);
  return {
    points,
    solvedCount: entries.length,
    total: CHALLENGES.length,
    totalPoints: TOTAL_POINTS,
    pct: TOTAL_POINTS ? Math.round((points / TOTAL_POINTS) * 100) : 0,
  };
}

/**
 * A spoiler-free result you can paste anywhere — the Wordle shape. It shows
 * which challenges fell and how hard they were, and never the answers.
 * Category order is stable so two people's grids are comparable.
 */
export function shareText(solved: Record<string, Solve>, origin?: string): string {
  const s = score(solved);
  const grid = CHALLENGES.map((c) => {
    const hit = solved[c.id];
    if (!hit) return '⬜';
    // Clean solves read differently from hinted ones.
    return hit.hintsUsed === 0 ? '🟩' : '🟨';
  });
  const rows: string[] = [];
  for (let i = 0; i < grid.length; i += 5) rows.push(grid.slice(i, i + 5).join(''));

  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return [
    `SPECTRA RF CTF — ${s.points}/${s.totalPoints}`,
    ...rows,
    `${rankFor(s.points)} · ${s.solvedCount}/${s.total} flags`,
    `${base}/?view=ctf`,
  ].join('\n');
}

/** Operator rank, for the share card and a bit of pull up the ladder. */
export function rankFor(points: number): string {
  const pct = TOTAL_POINTS ? points / TOTAL_POINTS : 0;
  if (pct >= 1) return 'Signals Officer';
  if (pct >= 0.75) return 'Spectrum Analyst';
  if (pct >= 0.5) return 'Operator';
  if (pct >= 0.25) return 'Apprentice';
  if (points > 0) return 'Listener';
  return 'Unlicensed';
}
