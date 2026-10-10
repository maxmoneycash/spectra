import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Check, GraduationCap, Flag, RotateCcw, Radio, Trophy, Share2, Unlock } from 'lucide-react';
import { useCtf, score, shareText } from './store';
import { useProgression } from '../progression/progression';
import { CHALLENGES, CATEGORY_LABEL, challengeById, type Challenge } from './challenges';
import { openMission } from './open';
import { useStore } from '../store/store';
import { BottomSheet } from '@/ui/BottomSheet';
import { IconButton, GroupLabel } from '@/ui/controls';
import { cn } from '@/lib/utils';
import { LESSONS } from '../guide/lessons';
import { useGuide } from '../guide/store';

const mhz = (hz: number) => `${(hz / 1e6).toFixed(3)} MHz`;

/** One mission row: status, name, band and mode, bounty. */
function Row({ c, onOpen }: { c: Challenge; onOpen: (id: string) => void }) {
  const solve = useCtf((s) => s.solved[c.id]);
  return (
    <button
      onClick={() => onOpen(c.id)}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60 sm:px-6',
        solve && 'bg-accent/30',
      )}
    >
      <span
        className={cn(
          'mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border',
          solve ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-500' : 'border-border text-muted-foreground',
        )}
      >
        {solve ? <Check className="size-3.5" strokeWidth={3} /> : <Flag className="size-3" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-foreground">{c.name}</span>
        <span className="mono-feats mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className={solve ? 'text-emerald-500' : 'text-foreground/70'}>{solve ? 'Captured' : 'Open'}</span>
          <span aria-hidden>·</span>
          <span className="normal-case tracking-normal">{mhz(c.centerFreqHz)}</span>
          {c.suggest && (
            <>
              <span aria-hidden>·</span>
              <span>{c.suggest}</span>
            </>
          )}
        </span>
      </span>
      <span
        className={cn(
          'mono-feats shrink-0 font-mono text-[11px]',
          solve ? 'text-emerald-500' : 'text-muted-foreground',
        )}
      >
        {solve ? `+${solve.points}` : `+${c.points}`}
      </span>
    </button>
  );
}

/** Live receiver state plus what the CW decoder is copying this second. */
function InterceptStrip() {
  const centerFreqHz = useStore((s) => s.centerFreqHz);
  const tuningOffsetHz = useStore((s) => s.tuningOffsetHz);
  const mode = useStore((s) => s.mode);
  const bandwidthHz = useStore((s) => s.bandwidthHz);
  const morseText = useStore((s) => s.morseText);
  const running = useStore((s) => s.running);
  const copy = morseText.slice(-44);

  return (
    <div className="rounded-lg border border-line bg-background p-3">
      <div className="mono-feats flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
        <span className={cn('size-1.5 rounded-full', running ? 'bg-emerald-500' : 'bg-border')} />
        RX
        <span className="flex-1" />
        <span className="normal-case">{((centerFreqHz + tuningOffsetHz) / 1e6).toFixed(4)} MHz</span>
        <span>{mode.toUpperCase()}</span>
        <span className="normal-case">
          {bandwidthHz >= 1000 ? `${(bandwidthHz / 1000).toFixed(1)} kHz` : `${bandwidthHz} Hz`}
        </span>
      </div>
      <p
        className="mono-feats mt-2 min-h-[2.2em] break-all font-mono text-[12px] leading-snug text-foreground"
        aria-live="polite"
        aria-label="Live decoder copy"
      >
        {copy ? (
          <>
            {copy}
            <span className="ml-0.5 inline-block h-[1.1em] w-[0.55em] translate-y-[2px] animate-pulse bg-foreground/80" aria-hidden />
          </>
        ) : (
          <span className="text-muted-foreground">
            {running
              ? mode === 'cw'
                ? 'awaiting keyed traffic…'
                : 'switch to CW to copy keyed traffic'
              : 'receiver stopped'}
          </span>
        )}
      </p>
    </div>
  );
}

function ChallengeSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const c = id ? challengeById(id) : null;
  const solve = useCtf((s) => (id ? s.solved[id] : undefined));
  const hintsUsed = useCtf((s) => (id ? (s.hints[id] ?? 0) : 0));
  const takeHint = useCtf((s) => s.takeHint);
  const submit = useCtf((s) => s.submit);
  const verdict = useCtf((s) => s.verdict);
  const checking = useCtf((s) => s.checking);
  const [answer, setAnswer] = useState('');
  const lessonsDone = useGuide((s) => s.completed);
  const startLesson = useGuide((s) => s.start);

  useEffect(() => setAnswer(''), [id]);

  if (!c) return <BottomSheet open={false} onClose={onClose} title="Mission">{null}</BottomSheet>;

  const idx = CHALLENGES.findIndex((x) => x.id === c.id);
  const lesson = LESSONS.find((l) => l.challengeId === c.id);
  const needsTraining = lesson && !lessonsDone.includes(lesson.id) && !solve;

  return (
    <BottomSheet open={!!id} onClose={onClose} title={`Tasking ${String(idx + 1).padStart(2, '0')}`}>
      <div className="space-y-4 px-4 pb-4">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-foreground">{c.name}</h2>
          <div className="mono-feats mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <span>{CATEGORY_LABEL[c.category]}</span>
            <span aria-hidden>·</span>
            <span className="normal-case tracking-normal">{mhz(c.centerFreqHz)}</span>
            {c.suggest && (
              <>
                <span aria-hidden>·</span>
                <span>{c.suggest}</span>
              </>
            )}
            <span aria-hidden>·</span>
            <span className="text-foreground">+{c.points}</span>
            {solve && (
              <span className="inline-flex items-center gap-1 text-emerald-500">
                <Check className="size-3" strokeWidth={3} /> captured +{solve.points}
              </span>
            )}
          </div>
        </div>

        <section>
          <GroupLabel>Situation</GroupLabel>
          <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">{c.brief}</p>
        </section>

        {needsTraining && (
          <button
            onClick={() => {
              onClose();
              startLesson(lesson.id);
            }}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-line px-3 text-left transition-colors hover:bg-secondary"
          >
            <GraduationCap className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-muted-foreground">
              Not yet trained on this. Run the walkthrough first:{' '}
              <span className="text-foreground">{lesson.title}</span> · {lesson.minutes} min
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        )}

        {(c.category === 'intercept' || c.category === 'decode') && <InterceptStrip />}

        <section className="rounded-lg border border-line bg-background p-3">
          <GroupLabel>Deliverable</GroupLabel>
          <p className="mono-feats mt-1 font-mono text-[12px] text-foreground">{c.answerHint}</p>
        </section>

        {/* Intel: declassified one item at a time, priced in points. */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <GroupLabel>Intel</GroupLabel>
            <span className="mono-feats font-mono text-[10px] text-muted-foreground">
              {hintsUsed}/{c.hints.length} released
            </span>
          </div>
          {c.hints.slice(0, hintsUsed).map((h, i) => (
            <p
              key={i}
              className="rounded-lg border border-line bg-card p-3 text-[12px] leading-relaxed text-muted-foreground"
            >
              <span className="mono-feats mr-2 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/70">
                {String(i + 1).padStart(2, '0')}
              </span>
              {h}
            </p>
          ))}
          {!solve && hintsUsed < c.hints.length && (
            <button
              onClick={() => takeHint(c.id)}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Unlock className="size-4" />
              Declassify next <span className="mono-feats font-mono opacity-70">−15%</span>
            </button>
          )}
        </section>

        {!solve && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(c.id, answer);
            }}
            className="flex gap-2"
          >
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="flag"
              spellCheck={false}
              autoComplete="off"
              aria-label="Your answer"
              className="mono-feats min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 font-mono text-[13px] text-foreground outline-none focus:border-ring"
            />
            <button
              type="submit"
              disabled={checking || !answer.trim()}
              className="min-h-11 shrink-0 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-40"
            >
              {checking ? '…' : 'Submit'}
            </button>
          </form>
        )}

        <AnimatePresence>
          {verdict?.id === c.id && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                'mono-feats font-mono text-[12px]',
                verdict.ok ? 'text-emerald-500' : 'text-muted-foreground',
              )}
            >
              {verdict.msg}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </BottomSheet>
  );
}

export function CtfView() {
  const solved = useCtf((s) => s.solved);
  const activeId = useCtf((s) => s.activeId);
  const setActive = useCtf((s) => s.setActive);
  const reset = useCtf((s) => s.reset);
  const setView = useStore((s) => s.setView);

  const s = useMemo(() => score(solved), [solved]);
  const { rank } = useProgression();
  const [copied, setCopied] = useState(false);

  const onShare = async () => {
    const text = shareText(solved, undefined, rank);
    try {
      // Native share on phones; clipboard everywhere else.
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // User dismissed the share sheet, or the clipboard was refused.
    }
  };

  /** Open a mission: load its RF scene into the live engine, then the sheet. */
  /** Open a mission: load its RF scene into the live engine, then the sheet. */
  const open = (id: string) => {
    openMission(id);
  };

  const byCategory = useMemo(() => {
    const groups = new Map<string, Challenge[]>();
    for (const c of CHALLENGES) {
      const list = groups.get(c.category) ?? [];
      list.push(c);
      groups.set(c.category, list);
    }
    return [...groups.entries()];
  }, []);

  return (
    <div className="thin-scroll h-full overflow-y-auto">
      <div className="mx-auto min-h-full max-w-2xl border-x border-line">
        <header className="border-b border-line px-4 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <GroupLabel>Tasking</GroupLabel>
              <h1 className="mt-0.5 text-[19px] font-semibold tracking-tight text-foreground">
                Intercept missions
              </h1>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                {s.total} missions, worked on the live receiver. Every flag is graded against the
                simulator&rsquo;s ground truth: the copy is the proof you did it right.
              </p>
            </div>
            <IconButton label="Reset progress" onClick={reset}>
              <RotateCcw />
            </IconButton>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-border">
            {[
              { k: 'Score', v: `${s.points}` },
              { k: 'Captured', v: `${s.solvedCount}/${s.total}` },
              { k: 'Rank', v: rank },
            ].map((cell) => (
              <div key={cell.k} className="bg-card px-3 py-2.5">
                <p className="mono-feats font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  {cell.k}
                </p>
                <p className="mt-0.5 truncate text-[15px] font-medium text-foreground">{cell.v}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-border">
            <motion.div
              className="h-full rounded-full bg-foreground"
              animate={{ width: `${s.pct}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => setView('console')}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Radio className="size-4" />
              Open the receiver
            </button>
            {s.solvedCount > 0 && (
              <button
                onClick={onShare}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {copied ? <Check className="size-4 text-emerald-500" /> : <Share2 className="size-4" />}
                {copied ? 'Copied' : 'Share result'}
              </button>
            )}
          </div>
        </header>

        {byCategory.map(([cat, list]) => (
          <section key={cat}>
            <h2 className="mono-feats flex items-baseline justify-between border-b border-line bg-background px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:px-6">
              <span>{CATEGORY_LABEL[cat as keyof typeof CATEGORY_LABEL]}</span>
              <span>
                {list.filter((c) => solved[c.id]).length}/{list.length}
              </span>
            </h2>
            <div className="divide-y divide-border border-b border-line">
              {list.map((c) => (
                <Row key={c.id} c={c} onOpen={open} />
              ))}
            </div>
          </section>
        ))}

        {s.solvedCount === s.total && (
          <div className="m-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-center">
            <Trophy className="mx-auto size-6 text-emerald-500" />
            <p className="mt-2 text-[15px] font-semibold text-foreground">All flags captured</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {s.points} points · {rank}
            </p>
          </div>
        )}
      </div>

      <ChallengeSheet id={activeId} onClose={() => setActive(null)} />
    </div>
  );
}
