import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Check, GraduationCap, Lightbulb, Flag, RotateCcw, Radio, Trophy, Share2 } from 'lucide-react';
import { useCtf, score, rankFor, shareText } from './store';
import { CHALLENGES, CATEGORY_LABEL, challengeById, toSceneSpec, type Challenge } from './challenges';
import { useStore } from '../store/store';
import { BottomSheet } from '@/ui/BottomSheet';
import { IconButton } from '@/ui/controls';
import { cn } from '@/lib/utils';
import { LESSONS } from '../guide/lessons';
import { useGuide } from '../guide/store';

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
        <span className="mono-feats mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {CATEGORY_LABEL[c.category]}
        </span>
      </span>
      <span
        className={cn(
          'mono-feats shrink-0 font-mono text-[11px]',
          solve ? 'text-emerald-500' : 'text-muted-foreground',
        )}
      >
        {solve ? `+${solve.points}` : c.points}
      </span>
    </button>
  );
}


/** Live receiver state + what the CW decoder is copying this second. */
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
        Receiver
        <span className="flex-1" />
        <span>{((centerFreqHz + tuningOffsetHz) / 1e6).toFixed(4)} MHz</span>
        <span>{mode.toUpperCase()}</span>
        <span>{bandwidthHz >= 1000 ? `${(bandwidthHz / 1000).toFixed(1)}k` : `${bandwidthHz}`}</span>
      </div>
      <p
        className="mono-feats mt-2 min-h-[2.2em] break-all font-mono text-[12px] leading-snug text-foreground"
        aria-live="polite"
        aria-label="Live decoder copy"
      >
        {copy || (
          <span className="text-muted-foreground">
            {running
              ? mode === 'cw'
                ? 'listening…'
                : 'switch to CW to copy a keyed signal'
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

  if (!c) return <BottomSheet open={false} onClose={onClose} title="Challenge">{null}</BottomSheet>;

  return (
    <BottomSheet open={!!id} onClose={onClose} title={c.name}>
      <div className="space-y-4 px-4 pb-4">
        <div className="flex items-center gap-2">
          <span className="mono-feats rounded-full border border-border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">
            {CATEGORY_LABEL[c.category]}
          </span>
          <span className="mono-feats font-mono text-[10px] text-muted-foreground">
            {c.points} pts
          </span>
          {solve && (
            <span className="mono-feats ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-emerald-500">
              <Check className="size-3" strokeWidth={3} /> solved +{solve.points}
            </span>
          )}
        </div>

        <p className="text-[13px] leading-relaxed text-foreground">{c.brief}</p>

        {(() => {
          // Point back to the walkthrough that teaches this skill, until it's done.
          const lesson = LESSONS.find((l) => l.challengeId === c.id);
          if (!lesson || lessonsDone.includes(lesson.id) || solve) return null;
          return (
            <button
              onClick={() => {
                onClose();
                startLesson(lesson.id);
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-line px-3 text-left transition-colors hover:bg-secondary"
            >
              <GraduationCap className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-muted-foreground">
                New to this? Practice it first: <span className="text-foreground">{lesson.title}</span> · {lesson.minutes} min
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })()}

        {(c.category === 'intercept' || c.category === 'decode') && <InterceptStrip />}

        <div className="rounded-lg border border-line bg-background p-3">
          <p className="mono-feats font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">
            Answer format
          </p>
          <p className="mono-feats mt-1 font-mono text-[12px] text-foreground">{c.answerHint}</p>
        </div>

        {/* Hints, revealed one at a time and priced in points. */}
        <div className="space-y-2">
          {c.hints.slice(0, hintsUsed).map((h, i) => (
            <p
              key={i}
              className="rounded-lg border border-line bg-card p-3 text-[12px] leading-relaxed text-muted-foreground"
            >
              {h}
            </p>
          ))}
          {!solve && hintsUsed < c.hints.length && (
            <button
              onClick={() => takeHint(c.id)}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Lightbulb className="size-4" />
              Take a hint <span className="opacity-70">(−15%)</span>
            </button>
          )}
        </div>

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
              placeholder="Flag or value"
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
                'text-[12px]',
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
  const rank = rankFor(s.points);
  const [copied, setCopied] = useState(false);

  const onShare = async () => {
    const text = shareText(solved);
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

  /** Open a challenge: load its RF scene into the live engine, then the sheet. */
  const open = (id: string) => {
    const c = challengeById(id);
    if (!c) return;
    const s = useStore.getState();
    s.loadSpec(toSceneSpec(c), { name: c.name, tag: 'tasking', from: 'ctf' });
    // Fresh receiver per challenge: a squelch someone lowered earlier would
    // otherwise solve "Below the Gate" before it starts.
    s.setSquelch(-80);
    setActive(id);
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
              <p className="mono-feats font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Capture the flag
              </p>
              <h1 className="mt-0.5 text-[19px] font-semibold tracking-tight text-foreground">
                RF CTF
              </h1>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                Ten signals problems, solved on the live receiver. Every answer is graded against
                the simulator's ground truth — no hardware, no server, nothing to install.
              </p>
            </div>
            <IconButton label="Reset progress" onClick={reset}>
              <RotateCcw />
            </IconButton>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-border">
            {[
              { k: 'Score', v: `${s.points}` },
              { k: 'Solved', v: `${s.solvedCount}/${s.total}` },
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
              Open the console to work a signal
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
            <h2 className="mono-feats border-b border-line bg-background px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:px-6">
              {CATEGORY_LABEL[cat as keyof typeof CATEGORY_LABEL]}
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
