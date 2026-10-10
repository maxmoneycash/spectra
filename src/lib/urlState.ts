import type { AppView } from '../store/store';

/**
 * Shareable URL state.
 *
 * Nothing in the app was linkable, so every mention of it elsewhere had to say
 * "open the site and click around". These params make a challenge, a band or a
 * question pool a link you can paste into a comment.
 *
 * Reads are defensive — an unknown or malformed param falls back to the default
 * rather than white-screening someone arriving from a stale link.
 */
export interface UrlState {
  view?: AppView;
  /** CTF challenge id */
  c?: string;
  /** Exam pool id */
  pool?: string;
  /** Exam subelement filter, e.g. T1 */
  topic?: string;
  /** Console scenario id */
  scenario?: string;
}

const VIEWS: AppView[] = ['station', 'console', 'academy', 'exam', 'ctf'];
/** Ids are short slugs; anything else is treated as absent. */
const SLUG = /^[a-z0-9-]{1,40}$/i;

const clean = (v: string | null): string | undefined =>
  v && SLUG.test(v) ? v : undefined;

export function readUrl(search = window.location.search): UrlState {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return {};
  }
  const view = params.get('view');
  return {
    view: view && (VIEWS as string[]).includes(view) ? (view as AppView) : undefined,
    c: clean(params.get('c')),
    pool: clean(params.get('pool')),
    topic: clean(params.get('topic')),
    scenario: clean(params.get('scenario')),
  };
}

/**
 * Merge into the address bar without adding history entries — navigating the
 * app shouldn't fill the back button with dozens of steps.
 */
export function writeUrl(next: UrlState): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);

  const set = (key: keyof UrlState, value: string | undefined) => {
    if (value) params.set(key, value);
    else params.delete(key);
  };
  set('view', next.view);
  set('c', next.c);
  set('pool', next.pool);
  set('topic', next.topic);
  set('scenario', next.scenario);

  const qs = params.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
  if (url !== `${window.location.pathname}${window.location.search}`) {
    window.history.replaceState(null, '', url);
  }
}

/** An absolute link to a given state, for share buttons. */
export function shareUrl(state: UrlState): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(state)) if (v) params.set(k, String(v));
  const qs = params.toString();
  return `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ''}`;
}
