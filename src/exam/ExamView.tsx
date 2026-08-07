import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Check,
  X,
  ListFilter,
  Loader2,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useExam, masteryStats } from './store';
import { POOLS, subelementOf, type ElementId, type PoolQuestion } from './types';
import { subelementTitle } from './syllabus';
import { warmVoices, speechSupported, speakQuestion, cancelSpeech } from './speech';
import { clipUrl, useRenderedSet } from './narration';
import { BottomSheet } from '@/ui/BottomSheet';
import { IconButton } from '@/ui/controls';
import { cn } from '@/lib/utils';

const LETTERS = ['A', 'B', 'C', 'D'] as const;
/** Room left at the bottom of each card so content clears the app chrome. */
const BOTTOM_CLEARANCE = 24;

/* ------------------------------------------------------------------ card */

function ReelCard({
  q,
  pool,
  active,
  audioOn,
  hasClip,
}: {
  q: PoolQuestion;
  pool: ElementId;
  active: boolean;
  audioOn: boolean;
  hasClip: boolean;
}) {
  const chosen = useExam((s) => s.chosenById[q.id]);
  const answer = useExam((s) => s.answer);
  const streak = useExam((s) => s.streak);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [blocked, setBlocked] = useState(false);

  const graded = chosen !== undefined;

  // Audio follows the active card: play on arrival, stop on leave.
  useEffect(() => {
    if (!active || !audioOn) {
      audioRef.current?.pause();
      cancelSpeech();
      setBlocked(false);
      return;
    }
    if (hasClip) {
      const el = audioRef.current;
      if (!el) return;
      el.currentTime = 0;
      void el.play().catch((err: unknown) => {
        // Autoplay refused until the user interacts — offer a tap target.
        if (err instanceof DOMException && err.name === 'NotAllowedError') setBlocked(true);
      });
      return () => el.pause();
    }
    speakQuestion(q.q, q.a, { withAnswers: true });
    return cancelSpeech;
  }, [active, audioOn, hasClip, q]);

  return (
    <article
      className="relative h-full snap-start snap-always overflow-hidden"
      aria-label={`Question ${q.id}`}
    >
      {hasClip && active && (
        <audio ref={audioRef} src={clipUrl(pool, q.id)} preload="auto" playsInline />
      )}

      <div
        className="absolute inset-x-0 top-0 flex flex-col px-5 pt-16 sm:px-8"
        style={{ bottom: `calc(${BOTTOM_CLEARANCE}px + env(safe-area-inset-bottom))` }}
      >
        {/* meta */}
        <div className="mono-feats flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
          <span className="rounded border border-border px-1.5 py-0.5 text-foreground/75">{q.id}</span>
          <span className="truncate text-muted-foreground">{subelementTitle(subelementOf(q.id))}</span>
          {active && streak >= 3 && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-foreground">
              <Sparkles className="size-3" /> {streak}
            </span>
          )}
        </div>

        {/* question */}
        <div className="flex min-h-0 flex-1 flex-col justify-center py-4">
          <p className="text-balance text-center text-[1.5rem] font-[540] leading-[1.18] tracking-tight text-foreground sm:text-[2rem]">
            {q.q}
          </p>
          {q.fig && (
            <img
              src={`/exam/figures/${q.fig}`}
              alt={`Figure for question ${q.id}`}
              className="mx-auto mt-4 max-h-40 w-auto rounded-lg border border-line bg-white p-2"
            />
          )}
          {blocked && active && (
            <button
              onClick={() => void audioRef.current?.play().then(() => setBlocked(false))}
              className="mx-auto mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-[12px] text-foreground"
            >
              <Volume2 className="size-4" /> Tap to hear it
            </button>
          )}
        </div>

        {/* answers */}
        <div className="shrink-0 space-y-2">
          {q.a.map((text, i) => {
            const state = !graded
              ? 'idle'
              : i === q.c
                ? 'correct'
                : i === chosen
                  ? 'wrong'
                  : 'dimmed';
            return (
              <button
                key={i}
                onClick={() => answer(q.id, i)}
                disabled={graded}
                className={cn(
                  'flex min-h-[3rem] w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                  state === 'idle' && 'border-line bg-card active:bg-accent sm:hover:bg-accent',
                  state === 'correct' && 'border-emerald-500/50 bg-emerald-500/10',
                  state === 'wrong' && 'border-rose-500/50 bg-rose-500/10',
                  state === 'dimmed' && 'border-line bg-card opacity-40',
                )}
              >
                <span
                  className={cn(
                    'mono-feats grid size-5 shrink-0 place-items-center rounded border font-mono text-[10px]',
                    state === 'correct' && 'border-emerald-500/60 text-emerald-500',
                    state === 'wrong' && 'border-rose-500/60 text-rose-500',
                    (state === 'idle' || state === 'dimmed') && 'border-border text-muted-foreground',
                  )}
                >
                  {state === 'correct' ? (
                    <Check className="size-3" strokeWidth={3} />
                  ) : state === 'wrong' ? (
                    <X className="size-3" strokeWidth={3} />
                  ) : (
                    LETTERS[i]
                  )}
                </span>
                <span className="text-[13px] leading-snug text-foreground">{text}</span>
              </button>
            );
          })}

          <AnimatePresence>
            {graded && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mono-feats pt-0.5 text-center font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground"
              >
                {chosen === q.c ? 'Correct' : `Answer ${LETTERS[q.c]}`}
                {q.refs ? ` · FCC ${q.refs}` : ''} · swipe up for next
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </article>
  );
}

/* ----------------------------------------------------------------- sheet */

function FilterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pool = useExam((s) => s.pool);
  const loadPool = useExam((s) => s.loadPool);
  const questions = useExam((s) => s.questions);
  const subFilter = useExam((s) => s.subFilter);
  const setSubFilter = useExam((s) => s.setSubFilter);
  const queue = useExam((s) => s.queue);

  const subs = useMemo(
    () => [...new Set(questions.map((q) => subelementOf(q.id)))].sort(),
    [questions],
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Browse questions"
      position="absolute"
      footer={
        <button
          onClick={onClose}
          className="mono-feats flex min-h-11 w-full items-center justify-center rounded-lg bg-foreground font-mono text-[11px] font-semibold uppercase tracking-wider text-background"
        >
          Show {queue.length} questions
        </button>
      }
    >
      <div className="px-4 pb-1">
        <p className="mono-feats pb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Licence class
        </p>
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-line p-1">
          {POOLS.map((p) => (
            <button
              key={p.id}
              onClick={() => void loadPool(p.id)}
              className={cn(
                'min-h-10 rounded-md text-[12px] font-medium transition-colors',
                pool === p.id ? 'bg-foreground text-background' : 'text-muted-foreground',
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <p className="mono-feats px-4 pb-1 pt-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Topic
      </p>
      <div className="border-t border-line">
        {[null, ...subs].map((s, i) => (
          <button
            key={s ?? 'all'}
            onClick={() => {
              setSubFilter(s);
              onClose();
            }}
            className={cn(
              'flex min-h-12 w-full items-center gap-2.5 px-4 text-left text-[12.5px]',
              i ? 'border-t border-line' : '',
              subFilter === s ? 'bg-accent text-foreground' : 'text-muted-foreground',
            )}
          >
            {s && <span className="mono-feats font-mono text-[10px] opacity-70">{s}</span>}
            <span>{s ? subelementTitle(s) : 'All topics'}</span>
            {subFilter === s && <span className="ml-auto">•</span>}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ feed */

export function ExamView() {
  const pool = useExam((s) => s.pool);
  const loading = useExam((s) => s.loading);
  const questions = useExam((s) => s.questions);
  const byId = useExam((s) => s.byId);
  const queue = useExam((s) => s.queue);
  const index = useExam((s) => s.index);
  const setIndex = useExam((s) => s.setIndex);
  const audio = useExam((s) => s.audio);
  const toggleAudio = useExam((s) => s.toggleAudio);
  const progress = useExam((s) => s.progress);
  const loadPool = useExam((s) => s.loadPool);
  const resetProgress = useExam((s) => s.resetProgress);
  const subFilter = useExam((s) => s.subFilter);

  const [filterOpen, setFilterOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const rendered = useRenderedSet(pool);

  useEffect(() => {
    if (!questions.length && !loading) void loadPool(pool);
    warmVoices();
  }, [questions.length, loading, pool, loadPool]);

  useEffect(() => cancelSpeech, []);

  // A new pool or topic resets the feed to the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [pool, subFilter]);

  const snapTo = useCallback(
    (next: number) => {
      const el = scrollRef.current;
      if (!el || !queue.length) return;
      const target = Math.max(0, Math.min(queue.length - 1, next));
      el.scrollTo({ top: target * el.clientHeight, behavior: reduce ? 'auto' : 'smooth' });
    },
    [queue.length, reduce],
  );

  // Keyboard: j/k or arrows move the feed, A-D answer the visible card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (filterOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (k === 'arrowdown' || k === 'pagedown' || k === 'j') {
        e.preventDefault();
        snapTo(index + 1);
      } else if (k === 'arrowup' || k === 'pageup' || k === 'k') {
        e.preventDefault();
        snapTo(index - 1);
      } else {
        const pick = LETTERS.findIndex((l) => l.toLowerCase() === k);
        const id = queue[index];
        if (pick >= 0 && id) {
          e.preventDefault();
          useExam.getState().answer(id, pick);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filterOpen, index, queue, snapTo]);

  const stats = useMemo(() => masteryStats(questions, progress), [questions, progress]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      {/* header overlay */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-4 pt-3">
        <div className="min-w-0">
          <p className="mono-feats font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {stats.mastered}/{stats.total} mastered
          </p>
          <h1 className="mt-0.5 truncate text-[16px] font-semibold leading-none text-foreground">
            {POOLS.find((p) => p.id === pool)?.name} reels
          </h1>
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
          {speechSupported() && (
            <IconButton
              variant="outline"
              active={audio}
              onClick={toggleAudio}
              label={audio ? 'Turn narration off' : 'Turn narration on'}
            >
              {audio ? <Volume2 /> : <VolumeX />}
            </IconButton>
          )}
          <IconButton variant="outline" onClick={resetProgress} label="Reset progress">
            <RotateCcw />
          </IconButton>
          <button
            onClick={() => setFilterOpen(true)}
            aria-label="Browse questions"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line bg-background/65 px-3 text-foreground/85 backdrop-blur transition-transform active:scale-95"
          >
            <ListFilter className="size-4" />
            <span className="mono-feats max-w-[92px] truncate font-mono text-[10px] uppercase tracking-wider">
              {subFilter ?? `${queue.length}`}
            </span>
          </button>
        </div>
      </div>

      {/* feed */}
      {loading || !queue.length ? (
        <div className="grid h-full place-items-center">
          {loading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading" />
          ) : (
            <p className="text-[13px] text-muted-foreground">No questions in this topic.</p>
          )}
        </div>
      ) : (
        <div
          ref={scrollRef}
          aria-label="Exam question reels"
          onScroll={(e) => {
            const t = e.currentTarget;
            setIndex(
              Math.max(0, Math.min(queue.length - 1, Math.round(t.scrollTop / Math.max(1, t.clientHeight)))),
            );
          }}
          className="no-scrollbar absolute inset-0 snap-y snap-mandatory overflow-y-auto overscroll-y-contain"
        >
          {queue.map((id, i) => {
            const q = byId[id];
            if (!q) return null;
            // Only mount cards near the viewport; the rest hold their height.
            if (Math.abs(i - index) > 3) {
              return <div key={id} className="h-full snap-start snap-always" aria-hidden />;
            }
            return (
              <ReelCard
                key={id}
                q={q}
                pool={pool}
                active={i === index && !filterOpen}
                audioOn={audio}
                hasClip={rendered.has(id)}
              />
            );
          })}
        </div>
      )}

      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} />
    </div>
  );
}
