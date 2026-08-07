import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  X,
  ChevronUp,
  ChevronDown,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useExam, masteryStats } from './store';
import { POOLS, subelementOf } from './types';
import { subelementTitle } from './syllabus';
import { warmVoices, speechSupported } from './speech';
import { narrate, stopNarration } from './narration';
import { cn } from '@/lib/utils';

const LETTERS = ['A', 'B', 'C', 'D'] as const;

/** Vertical swipe detection for the reel feed. */
function useSwipe(onUp: () => void, onDown: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      start.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dy = e.clientY - s.y;
      const dx = e.clientX - s.x;
      if (Math.abs(dy) < 60 || Math.abs(dx) > Math.abs(dy)) return;
      if (dy < 0) onUp();
      else onDown();
    },
  };
}

function PoolPicker() {
  const pool = useExam((s) => s.pool);
  const loadPool = useExam((s) => s.loadPool);
  return (
    <div
      role="tablist"
      aria-label="Licence class"
      className="flex gap-1 rounded-xl border border-line bg-card p-1"
    >
      {POOLS.map((p) => (
        <button
          key={p.id}
          role="tab"
          aria-selected={pool === p.id}
          onClick={() => loadPool(p.id)}
          className={cn(
            'min-h-11 flex-1 rounded-lg px-3 text-[13px] font-medium transition-colors',
            pool === p.id
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}

function TopicFilter() {
  const questions = useExam((s) => s.questions);
  const subFilter = useExam((s) => s.subFilter);
  const setSubFilter = useExam((s) => s.setSubFilter);

  const subs = useMemo(() => {
    const set = new Set(questions.map((q) => subelementOf(q.id)));
    return [...set].sort();
  }, [questions]);

  if (!subs.length) return null;

  return (
    <div className="thin-scroll -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
      <button
        onClick={() => setSubFilter(null)}
        className={cn(
          'min-h-11 shrink-0 rounded-full border px-3.5 text-[11.5px] transition-colors',
          subFilter === null
            ? 'border-foreground bg-foreground text-background'
            : 'border-border text-muted-foreground hover:text-foreground',
        )}
      >
        All topics
      </button>
      {subs.map((s) => (
        <button
          key={s}
          onClick={() => setSubFilter(s === subFilter ? null : s)}
          className={cn(
            'min-h-11 shrink-0 rounded-full border px-3.5 text-[11.5px] transition-colors',
            s === subFilter
              ? 'border-foreground bg-foreground text-background'
              : 'border-border text-muted-foreground hover:text-foreground',
          )}
        >
          <span className="mono-feats font-mono text-[10px] opacity-70">{s}</span>{' '}
          {subelementTitle(s)}
        </button>
      ))}
    </div>
  );
}

function AnswerRow({
  text,
  letter,
  state,
  onPick,
}: {
  text: string;
  letter: string;
  state: 'idle' | 'correct' | 'wrong' | 'dimmed';
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      disabled={state !== 'idle'}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors',
        'min-h-[3.25rem]',
        state === 'idle' && 'border-line bg-card hover:border-border hover:bg-accent',
        state === 'correct' && 'border-emerald-500/50 bg-emerald-500/10',
        state === 'wrong' && 'border-rose-500/50 bg-rose-500/10',
        state === 'dimmed' && 'border-line bg-card opacity-45',
      )}
    >
      <span
        className={cn(
          'mono-feats grid size-6 shrink-0 place-items-center rounded-md border font-mono text-[11px]',
          state === 'correct' && 'border-emerald-500/60 text-emerald-500',
          state === 'wrong' && 'border-rose-500/60 text-rose-500',
          (state === 'idle' || state === 'dimmed') && 'border-border text-muted-foreground',
        )}
      >
        {state === 'correct' ? (
          <Check className="size-3.5" strokeWidth={2.5} />
        ) : state === 'wrong' ? (
          <X className="size-3.5" strokeWidth={2.5} />
        ) : (
          letter
        )}
      </span>
      <span className="text-[13.5px] leading-snug text-foreground">{text}</span>
    </button>
  );
}

export function ExamView() {
  const pool = useExam((s) => s.pool);
  const loading = useExam((s) => s.loading);
  const questions = useExam((s) => s.questions);
  const queue = useExam((s) => s.queue);
  const index = useExam((s) => s.index);
  const chosen = useExam((s) => s.chosen);
  const audio = useExam((s) => s.audio);
  const progress = useExam((s) => s.progress);
  const streak = useExam((s) => s.streak);
  const answered = useExam((s) => s.answered);
  const correct = useExam((s) => s.correct);
  const loadPool = useExam((s) => s.loadPool);
  const answer = useExam((s) => s.answer);
  const next = useExam((s) => s.next);
  const prev = useExam((s) => s.prev);
  const toggleAudio = useExam((s) => s.toggleAudio);
  const resetProgress = useExam((s) => s.resetProgress);

  const q = useExam((s) => (s.queue[s.index] ? (s.byId[s.queue[s.index]] ?? null) : null));

  // Load the saved pool on first mount.
  useEffect(() => {
    if (!questions.length && !loading) void loadPool(pool);
    warmVoices();
  }, [questions.length, loading, pool, loadPool]);

  // Narrate the card when audio is on: rendered file if one exists, else live.
  useEffect(() => {
    if (!audio || !q) return;
    void narrate(pool, q);
    return stopNarration;
  }, [audio, q, pool]);

  useEffect(() => stopNarration, []);

  const pick = useCallback(
    (i: number) => {
      if (chosen === null) answer(i);
      else next();
    },
    [chosen, answer, next],
  );

  // Keyboard: A–D / 1–4 to answer, ↑↓ or Space to move.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      const letter = LETTERS.findIndex((l) => l.toLowerCase() === k);
      const num = Number(k) - 1;
      if (letter >= 0) {
        e.preventDefault();
        pick(letter);
      } else if (num >= 0 && num <= 3) {
        e.preventDefault();
        pick(num);
      } else if (k === 'arrowdown' || k === ' ' || k === 'enter') {
        e.preventDefault();
        next();
      } else if (k === 'arrowup') {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pick, next, prev]);

  const swipe = useSwipe(next, prev);
  const stats = useMemo(() => masteryStats(questions, progress), [questions, progress]);
  const accuracy = answered ? Math.round((correct / answered) * 100) : null;

  return (
    <div className="thin-scroll h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col border-x border-line">
        {/* Header */}
        <div className="space-y-3 border-b border-line px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <h1 className="text-[15px] font-medium tracking-tight text-foreground">Exam reels</h1>
            <span className="mono-feats font-mono text-[10px] text-muted-foreground">
              {stats.mastered}/{stats.total} mastered
            </span>
            <span className="flex-1" />
            {speechSupported() && (
              <button
                onClick={toggleAudio}
                aria-label={audio ? 'Turn narration off' : 'Turn narration on'}
                aria-pressed={audio}
                className={cn(
                  'grid size-11 place-items-center rounded-lg border transition-colors',
                  audio
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {audio ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              </button>
            )}
            <button
              onClick={resetProgress}
              aria-label="Reset progress"
              className="grid size-11 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="size-4" />
            </button>
          </div>

          <PoolPicker />

          <div className="h-[3px] overflow-hidden rounded-full bg-border">
            <motion.div
              className="h-full rounded-full bg-foreground"
              animate={{ width: `${stats.pct}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>

          <TopicFilter />
        </div>

        {/* Reel */}
        <div className="flex-1 px-4 py-5 sm:px-6" {...swipe}>
          {loading || !q ? (
            <div className="grid h-64 place-items-center text-[13px] text-muted-foreground">
              {loading ? 'Loading question pool…' : 'No questions in this topic.'}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="mono-feats rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {q.id}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {subelementTitle(subelementOf(q.id))}
                  </span>
                  {streak >= 3 && (
                    <span className="mono-feats ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-foreground">
                      <Sparkles className="size-3" /> {streak}
                    </span>
                  )}
                </div>

                <p className="text-[17px] font-medium leading-snug tracking-tight text-foreground">
                  {q.q}
                </p>

                {q.fig && (
                  <img
                    src={`/exam/figures/${q.fig}`}
                    alt={`Figure ${q.fig.replace(/\.png$/, '')} for question ${q.id}`}
                    className="mt-3 max-h-56 w-auto rounded-lg border border-line bg-white p-2"
                  />
                )}

                <div className="mt-4 space-y-2">
                  {q.a.map((text, i) => {
                    const state =
                      chosen === null
                        ? 'idle'
                        : i === q.c
                          ? 'correct'
                          : i === chosen
                            ? 'wrong'
                            : 'dimmed';
                    return (
                      <AnswerRow
                        key={i}
                        text={text}
                        letter={LETTERS[i]}
                        state={state}
                        onPick={() => pick(i)}
                      />
                    );
                  })}
                </div>

                <AnimatePresence>
                  {chosen !== null && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-card p-3">
                        <span className="text-[12px] text-muted-foreground">
                          {chosen === q.c ? 'Correct.' : `Answer: ${LETTERS[q.c]}.`}
                          {q.refs ? ` FCC ${q.refs}` : ''}
                        </span>
                        <span className="flex-1" />
                        <button
                          onClick={next}
                          className="min-h-11 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background transition-opacity hover:opacity-85"
                        >
                          Next
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-line px-4 py-3 sm:px-6">
          <button
            onClick={prev}
            aria-label="Previous question"
            className="grid size-11 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            onClick={next}
            aria-label="Next question"
            className="grid size-11 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown className="size-4" />
          </button>
          <span className="mono-feats font-mono text-[10.5px] text-muted-foreground">
            {queue.length ? index + 1 : 0}/{queue.length}
          </span>
          <span className="flex-1" />
          {accuracy !== null && (
            <span className="mono-feats font-mono text-[10.5px] text-muted-foreground">
              {accuracy}% · {answered} answered
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
