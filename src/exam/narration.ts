/**
 * Exam narration.
 *
 * Rendered pools ship two clips per question (`scripts/kokoro_render.py`):
 * `<ID>.q.m4a` reads the question and `<ID>.a.m4a` reads the correct answer —
 * the "question, then answer" cram format. Manifest version 1 (one clip that
 * read the question and all four choices) is still understood so a pool that
 * hasn't been re-rendered keeps working, and anything with no clip at all
 * falls back to the browser's live speech synthesis.
 *
 * Playback goes through ONE persistent <audio> element. iOS only lets a page
 * start audio from a user gesture on a given element; once that element has
 * played, later programmatic plays are allowed. Reusing it is what lets the
 * feed advance and Listen mode run hands-free without "tap to hear" prompts.
 */
import { useEffect, useState } from 'react';
import type { ElementId } from './types';
import { cancelSpeech, speechSupported } from './speech';

interface ClipMeta {
  hash: string;
  bytes: number;
  dur?: number;
}
interface Manifest {
  version?: number;
  engine?: string;
  voice?: string;
  items: Record<string, ClipMeta | { q?: ClipMeta; a?: ClipMeta }>;
}

/** Where a question's audio lives. Durations are in seconds at 1x. */
export interface Clips {
  q?: string;
  a?: string;
  qDur?: number;
  aDur?: number;
  /** Version-1 clip: question plus all four choices, no separate answer. */
  legacy?: string;
}

export type ClipIndex = ReadonlyMap<string, Clips>;
const EMPTY: ClipIndex = new Map();

const indexes = new Map<ElementId, Promise<ClipIndex>>();

function loadIndex(pool: ElementId): Promise<ClipIndex> {
  let p = indexes.get(pool);
  if (!p) {
    const base = `/exam/audio/${pool}`;
    p = fetch(`${base}/manifest.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : null))
      .then((m) => {
        const out = new Map<string, Clips>();
        if (!m?.items) return out;
        for (const [id, e] of Object.entries(m.items)) {
          if (m.version === 2) {
            const v = e as { q?: ClipMeta; a?: ClipMeta };
            out.set(id, {
              q: v.q ? `${base}/${id}.q.m4a` : undefined,
              a: v.a ? `${base}/${id}.a.m4a` : undefined,
              qDur: v.q?.dur,
              aDur: v.a?.dur,
            });
          } else {
            out.set(id, { legacy: `${base}/${id}.m4a` });
          }
        }
        return out;
      })
      .catch(() => new Map<string, Clips>());
    indexes.set(pool, p);
  }
  return p;
}

/** Clip lookup for a pool; empty until its manifest resolves. */
export function useClips(pool: ElementId): ClipIndex {
  const [idx, setIdx] = useState<ClipIndex>(EMPTY);
  useEffect(() => {
    let alive = true;
    setIdx(EMPTY);
    void loadIndex(pool).then((m) => alive && setIdx(m));
    return () => {
      alive = false;
    };
  }, [pool]);
  return idx;
}

/* ------------------------------------------------------------- player */

export type PlayResult = 'ended' | 'stopped' | 'blocked' | 'error';

/** A one-sample silent WAV: playing it from a gesture unlocks the element. */
const SILENCE =
  'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA==';

class Narrator {
  private el: HTMLAudioElement | null = null;
  private token = 0;
  private settle: ((r: PlayResult) => void) | null = null;
  private unlocked = false;
  rate = 1;

  private audio(): HTMLAudioElement {
    if (!this.el) {
      this.el = new Audio();
      this.el.preload = 'auto';
      (this.el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
    }
    return this.el;
  }

  /** Call from a user gesture (tap) once; later plays need no gesture. */
  unlock(): void {
    if (this.unlocked || typeof window === 'undefined') return;
    // Never trade a clip that's already sounding for the silent primer.
    if (this.el && !this.el.paused) return;
    const el = this.audio();
    el.src = SILENCE;
    void el
      .play()
      .then(() => {
        this.unlocked = true;
      })
      .catch(() => undefined);
  }

  setRate(rate: number): void {
    this.rate = rate;
    if (this.el) this.el.playbackRate = rate;
  }

  /** Stop whatever is playing; any pending play() resolves 'stopped'. */
  stop(): void {
    this.token++;
    this.settle?.('stopped');
    this.settle = null;
    if (this.el) {
      this.el.pause();
      this.el.removeAttribute('src');
      this.el.load();
    }
    cancelSpeech();
  }

  /** Play one clip; resolves when it ends, fails, or is superseded. */
  play(url: string): Promise<PlayResult> {
    this.stop();
    const my = ++this.token;
    const el = this.audio();
    return new Promise<PlayResult>((resolve) => {
      const done = (r: PlayResult) => {
        if (this.settle === finish) this.settle = null;
        el.removeEventListener('ended', onEnd);
        el.removeEventListener('error', onErr);
        resolve(r);
      };
      const finish = (r: PlayResult) => done(r);
      const onEnd = () => my === this.token && done('ended');
      const onErr = () => my === this.token && done('error');
      this.settle = finish;
      el.addEventListener('ended', onEnd);
      el.addEventListener('error', onErr);
      el.src = url;
      el.playbackRate = this.rate;
      (el as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
      el.play().then(
        () => {
          this.unlocked = true;
        },
        (err: unknown) => {
          if (my !== this.token) return;
          done(err instanceof DOMException && err.name === 'NotAllowedError' ? 'blocked' : 'error');
        },
      );
    });
  }

  /** Live speech fallback with the same contract as play(). */
  speak(text: string): Promise<PlayResult> {
    this.stop();
    if (!speechSupported()) return Promise.resolve('error');
    const my = ++this.token;
    return new Promise<PlayResult>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = Math.min(2, 1.02 * this.rate);
      const voices = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('en'));
      const v = voices.find((x) => /samantha|natural|neural|google us/i.test(x.name)) ?? voices[0];
      if (v) u.voice = v;
      const finish = (r: PlayResult) => {
        if (this.settle === finish) this.settle = null;
        resolve(r);
      };
      this.settle = finish;
      u.onend = () => my === this.token && finish('ended');
      u.onerror = () => my === this.token && finish('error');
      window.speechSynthesis.speak(u);
    });
  }
}

export const narrator = new Narrator();

/** Read a question. Uses the rendered clip when there is one. */
export function playQuestion(clips: Clips | undefined, text: string): Promise<PlayResult> {
  if (clips?.q) return narrator.play(clips.q);
  if (clips?.legacy) return narrator.play(clips.legacy);
  return narrator.speak(text);
}

/** Read the correct answer. Legacy pools have no answer clip: speak it live. */
export function playAnswer(clips: Clips | undefined, text: string): Promise<PlayResult> {
  if (clips?.a) return narrator.play(clips.a);
  return narrator.speak(text);
}

export function stopNarration(): void {
  narrator.stop();
}

/** Resolves after `ms`, or early (false) if `signal` aborts. */
export function pause(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(false);
    const t = window.setTimeout(() => resolve(true), ms);
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(t);
        resolve(false);
      },
      { once: true },
    );
  });
}

export const SPEEDS = [0.85, 1, 1.15, 1.3, 1.5, 1.75] as const;
export type Speed = (typeof SPEEDS)[number];
