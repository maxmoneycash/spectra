import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Pause, Play, SkipBack, SkipForward, Check, RotateCcw, Headphones } from 'lucide-react';
import { useExam } from './store';
import { POOLS, subelementOf, type PoolQuestion } from './types';
import { subelementTitle } from './syllabus';
import { narrator, pause, playAnswer, playQuestion, SPEEDS, useClips, type Clips } from './narration';
import { Segmented } from '@/ui/kit/Segmented';
import { tick, ok as hapticOk } from '@/ui/kit/haptics';
import { cn } from '@/lib/utils';

/** Think time after the question, and the beat after the answer, at 1x. */
const THINK_MS = 1700;
const REST_MS = 750;

type Phase = 'idle' | 'q' | 'think' | 'a' | 'rest' | 'blocked';

/** Syllabus order: G1…G9 then G0 (safety comes last in every pool). */
function syllabusKey(id: string): string {
  const sub = id[1] === '0' ? 'Z' : id[1];
  return `${id[0]}${sub}${id.slice(2)}`;
}

function chaptersOf(order: PoolQuestion[]) {
  const out: { sub: string; start: number; count: number }[] = [];
  order.forEach((q, i) => {
    const sub = subelementOf(q.id);
    const last = out[out.length - 1];
    if (last && last.sub === sub) last.count++;
    else out.push({ sub, start: i, count: 1 });
  });
  return out;
}

/**
 * Hands-free cram: each question is read, a beat to think, then the answer is
 * revealed as it's spoken — the format of the best exam-cram videos, built on
 * the full pool and paced by you. Chapters follow the syllabus, so you can
 * listen to one subelement at a time; lock-screen controls work while the
 * phone is in a pocket.
 */
export function ListenMode() {
  const pool = useExam((s) => s.pool);
  const questions = useExam((s) => s.questions);
  const progress = useExam((s) => s.progress);
  const missedOnly = useExam((s) => s.missedOnly);
  const rate = useExam((s) => s.rate);
  const setRate = useExam((s) => s.setRate);
  const listenAt = useExam((s) => s.listenAt[pool]);
  const setListenAt = useExam((s) => s.setListenAt);
  const selfGrade = useExam((s) => s.selfGrade);
  const clips = useClips(pool);
  const reduce = useReducedMotion();

  const order = useMemo(() => {
    let qs = [...questions].sort((a, b) => syllabusKey(a.id).localeCompare(syllabusKey(b.id)));
    if (missedOnly) qs = qs.filter((q) => (progress[q.id]?.wrong ?? 0) > 0);
    return qs;
    // progress deliberately excluded: grading while listening must not
    // reshuffle the playlist under the listener's feet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, missedOnly]);
  const chapters = useMemo(() => chaptersOf(order), [order]);

  const [cur, setCur] = useState(() => Math.max(0, order.findIndex((q) => q.id === listenAt)));
  const [phase, setPhase] = useState<Phase>('idle');
  const [graded, setGraded] = useState<Record<string, boolean>>({});
  const run = useRef<AbortController | null>(null);
  const playing = phase !== 'idle' && phase !== 'blocked';

  // Re-anchor when the playlist itself changes (pool / missed-only).
  useEffect(() => {
    setCur(Math.max(0, order.findIndex((q) => q.id === useExam.getState().listenAt[pool])));
  }, [order, pool]);

  useEffect(() => {
    narrator.setRate(rate);
  }, [rate]);

  const stop = useCallback(() => {
    run.current?.abort();
    run.current = null;
    narrator.stop();
    setPhase('idle');
  }, []);

  const start = useCallback(
    (from: number) => {
      run.current?.abort();
      const ac = new AbortController();
      run.current = ac;
      const sig = ac.signal;
      void (async () => {
        for (let i = from; i < order.length; i++) {
          if (sig.aborted) return;
          const q = order[i];
          const c: Clips | undefined = clips.get(q.id);
          setCur(i);
          setListenAt(pool, q.id);
          setPhase('q');
          const rq = await playQuestion(c, q.q);
          if (sig.aborted) return;
          if (rq === 'blocked') {
            setPhase('blocked');
            return;
          }
          setPhase('think');
          if (!(await pause(THINK_MS / narrator.rate, sig))) return;
          setPhase('a');
          const ra = await playAnswer(c, q.a[q.c]);
          if (sig.aborted) return;
          if (ra === 'blocked') {
            setPhase('blocked');
            return;
          }
          setPhase('rest');
          if (!(await pause(REST_MS / narrator.rate, sig))) return;
        }
        setPhase('idle');
      })();
    },
    [order, clips, pool, setListenAt],
  );

  // Stop on unmount (switching modes or tabs).
  useEffect(() => () => stop(), [stop]);

  const go = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(order.length - 1, i));
      tick();
      if (playing) start(next);
      else {
        setCur(next);
        setPhase('idle');
        if (order[next]) setListenAt(pool, order[next].id);
      }
    },
    [order, playing, start, pool, setListenAt],
  );

  const toggle = useCallback(() => {
    narrator.unlock();
    if (playing) stop();
    else start(cur);
  }, [playing, stop, start, cur]);

  // Lock-screen / headphone controls.
  const q = order[cur];
  useEffect(() => {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!ms || !q) return;
    const name = POOLS.find((p) => p.id === pool)?.name ?? '';
    const sub = subelementOf(q.id);
    try {
      ms.metadata = new MediaMetadata({
        title: q.q.length > 90 ? `${q.q.slice(0, 87)}…` : q.q,
        artist: `${name} · ${sub} ${subelementTitle(sub)}`,
        album: 'SPECTRA exam cram',
        artwork: [{ src: '/og.png', sizes: '1200x630', type: 'image/png' }],
      });
      ms.playbackState = playing ? 'playing' : 'paused';
      ms.setActionHandler('play', () => start(cur));
      ms.setActionHandler('pause', () => stop());
      ms.setActionHandler('nexttrack', () => go(cur + 1));
      ms.setActionHandler('previoustrack', () => go(cur - 1));
    } catch {
      /* older browsers: no media session */
    }
  }, [q, pool, playing, cur, start, stop, go]);

  // Space toggles, arrows skip.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ' ') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(cur + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(cur - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, go, cur]);

  if (!q) {
    return (
      <div className="grid h-full place-items-center px-8 text-center text-[13px] text-muted-foreground">
        {missedOnly ? 'Nothing missed yet — switch off "only missed" to listen to the pool.' : 'Loading questions…'}
      </div>
    );
  }

  const sub = subelementOf(q.id);
  const chapterIdx = chapters.findIndex((c) => c.sub === sub);
  const revealed = phase === 'a' || phase === 'rest';
  const c = clips.get(q.id);
  const qDur = (c?.qDur ?? 6) / rate;
  const aDur = (c?.aDur ?? 3) / rate;
  const g = graded[q.id];

  return (
    <div className="flex h-full flex-col">
      {/* chapter heading */}
      <div className="shrink-0 px-5 pt-1 sm:px-8">
        <div className="mono-feats flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <Headphones className="size-3.5" />
          <span>
            Chapter {chapterIdx + 1}/{chapters.length}
          </span>
          <span className="text-foreground/80">· {sub}</span>
          <span className="ml-auto tabular-nums">
            {cur + 1}/{order.length}
          </span>
        </div>
        <p className="mt-1 truncate text-[15px] font-semibold tracking-tight text-foreground">{subelementTitle(sub)}</p>
      </div>

      {/* the card */}
      <div className="relative flex min-h-0 flex-1 flex-col justify-center px-5 sm:px-8">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={q.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -18, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="mx-auto w-full max-w-[34rem]"
          >
            <p className="mono-feats font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
              <span className="uppercase">{q.id}</span>
              {q.refs ? <span> · FCC {q.refs}</span> : null}
            </p>
            <p
              className={cn(
                'mt-2 text-balance text-[clamp(1.25rem,5.2vw,1.65rem)] font-[540] leading-[1.22] tracking-tight transition-colors duration-500 sm:text-[1.9rem]',
                revealed ? 'text-foreground/55' : 'text-foreground',
              )}
            >
              {q.q}
            </p>
            {q.fig && (
              <img
                src={`/exam/figures/${q.fig}`}
                alt={`Figure for question ${q.id}`}
                className="mt-3 max-h-32 w-auto rounded-lg border border-line bg-white p-2"
              />
            )}

            {/* clip progress: question, think, answer — known durations, so a
                CSS transition draws it with no polling */}
            <div className="mt-5 flex items-center gap-1.5" aria-hidden>
              <PhaseBar on={phase === 'q'} done={phase !== 'q' && phase !== 'idle' && phase !== 'blocked'} ms={qDur * 1000} />
              <PhaseBar on={phase === 'think'} done={revealed} ms={THINK_MS / rate} narrow />
              <PhaseBar on={phase === 'a'} done={phase === 'rest'} ms={aDur * 1000} accent />
            </div>

            <div className="mt-4 min-h-[5.5rem]">
              {phase === 'idle' && (
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                  Press play. Each question is read, you get a beat to think, then the answer is revealed as
                  it&rsquo;s spoken.
                </p>
              )}
              <AnimatePresence>
                {revealed && (
                  <motion.div
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  >
                    <p className="mono-feats font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
                      Answer {String.fromCharCode(65 + q.c)}
                    </p>
                    <p className="mt-1 text-balance text-[clamp(1.15rem,4.8vw,1.45rem)] font-semibold leading-snug tracking-tight text-foreground">
                      {q.a[q.c]}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* self-grade: optional, never blocks the flow */}
            <div className="mt-3 flex h-10 items-center gap-2">
              {revealed &&
                ([true, false] as const).map((knew) => (
                  <motion.button
                    key={String(knew)}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => {
                      selfGrade(q.id, knew);
                      setGraded((m) => ({ ...m, [q.id]: knew }));
                      if (knew) hapticOk();
                      else tick();
                    }}
                    className={cn(
                      'inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[12px] font-medium transition-colors active:scale-95',
                      g === knew
                        ? knew
                          ? 'border-emerald-500/50 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                          : 'border-amber-500/50 bg-amber-500/12 text-amber-700 dark:text-amber-300'
                        : 'border-line bg-card text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {knew ? <Check className="size-3.5" strokeWidth={2.5} /> : <RotateCcw className="size-3.5" />}
                    {knew ? 'Knew it' : 'Review'}
                  </motion.button>
                ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* chapter scrubber — the video's chapter list, as a control */}
      <div className="shrink-0 px-5 sm:px-8">
        <ChapterRail
          chapters={chapters}
          total={order.length}
          cur={cur}
          onJump={(i) => go(i)}
        />
      </div>

      {/* transport */}
      <div className="shrink-0 px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4 sm:px-8">
        <div className="flex items-center justify-center gap-5">
          <TransportButton label="Previous question" onClick={() => go(cur - 1)} disabled={cur === 0}>
            <SkipBack className="size-5" fill="currentColor" />
          </TransportButton>
          <button
            onClick={toggle}
            aria-label={playing ? 'Pause' : 'Play'}
            className="relative grid size-[68px] place-items-center rounded-full bg-foreground text-background shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] transition-transform active:scale-95"
          >
            {playing && !reduce && (
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full border-2 border-foreground"
                animate={{ scale: [1, 1.22], opacity: [0.45, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
            {playing ? <Pause className="size-7" fill="currentColor" /> : <Play className="ml-1 size-7" fill="currentColor" />}
          </button>
          <TransportButton label="Next question" onClick={() => go(cur + 1)} disabled={cur >= order.length - 1}>
            <SkipForward className="size-5" fill="currentColor" />
          </TransportButton>
        </div>
        {phase === 'blocked' && (
          <p className="mt-2 text-center text-[12px] text-muted-foreground">Tap play to start the audio.</p>
        )}
        <div className="mt-4">
          <Segmented
            label="Narration speed"
            size="sm"
            value={rate as (typeof SPEEDS)[number]}
            onChange={(v) => setRate(v)}
            options={SPEEDS.map((s) => ({ value: s, label: `${s}×`, aria: `${s} times speed` }))}
          />
        </div>
      </div>
    </div>
  );
}

function PhaseBar({ on, done, ms, accent, narrow }: { on: boolean; done: boolean; ms: number; accent?: boolean; narrow?: boolean }) {
  return (
    <span className={cn('relative h-[3px] overflow-hidden rounded-full bg-border', narrow ? 'w-8' : 'flex-1')}>
      <span
        className={cn('absolute inset-y-0 left-0 rounded-full', accent ? 'bg-emerald-500' : 'bg-foreground')}
        style={{
          width: on || done ? '100%' : '0%',
          transition: on ? `width ${Math.max(0, ms)}ms linear` : done ? 'none' : 'width 150ms ease-out',
        }}
      />
    </span>
  );
}

function TransportButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-12 place-items-center rounded-full text-foreground transition-[transform,opacity] active:scale-90 disabled:opacity-25"
    >
      {children}
    </button>
  );
}

/**
 * One segment per chapter, widths proportional to its question count, with a
 * playhead. Tapping a segment jumps to the start of that chapter — the
 * chapter list from the description of a cram video, made touchable.
 */
function ChapterRail({
  chapters,
  total,
  cur,
  onJump,
}: {
  chapters: { sub: string; start: number; count: number }[];
  total: number;
  cur: number;
  onJump: (i: number) => void;
}) {
  return (
    <div>
      <div className="flex h-9 items-stretch gap-[3px]" role="group" aria-label="Chapters">
        {chapters.map((c) => {
          const active = cur >= c.start && cur < c.start + c.count;
          const fill = cur >= c.start + c.count ? 1 : active ? (cur - c.start + 1) / c.count : 0;
          return (
            <button
              key={c.sub}
              onClick={() => onJump(c.start)}
              aria-label={`Chapter ${c.sub}: ${subelementTitle(c.sub)}`}
              aria-current={active ? 'true' : undefined}
              style={{ flexGrow: c.count, flexBasis: 0 }}
              className="group relative flex min-w-0 flex-col justify-end"
            >
              <span
                className={cn(
                  'mono-feats mb-1 truncate text-center font-mono text-[9px] transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground/70 group-hover:text-muted-foreground',
                )}
              >
                {c.sub}
              </span>
              <span className={cn('relative h-1.5 overflow-hidden rounded-full', active ? 'bg-border' : 'bg-border/60')}>
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-foreground transition-[width] duration-300"
                  style={{ width: `${fill * 100}%` }}
                />
              </span>
            </button>
          );
        })}
      </div>
      <p className="sr-only">
        Question {cur + 1} of {total}
      </p>
    </div>
  );
}
