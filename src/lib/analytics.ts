/**
 * Usage counting, kept deliberately small. Vercel Web Analytics is
 * cookieless and keeps no identifiers; this wrapper adds three more limits:
 * a fixed list of event names, scalar properties only (never free text, never
 * a flag answer, never a file name), and silence when Do Not Track is set or
 * the app is running in development.
 */
import { track } from '@vercel/analytics';

export type AppEvent =
  | { name: 'lesson_done'; id: string }
  | { name: 'flag'; id: string; hints: number }
  | { name: 'exam_finished'; pool: string; correct: number; total: number; passed: boolean }
  | { name: 'capture_loaded'; rate: number; datatype: string; seconds: number };

function dnt(): boolean {
  if (typeof navigator === 'undefined') return false;
  const n = navigator as Navigator & { doNotTrack?: string; globalPrivacyControl?: boolean };
  return n.doNotTrack === '1' || n.globalPrivacyControl === true;
}

export function event(e: AppEvent): void {
  if (import.meta.env.DEV || dnt()) return;
  const { name, ...props } = e;
  try {
    track(name, props);
  } catch {
    /* analytics must never break the app */
  }
}
