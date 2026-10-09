import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from 'motion/react';
import {
  Check,
  X,
  ListFilter,
  Loader2,
  Volume2,
  VolumeX,
  RotateCcw,
  ChevronRight,
  ChevronUp,
  Headphones,
  Layers,
  Timer,
  Target,
} from 'lucide-react';
import { useExam, masteryStats, subelementReadiness, type StudyMode } from './store';
import { ExamMode } from './ExamMode';
import { ListenMode } from './ListenMode';
import { POOLS, poolMeta, subelementOf, type PoolQuestion } from './types';
import { subelementTitle } from './syllabus';
import { warmVoices, speechSupported } from './speech';
import { narrator, playAnswer, playQuestion, SPEEDS, useClips, type ClipIndex } from './narration';
import { Segmented } from '@/ui/kit/Segmented';
import { ok as hapticOk, bad as hapticBad } from '@/ui/kit/haptics';
import { BottomSheet } from '@/ui/BottomSheet';
import { cn } from '@/lib/utils';
import { Roll } from '@/ui/Roll';

const LETTERS = ['A', 'B', 'C', 'D'] as const;
/** Room left at the bottom of each card so content clears the app chrome. */
const BOTTOM_CLEARANCE = 24;

/* ------------------------------------------------------------------ card */

function ReelCard({
  q,
  clips,
  active,
  audioOn,
  onPick,
  slot,
  cardH,
  scrollY,
}: {
  q: PoolQuestion;
  clips: ClipIndex;
  active: boolean;
  audioOn: boolean;
  onPick: (i: number) => void;
  /** This card's index in the feed — its resting scroll offset is slot * cardH. */
  slot: number;
  cardH: number;
  scrollY: MotionValue<number>;
}) {
  const chosen = useExam((s) => s.chosenById[q.id]);
  const streak = useExam((s) => s.streak);
  const box = useExam((s) => s.progress[q.id]?.box ?? 0);
  const toggleAudio = useExam((s) => s.toggleAudio);
  const [blocked, setBlocked] = useState(false);
  const reduce = useReducedMotion();

  const graded = chosen !== undefined;
  const right = graded && chosen === q.c;
  const sub = subelementOf(q.id);

  // Depth: a card at rest is full size; as it scrolls a whole card-height
  // away it recedes — smaller and fainter — while its neighbour comes up.
  // Driven by a scroll MotionValue, so swiping never re-renders React.
  const h = Math.max(1, cardH);
  const range = [(slot - 1) * h, slot * h, (slot + 1) * h];
  const scale = useTransform(scrollY, range, [0.9, 1, 0.9]);
  const opacity = useTransform(scrollY, range, [0.2, 1, 0.2]);
  const depth = reduce || !cardH ? undefined : { scale, opacity };

  // The question is read when the card arrives; the answer is read by the
  // feed when you pick (see ExamView.pick). Leaving the card stops audio.
  useEffect(() => {
    setBlocked(false);
    if (!active || !audioOn) return;
    let alive = true;
    void playQuestion(clips.get(q.id), q.q).then((r) => {
      if (alive && r === 'blocked') setBlocked(true);
    });
    return () => {
      alive = false;
      narrator.stop();
    };
    // clips identity changes once when the manifest lands; re-reading the
    // question then would double-play, so key on the question only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, audioOn, q.id]);

  return (
    <article
      className="relative h-full snap-start snap-always overflow-hidden"
      aria-label={`Question ${q.id}`}
    >
      <motion.div
        className="absolute inset-x-0 top-0 flex origin-center flex-col px-5 pt-2 sm:px-8"
        style={{ bottom: `calc(${BOTTOM_CLEARANCE}px + env(safe-area-inset-bottom))`, ...depth }}
      >
        {/* question — the caption, presidio-reels proportions */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-3">
          <p className="max-w-[22rem] text-balance text-center text-[clamp(1.3rem,5.4vw,1.75rem)] font-[540] leading-[1.2] tracking-tight text-foreground sm:max-w-[34rem] sm:text-[2.1rem]">
            {q.q}
          </p>
          {q.fig && (
            <img
              src={`/exam/figures/${q.fig}`}
              alt={`Figure for question ${q.id}`}
              className="mt-4 max-h-40 w-auto rounded-lg border border-line bg-white p-2"
            />
          )}
          {blocked && active && (
            <button
              onClick={() => {
                narrator.unlock();
                setBlocked(false);
                void playQuestion(clips.get(q.id), q.q);
              }}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-[12px] text-foreground"
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
            const motionProps = reduce
              ? {}
              : state === 'wrong'
                ? { animate: { x: [0, -7, 7, -5, 5, -2, 0] }, transition: { duration: 0.42 } }
                : state === 'correct'
                  ? { animate: { scale: [1, 1.025, 1] }, transition: { duration: 0.34, ease: 'easeOut' as const } }
                  : {};
            return (
              <motion.button
                key={i}
                {...motionProps}
                onClick={() => onPick(i)}
                disabled={graded}
                className={cn(
                  'flex min-h-[3rem] w-full items-start gap-3 rounded-xl border p-3 text-left transition-[background-color,border-color,opacity] duration-200',
                  state === 'idle' && 'border-line bg-card active:scale-[0.99] active:bg-accent sm:hover:bg-accent',
                  state === 'correct' && 'border-emerald-500/55 bg-emerald-500/10',
                  state === 'wrong' && 'border-rose-500/55 bg-rose-500/10',
                  state === 'dimmed' && 'border-line bg-card opacity-35',
                )}
              >
                <span
                  className={cn(
                    'mono-feats grid size-5 shrink-0 place-items-center rounded border font-mono text-[10px] transition-colors',
                    state === 'correct' && 'border-emerald-500 bg-emerald-500 text-white',
                    state === 'wrong' && 'border-rose-500 bg-rose-500 text-white',
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
                <span className="text-[13.5px] leading-snug text-foreground">{text}</span>
              </motion.button>
            );
          })}
        </div>

        {/* verdict — correct moves on by itself; a miss waits for you */}
        <div className="flex h-7 shrink-0 items-center justify-center">
          <AnimatePresence mode="wait">
            {graded && (
              <motion.p
                key={right ? 'right' : 'wrong'}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mono-feats flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground"
              >
                {right ? (
                  <>
                    <span className="text-emerald-600 dark:text-emerald-400">Correct</span>
                    {streak >= 2 && (
                      <span className="text-foreground">
                        · <Roll value={streak} /> in a row
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-rose-600 dark:text-rose-400">Answer {LETTERS[q.c]}</span>
                    <span>· swipe when ready</span>
                    <motion.span
                      animate={reduce ? undefined : { y: [0, -3, 0] }}
                      transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                      className="inline-flex"
                    >
                      <ChevronUp className="size-3.5" />
                    </motion.span>
                  </>
                )}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* identity row — presidio reels: badge · title · meta · control */}
        <div className="flex shrink-0 items-center gap-3 border-t border-line pt-3">
          <span className="mono-feats grid size-9 shrink-0 place-items-center rounded-full border border-border bg-card font-mono text-[11px] font-semibold text-foreground">
            {sub}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-foreground">{subelementTitle(sub)}</p>
            {/* Only the ID is uppercased: Part 97 paragraph letters are lowercase,
                so §97.301(d) must not render as 97.301(D). */}
            <p className="mono-feats truncate font-mono text-[10px] tracking-wider text-muted-foreground">
              <span className="uppercase">{q.id}</span>
              {q.refs ? ` · FCC ${q.refs}` : ''}
            </p>
          </div>
          {/* how well this card is known: Leitner box as four dots */}
          <span className="flex shrink-0 items-center gap-[3px]" aria-label={`Known ${box} of 4`} title={`Known ${box}/4`}>
            {[1, 2, 3, 4].map((d) => (
              <span
                key={d}
                className={cn('size-1.5 rounded-full transition-colors', d <= box ? 'bg-foreground' : 'bg-border')}
              />
            ))}
          </span>
          {speechSupported() && (
            <button
              onClick={toggleAudio}
              aria-label={audioOn ? 'Turn narration off' : 'Turn narration on'}
              aria-pressed={audioOn}
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-full border transition-colors active:scale-95',
                audioOn ? 'border-foreground bg-foreground text-background' : 'border-line bg-card text-foreground',
              )}
            >
              {audioOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </button>
          )}
        </div>
      </motion.div>
    </article>
  );
}

function FilterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pool = useExam((s) => s.pool);
  const loadPool = useExam((s) => s.loadPool);
  const questions = useExam((s) => s.questions);
  const progress = useExam((s) => s.progress);
  const subFilter = useExam((s) => s.subFilter);
  const setSubFilter = useExam((s) => s.setSubFilter);
  const missedOnly = useExam((s) => s.missedOnly);
  const setMissedOnly = useExam((s) => s.setMissedOnly);
  const resetProgress = useExam((s) => s.resetProgress);
  const audio = useExam((s) => s.audio);
  const toggleAudio = useExam((s) => s.toggleAudio);
  const rate = useExam((s) => s.rate);
  const setRate = useExam((s) => s.setRate);
  const queue = useExam((s) => s.queue);
  const [confirmReset, setConfirmReset] = useState(false);

  // Readiness is computed weakest-first, but the list keeps syllabus order so
  // rows don't jump around between visits — the bars carry the ranking.
  const readiness = useMemo(() => {
    const m = new Map(subelementReadiness(questions, progress).map((r) => [r.sub, r]));
    return [...m.keys()].sort().map((k) => m.get(k)!);
  }, [questions, progress]);
  const missedCount = useMemo(
    () => questions.filter((q) => (progress[q.id]?.wrong ?? 0) > 0).length,
    [questions, progress],
  );
  const overall = useMemo(() => masteryStats(questions, progress), [questions, progress]);

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        setConfirmReset(false);
        onClose();
      }}
      title="Study"
      position="absolute"
      footer={
        <button
          onClick={onClose}
          className="flex min-h-11 w-full items-center justify-center rounded-lg bg-foreground text-[13px] font-medium text-background transition-opacity hover:opacity-90"
        >
          Study {queue.length} {queue.length === 1 ? 'question' : 'questions'}
        </button>
      }
    >
      {/* licence class: the same segmented control as narration speed below,
          so it gets the spring thumb, haptic tick and arrow keys too */}
      <div className="px-4">
        <Segmented
          label="Licence class"
          value={pool}
          onChange={(id) => void loadPool(id)}
          options={POOLS.map((p) => ({ value: p.id, label: p.name }))}
        />
      </div>

      {/* narration */}
      <div className="px-4 pt-3">
        <div className="rounded-lg border border-line p-3">
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-foreground">Read questions aloud</span>
              <span className="block text-[11.5px] text-muted-foreground">Question, then the answer after you pick</span>
            </span>
            <button
              role="switch"
              aria-checked={audio}
              aria-label="Read questions aloud"
              onClick={toggleAudio}
              className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors', audio ? 'bg-foreground' : 'bg-border')}
            >
              <span
                className={cn(
                  'absolute top-0.5 size-5 rounded-full bg-background shadow-sm transition-[left] duration-200',
                  audio ? 'left-[18px]' : 'left-0.5',
                )}
              />
            </button>
          </div>
          <Segmented
            className="mt-3"
            size="sm"
            label="Narration speed"
            value={rate as (typeof SPEEDS)[number]}
            onChange={(v) => setRate(v)}
            options={SPEEDS.map((v) => ({ value: v, label: `${v}×`, aria: `${v} times speed` }))}
          />
        </div>
      </div>

      {/* missed only */}
      <div className="px-4 pt-2">
        <button
          role="switch"
          aria-checked={missedOnly}
          disabled={missedCount === 0}
          onClick={() => setMissedOnly(!missedOnly)}
          className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-line px-3.5 text-left transition-colors hover:border-foreground/40 disabled:opacity-50"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-foreground">Only questions I’ve missed</span>
            <span className="block text-[11.5px] text-muted-foreground">
              {missedCount === 0 ? 'Nothing missed yet' : `${missedCount} to review`}
            </span>
          </span>
          <span
            aria-hidden
            className={cn(
              'relative h-6 w-10 shrink-0 rounded-full transition-colors',
              missedOnly ? 'bg-foreground' : 'bg-border',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 size-5 rounded-full bg-background shadow-sm transition-[left] duration-200',
                missedOnly ? 'left-[18px]' : 'left-0.5',
              )}
            />
          </span>
        </button>
      </div>

      {/* topics = readiness */}
      <div className="flex items-baseline justify-between px-4 pb-2 pt-5">
        <p className="mono-feats font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Topics · mastery
        </p>
        <p className="mono-feats font-mono text-[10px] text-muted-foreground">
          {overall.mastered}/{overall.total}
        </p>
      </div>
      <div className="border-t border-line">
        <button
          onClick={() => {
            setSubFilter(null);
            onClose();
          }}
          className={cn(
            'flex min-h-12 w-full items-center gap-3 px-4 text-left text-[13px] transition-colors',
            subFilter === null ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <span className="flex-1">All topics</span>
          {subFilter === null && <Check className="size-4 text-foreground" />}
        </button>
        {readiness.map((r) => {
          const active = subFilter === r.sub;
          return (
            <button
              key={r.sub}
              onClick={() => {
                setSubFilter(r.sub);
                onClose();
              }}
              className={cn(
                'flex w-full items-center gap-3 border-t border-line px-4 py-2.5 text-left transition-colors',
                active ? 'bg-accent' : 'hover:bg-accent/50',
              )}
            >
              <span className="mono-feats w-6 shrink-0 font-mono text-[10.5px] text-muted-foreground">{r.sub}</span>
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-[13px]', active ? 'text-foreground' : 'text-foreground/85')}>
                  {subelementTitle(r.sub)}
                </span>
                <span className="mt-1.5 block h-[3px] overflow-hidden rounded-full bg-border">
                  <span
                    className="block h-full rounded-full bg-foreground transition-[width] duration-500"
                    style={{ width: `${r.pct}%` }}
                  />
                </span>
              </span>
              <span className="mono-feats w-9 shrink-0 text-right font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {r.pct}%
              </span>
            </button>
          );
        })}
      </div>

      {/* reset — destructive, so it lives down here behind a confirm */}
      <div className="px-4 pb-2 pt-5">
        <button
          onClick={() => {
            if (!confirmReset) {
              setConfirmReset(true);
              return;
            }
            resetProgress();
            setConfirmReset(false);
          }}
          className={cn(
            'inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-[12px] transition-colors',
            confirmReset ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <RotateCcw className="size-3.5" />
          {confirmReset ? 'Tap again to erase all progress' : 'Reset progress'}
        </button>
      </div>
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ feed */

type Tab = 'quiz' | 'listen' | 'exam';

export function ExamView() {
  const pool = useExam((s) => s.pool);
  const loading = useExam((s) => s.loading);
  const questions = useExam((s) => s.questions);
  const byId = useExam((s) => s.byId);
  const queue = useExam((s) => s.queue);
  const index = useExam((s) => s.index);
  const setIndex = useExam((s) => s.setIndex);
  const audio = useExam((s) => s.audio);
  const rate = useExam((s) => s.rate);
  const mode = useExam((s) => s.mode);
  const setMode = useExam((s) => s.setMode);
  const progress = useExam((s) => s.progress);
  const loadPool = useExam((s) => s.loadPool);
  const subFilter = useExam((s) => s.subFilter);
  const missedOnly = useExam((s) => s.missedOnly);
  const session = useExam((s) => s.session);

  const [tab, setTab] = useState<Tab>(mode);
  const [filterOpen, setFilterOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollY = useMotionValue(0);
  const [cardH, setCardH] = useState(0);
  const reduce = useReducedMotion();
  const clips = useClips(pool);

  useEffect(() => {
    if (!questions.length && !loading) void loadPool(pool);
    warmVoices();
  }, [questions.length, loading, pool, loadPool]);

  useEffect(() => {
    narrator.setRate(rate);
  }, [rate]);
  useEffect(() => () => narrator.stop(), []);

  // Any queue rebuild must take the scroll position with it. Resetting
  // progress, or re-tapping the current pool/topic, reshuffles and sets
  // index to 0 without changing pool or subFilter — leaving scrollTop
  // stranded, which blanked the feed (cards outside the +/-3 window render
  // aria-hidden) and graded the off-screen queue[0].
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    scrollY.set(0);
  }, [pool, subFilter, queue, scrollY]);

  // Card height = the scroller's height; re-measured on resize / rotation.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setCardH(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, queue.length, tab]);

  const snapTo = useCallback(
    (next: number) => {
      const el = scrollRef.current;
      if (!el || !queue.length) return;
      const target = Math.max(0, Math.min(queue.length - 1, next));
      el.scrollTo({ top: target * el.clientHeight, behavior: reduce ? 'auto' : 'smooth' });
    },
    [queue.length, reduce],
  );

  const advanceTimer = useRef<number | undefined>(undefined);

  // One answer path for tap and keyboard. The correct answer is read back
  // either way — confirmation when you were right, the lesson when you
  // weren't. A right answer moves on once that clip finishes; a miss stays.
  const pick = useCallback(
    (id: string, i: number, at: number) => {
      const st = useExam.getState();
      if (st.chosenById[id] !== undefined) return;
      const q = st.byId[id];
      if (!q) return;
      st.answer(id, i);
      const right = i === q.c;
      if (right) hapticOk();
      else hapticBad();
      window.clearTimeout(advanceTimer.current);
      const advance = (ms: number) => {
        if (!right) return;
        advanceTimer.current = window.setTimeout(() => {
          if (useExam.getState().index === at) snapTo(at + 1);
        }, ms);
      };
      if (st.audio) {
        void playAnswer(clips.get(id), q.a[q.c]).then((r) => advance(r === 'ended' ? 380 : 900));
      } else {
        advance(900);
      }
    },
    [snapTo, clips],
  );

  // Moving by hand cancels a pending auto-advance, so it can't yank you.
  useEffect(() => () => window.clearTimeout(advanceTimer.current), []);
  useEffect(() => {
    window.clearTimeout(advanceTimer.current);
  }, [index]);

  // Keyboard (quiz only): j/k or arrows move the feed, A-D answer.
  useEffect(() => {
    if (tab !== 'quiz') return;
    const onKey = (e: KeyboardEvent) => {
      if (filterOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowdown' || k === 'pagedown' || k === 'j') {
        e.preventDefault();
        snapTo(index + 1);
      } else if (k === 'arrowup' || k === 'pageup' || k === 'k') {
        e.preventDefault();
        snapTo(index - 1);
      } else {
        const choice = LETTERS.findIndex((l) => l.toLowerCase() === k);
        const id = queue[index];
        if (choice >= 0 && id) {
          e.preventDefault();
          pick(id, choice, index);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab, filterOpen, index, queue, snapTo, pick]);

  const stats = useMemo(() => masteryStats(questions, progress), [questions, progress]);

  if (session) return <ExamMode />;

  const switchTab = (t: Tab) => {
    narrator.stop();
    setTab(t);
    if (t !== 'exam') setMode(t as StudyMode);
  };

  return (
    // Any tap unlocks the shared audio element, so later cards can speak
    // without asking (iOS requires a gesture on the element once).
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background" onPointerDownCapture={() => narrator.unlock()}>
      {/* mastery hairline — fills as the pool is mastered */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-[2px] bg-border/60">
        <div
          className="h-full bg-foreground transition-[width] duration-700 ease-out"
          style={{ width: `${stats.total ? (stats.mastered / stats.total) * 100 : 0}%` }}
        />
      </div>

      <header className="relative z-20 shrink-0 px-4 pb-3 pt-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="mono-feats font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {tab === 'quiz' && queue.length ? (
                <>
                  <Roll value={Math.min(index + 1, queue.length)} />/{queue.length} ·{' '}
                </>
              ) : null}
              <Roll value={stats.mastered} /> of {stats.total} mastered
            </p>
            <h1 className="mt-0.5 truncate text-[17px] font-semibold leading-none text-foreground">
              {POOLS.find((p) => p.id === pool)?.name}
            </h1>
          </div>
          <button
            onClick={() => setFilterOpen(true)}
            aria-label="Study settings"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-foreground/85 transition-transform active:scale-95"
          >
            <ListFilter className="size-4" />
            <span className="mono-feats max-w-[92px] truncate font-mono text-[10px] uppercase tracking-wider">
              {missedOnly ? 'Missed' : subFilter ?? 'Topics'}
            </span>
          </button>
        </div>
        <Segmented
          className="mt-3"
          label="Study mode"
          value={tab}
          onChange={switchTab}
          options={[
            { value: 'quiz', label: 'Quiz', icon: <Layers className="size-3.5" /> },
            { value: 'listen', label: 'Listen', icon: <Headphones className="size-3.5" /> },
            { value: 'exam', label: 'Exam', icon: <Timer className="size-3.5" /> },
          ]}
        />
      </header>

      <div className="relative min-h-0 flex-1">
        {tab === 'listen' ? (
          <ListenMode />
        ) : tab === 'exam' ? (
          <ExamLobby />
        ) : loading || !queue.length ? (
          <div className="grid h-full place-items-center">
            {loading ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading" />
            ) : (
              <p className="text-[13px] text-muted-foreground">
                {missedOnly ? 'Nothing missed here — nice.' : 'No questions in this topic.'}
              </p>
            )}
          </div>
        ) : (
          <>
            {/* content sliding up under the header fades instead of clipping */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-background to-transparent" />
            <div
              ref={scrollRef}
              aria-label="Exam question reels"
              onScroll={(e) => {
                const t = e.currentTarget;
                scrollY.set(t.scrollTop);
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
                    clips={clips}
                    active={i === index && !filterOpen}
                    audioOn={audio}
                    onPick={(c) => pick(id, c, i)}
                    slot={i}
                    cardH={cardH}
                    scrollY={scrollY}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} />
    </div>
  );
}

/* ------------------------------------------------------------ exam lobby */

/**
 * Chance of answering a question right, by Leitner box. Unseen questions are
 * scored as a four-way guess; the rest climb toward certainty as they're
 * answered right repeatedly. Deliberately conservative.
 */
const P_BY_BOX = [0.3, 0.6, 0.78, 0.9, 0.96];

/** Expected score and pass probability for a one-per-group practice exam. */
function readiness(questions: PoolQuestion[], progress: ReturnType<typeof useExam.getState>['progress'], passing: number) {
  const groups = new Map<string, number[]>();
  for (const q of questions) {
    const p = progress[q.id];
    const pr = p ? P_BY_BOX[Math.min(4, p.box)] : 0.25;
    const g = q.id.slice(0, 3);
    const arr = groups.get(g);
    if (arr) arr.push(pr);
    else groups.set(g, [pr]);
  }
  // Each exam question is a random draw from its group: a Bernoulli trial
  // with the group's mean probability. Sum them (Poisson-binomial), then
  // the normal approximation with continuity correction for P(score ≥ pass).
  let mean = 0;
  let variance = 0;
  for (const arr of groups.values()) {
    const p = arr.reduce((a, b) => a + b, 0) / arr.length;
    mean += p;
    variance += p * (1 - p);
  }
  const z = (passing - 0.5 - mean) / Math.sqrt(Math.max(variance, 1e-6));
  const passProb = 1 - normalCdf(z);
  return { expected: mean, passProb, groups: groups.size };
}

function normalCdf(z: number): number {
  // Abramowitz & Stegun 7.1.26 via erf.
  const t = 1 / (1 + 0.3275911 * Math.abs(z / Math.SQRT2));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-((z / Math.SQRT2) ** 2));
  return 0.5 * (1 + Math.sign(z) * y);
}

function ExamLobby() {
  const pool = useExam((s) => s.pool);
  const questions = useExam((s) => s.questions);
  const progress = useExam((s) => s.progress);
  const startExam = useExam((s) => s.startExam);
  const meta = poolMeta(pool);
  const r = useMemo(() => readiness(questions, progress, meta.passing), [questions, progress, meta.passing]);
  const pct = Math.round(r.passProb * 100);
  const seen = useMemo(() => questions.filter((q) => progress[q.id]).length, [questions, progress]);

  return (
    <div className="flex h-full flex-col px-5 pb-[calc(20px+env(safe-area-inset-bottom))] sm:px-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-foreground text-background">
            <Timer className="size-5" />
          </span>
          <div>
            <p className="text-[17px] font-semibold tracking-tight text-foreground">Practice exam</p>
            <p className="text-[12.5px] text-muted-foreground">Built the way a VE session builds yours.</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-border">
          {[
            ['Questions', meta.examQuestions],
            ['To pass', meta.passing],
            ['Groups', r.groups],
          ].map(([k, v]) => (
            <div key={k} className="bg-card px-3 py-3">
              <p className="mono-feats font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">{k}</p>
              <p className="mt-1 text-[20px] font-semibold tabular-nums tracking-tight text-foreground">{v}</p>
            </div>
          ))}
        </div>

        {/* readiness gauge */}
        <div className="mt-3 rounded-xl border border-line bg-card p-4">
          <div className="flex items-baseline justify-between">
            <p className="mono-feats flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <Target className="size-3.5" /> Readiness estimate
            </p>
            <p className="mono-feats font-mono text-[10px] text-muted-foreground">
              {seen}/{questions.length} studied
            </p>
          </div>
          <div className="mt-3 flex items-end gap-4">
            <p className="text-[34px] font-semibold leading-none tabular-nums tracking-tight text-foreground">
              <Roll value={pct} />%
            </p>
            <p className="pb-1 text-[12.5px] leading-snug text-muted-foreground">
              chance to pass today · predicted score{' '}
              <span className="font-medium text-foreground tabular-nums">
                {r.expected.toFixed(1)}/{meta.examQuestions}
              </span>
            </p>
          </div>
          <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-border">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-700',
                pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500',
              )}
              style={{ width: `${(r.expected / meta.examQuestions) * 100}%` }}
            />
            {/* pass line */}
            <span
              className="absolute inset-y-[-3px] w-[2px] rounded bg-foreground"
              style={{ left: `${(meta.passing / meta.examQuestions) * 100}%` }}
              aria-hidden
            />
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
            Unstudied questions count as a guess. Every quiz answer and “knew it” sharpens this.
          </p>
        </div>
      </div>

      <button
        onClick={startExam}
        disabled={!questions.length}
        className="mx-auto flex h-14 w-full max-w-md shrink-0 items-center justify-center gap-2 rounded-2xl bg-foreground text-[15px] font-semibold text-background shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)] transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        Start the exam
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
