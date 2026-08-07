/**
 * Question narration with a two-tier source.
 *
 * If `scripts/render-narration.mjs` has produced audio for a pool, we play the
 * rendered file (consistent voice, no per-device variation, works offline once
 * cached). Otherwise we fall back to the browser's live speech synthesis, so
 * narration works with no build step at all.
 */
import type { ElementId, PoolQuestion } from './types';
import { speakQuestion, cancelSpeech } from './speech';

interface Manifest {
  engine?: string;
  voice?: string;
  items: Record<string, { hash: string; bytes: number }>;
}

/** pool -> set of question ids that have rendered audio (empty when none). */
const manifests = new Map<ElementId, Promise<Set<string>>>();

function loadManifest(pool: ElementId): Promise<Set<string>> {
  let p = manifests.get(pool);
  if (!p) {
    p = fetch(`/exam/audio/${pool}/manifest.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : null))
      .then((m) => new Set(m ? Object.keys(m.items ?? {}) : []))
      .catch(() => new Set<string>());
    manifests.set(pool, p);
  }
  return p;
}

let current: HTMLAudioElement | null = null;

export function stopNarration(): void {
  cancelSpeech();
  if (current) {
    current.pause();
    current.src = '';
    current = null;
  }
}

/**
 * Narrate one question. Resolves once playback has started (or synthesis has
 * been queued) — not when it finishes.
 */
export async function narrate(pool: ElementId, q: PoolQuestion): Promise<void> {
  stopNarration();
  const rendered = await loadManifest(pool);

  if (rendered.has(q.id)) {
    const audio = new Audio(`/exam/audio/${pool}/${q.id}.m4a`);
    current = audio;
    try {
      await audio.play();
      return;
    } catch {
      // Autoplay blocked or file unreadable — fall through to live synthesis.
      current = null;
    }
  }

  speakQuestion(q.q, q.a, { withAnswers: true });
}

/** True when a pool has pre-rendered audio available. */
export async function hasRenderedAudio(pool: ElementId): Promise<boolean> {
  return (await loadManifest(pool)).size > 0;
}
