import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, X, Timer, RotateCcw, Target, ArrowLeft } from 'lucide-react';
import { useExam, examScore } from './store';
import { poolMeta, subelementOf, type PoolQuestion } from './types';
import { subelementTitle } from './syllabus';
import { IconButton } from '@/ui/controls';
import { cn } from '@/lib/utils';
import { Roll } from '@/ui/Roll';

const LETTERS = ['A', 'B', 'C', 'D'] as const;

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/* ------------------------------------------------------------ exam card */

function ExamCard({
  q,
  n,
  total,
  chosen,
  onPick,
}: {
  q: PoolQuestion;
  n: number;
  total: number;
  chosen: number | undefined;
  onPick: (i: number) => void;
}) {
  // Deliberately the same anatomy as the study reel card (ExamView ReelCard):
  // boxed id badge, centred question, rounded-xl rows with boxed letters.
  // Only the picked state differs — no verdict until the exam is submitted.
  return (
    <article
      aria-label={`Question ${n} of ${total}`}
      className="relative h-full snap-start snap-always overflow-hidden"
    >
      <div className="absolute inset-x-0 bottom-[84px] top-0 flex flex-col px-5 pt-16 sm:px-8">
        <div className="mono-feats flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
          <span className="tabular-nums text-foreground">
            {n}
            <span className="text-muted-foreground">/{total}</span>
          </span>
          <span className="rounded border border-border px-1.5 py-0.5 text-foreground/75">{q.id}</span>
          <span className="truncate text-muted-foreground">{subelementTitle(subelementOf(q.id))}</span>
        </div>

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
        </div>

        <div className="shrink-0 space-y-2">
          {q.a.map((text, i) => {
            const picked = chosen === i;
            return (
              <button
                key={i}
                onClick={() => onPick(i)}
                aria-pressed={picked}
                className={cn(
                  'flex min-h-[3rem] w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                  picked
                    ? 'border-foreground/70 bg-foreground/[0.06]'
                    : 'border-line bg-card active:bg-accent sm:hover:bg-accent',
                )}
              >
                <span
                  className={cn(
                    'mono-feats grid size-5 shrink-0 place-items-center rounded border font-mono text-[10px] transition-colors',
                    picked ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground',
                  )}
                >
                  {LETTERS[i]}
                </span>
                <span className="text-[13px] leading-snug text-foreground">{text}</span>
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
}

/* ----------------------------------------------------------- results */

function Results() {
  const session = useExam((s) => s.session)!;
  const byId = useExam((s) => s.byId);
  const pool = useExam((s) => s.pool);
  const startExam = useExam((s) => s.startExam);
  const exitExam = useExam((s) => s.exitExam);
  const setMissedOnly = useExam((s) => s.setMissedOnly);

  const score = examScore(session, byId, pool);
  const meta = poolMeta(pool);

  // Missed first — that is the part worth reading.
  const rows = useMemo(() => {
    const out: { q: PoolQuestion; chosen: number | undefined; right: boolean }[] = [];
    for (const id of session.ids) {
      const q = byId[id];
      if (!q) continue;
      const chosen: number | undefined = session.answers[id];
      out.push({ q, chosen, right: chosen === q.c });
    }
    return out.sort((a, b) => Number(a.right) - Number(b.right));
  }, [session, byId]);

  const missed = rows.filter((r) => !r.right).length;
  const margin = score.correct - meta.passing;

  return (
    <div className="no-scrollbar absolute inset-0 overflow-y-auto">
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-6 sm:px-8">
        <p className="mono-feats font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {meta.name} practice exam · {fmtElapsed(score.elapsedMs)}
        </p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
          className="mt-3"
        >
          <div className="flex items-baseline gap-3">
            <span className="mono-feats font-mono text-[3.25rem] font-medium leading-none tracking-tight text-foreground">
              <Roll value={score.correct} from={0} delayMs={260} />
              <span className="text-muted-foreground">/{score.total}</span>
            </span>
            <span
              className={cn(
                'rounded-full border px-2.5 py-1 text-[12px] font-semibold tracking-wide',
                score.passed
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-rose-400',
              )}
            >
              {score.passed ? 'PASS' : 'FAIL'}
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            {score.passed
              ? margin === 0
                ? `Passed exactly on the line — ${meta.passing} needed. One more miss and it was a fail.`
                : `${margin} above the ${meta.passing}-question pass mark.`
              : `${-margin} short of the ${meta.passing} you need.`}
            {score.answered < score.total &&
              ` ${score.total - score.answered} left blank — scored as wrong, same as the real exam.`}
          </p>
        </motion.div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {missed > 0 && (
            <button
              onClick={() => {
                exitExam();
                setMissedOnly(true);
              }}
              className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-foreground bg-foreground px-3 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
            >
              <Target className="size-4" />
              Drill the {missed} you missed
            </button>
          )}
          <button
            onClick={startExam}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 text-[13px] text-foreground transition-colors hover:border-foreground"
          >
            <RotateCcw className="size-4" />
            New exam
          </button>
          <button
            onClick={exitExam}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 text-[13px] text-foreground transition-colors hover:border-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to reels
          </button>
        </div>

        <h2 className="mono-feats mt-8 border-b border-line pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {missed > 0 ? `Review · ${missed} missed first` : 'Review · a clean sheet'}
        </h2>

        <ol className="divide-y divide-border">
          {rows.map(({ q, chosen, right }) => (
            <li key={q.id} className="py-4">
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full',
                    right ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
                  )}
                >
                  {right ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="mono-feats font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {q.id}
                    {q.refs ? ` · FCC ${q.refs}` : ''}
                  </p>
                  <p className="mt-1 text-[13.5px] leading-snug text-foreground">{q.q}</p>
                  {q.fig && (
                    <img
                      src={`/exam/figures/${q.fig}`}
                      alt={`Figure ${q.fig}`}
                      className="mt-2 max-h-32 w-auto rounded border border-line bg-white p-1.5"
                    />
                  )}
                  <div className="mt-2 space-y-1">
                    {!right && (
                      <p className="text-[12.5px] leading-snug text-rose-600 dark:text-rose-400">
                        <span className="mono-feats font-mono">{chosen === undefined ? '—' : LETTERS[chosen]}</span>{' '}
                        {chosen === undefined ? 'Left blank' : q.a[chosen]}
                      </p>
                    )}
                    <p className="text-[12.5px] leading-snug text-emerald-600 dark:text-emerald-400">
                      <span className="mono-feats font-mono">{LETTERS[q.c]}</span> {q.a[q.c]}
                    </p>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- exam mode */

export function ExamMode() {
  const session = useExam((s) => s.session)!;
  const byId = useExam((s) => s.byId);
  const pool = useExam((s) => s.pool);
  const answerExam = useExam((s) => s.answerExam);
  const finishExam = useExam((s) => s.finishExam);
  const exitExam = useExam((s) => s.exitExam);

  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [confirm, setConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const advanceTimer = useRef<number | undefined>(undefined);

  const total = session.ids.length;
  const answered = Object.keys(session.answers).length;
  const done = session.finishedAt !== null;

  useEffect(() => {
    if (done) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [done]);

  useEffect(() => () => window.clearTimeout(advanceTimer.current), []);

  const snapTo = useCallback(
    (next: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const target = Math.max(0, Math.min(total - 1, next));
      el.scrollTo({ top: target * el.clientHeight, behavior: reduce ? 'auto' : 'smooth' });
    },
    [total, reduce],
  );

  const pick = useCallback(
    (id: string, i: number, at: number) => {
      answerExam(id, i);
      setConfirm(false);
      // Advance after a beat so the pick is visible, and a mis-tap can be seen
      // and swiped back to. Answers stay changeable until submit.
      window.clearTimeout(advanceTimer.current);
      if (at < total - 1) advanceTimer.current = window.setTimeout(() => snapTo(at + 1), 280);
    },
    [answerExam, snapTo, total],
  );

  // Keyboard: arrows / j k move, A–D answer.
  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowdown' || k === 'pagedown' || k === 'j') {
        e.preventDefault();
        snapTo(index + 1);
      } else if (k === 'arrowup' || k === 'pageup' || k === 'k') {
        e.preventDefault();
        snapTo(index - 1);
      } else {
        const p = LETTERS.findIndex((l) => l.toLowerCase() === k);
        const id = session.ids[index];
        if (p >= 0 && id) {
          e.preventDefault();
          pick(id, p, index);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, index, session.ids, snapTo, pick]);

  // Results must sit in the same positioned box as the live exam: returned
  // bare, its absolute inset-0 attached to the app shell instead and slid
  // under the top nav.
  if (done) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-background">
        <Results />
      </div>
    );
  }

  const firstBlank = session.ids.findIndex((id) => session.answers[id] === undefined);
  const meta = poolMeta(pool);

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      {/* header */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-4 pt-3">
        <div className="min-w-0">
          <p className="mono-feats flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <Timer className="size-3" />
            {fmtElapsed(now - session.startedAt)} · pass {meta.passing}/{total}
          </p>
          <h1 className="mt-0.5 truncate text-[16px] font-semibold leading-none text-foreground">
            {meta.name} practice exam
          </h1>
        </div>
        <div className="pointer-events-auto">
          <IconButton variant="outline" onClick={exitExam} label="Quit exam">
            <X />
          </IconButton>
        </div>
      </div>

      {/* progress hairline */}
      <div className="absolute inset-x-0 top-0 z-30 h-[2px] bg-border">
        <div
          className="h-full bg-foreground transition-[width] duration-300 ease-out"
          style={{ width: `${(answered / total) * 100}%` }}
        />
      </div>

      {/* feed */}
      <div
        ref={scrollRef}
        aria-label="Practice exam questions"
        onScroll={(e) => {
          const t = e.currentTarget;
          setIndex(Math.max(0, Math.min(total - 1, Math.round(t.scrollTop / Math.max(1, t.clientHeight)))));
        }}
        className="no-scrollbar absolute inset-0 snap-y snap-mandatory overflow-y-auto overscroll-y-contain"
      >
        {session.ids.map((id, i) => {
          const q = byId[id];
          if (!q) return null;
          if (Math.abs(i - index) > 3) {
            return <div key={id} className="h-full snap-start snap-always" aria-hidden />;
          }
          return (
            <ExamCard
              key={id}
              q={q}
              n={i + 1}
              total={total}
              chosen={session.answers[id]}
              onPick={(c) => pick(id, c, i)}
            />
          );
        })}
      </div>

      {/* submit bar */}
      <div className="absolute inset-x-0 bottom-0 z-30 border-t border-line bg-background/90 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button
            onClick={() => firstBlank >= 0 && snapTo(firstBlank)}
            disabled={firstBlank < 0}
            className="mono-feats min-w-0 flex-1 text-left font-mono text-[11px] text-muted-foreground disabled:cursor-default"
          >
            <span className="text-foreground"><Roll value={answered} /></span>/{total} answered
            {firstBlank >= 0 && answered > 0 && <span className="block text-[10px]">tap to jump to a blank</span>}
          </button>
          <button
            onClick={() => {
              if (answered < total && !confirm) {
                setConfirm(true);
                return;
              }
              finishExam();
            }}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-4 text-[13px] font-medium transition-colors',
              confirm
                ? 'border-rose-500/60 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                : 'border-foreground bg-foreground text-background hover:opacity-90',
            )}
          >
            {confirm ? `Submit with ${total - answered} blank?` : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
