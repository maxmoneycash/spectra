import { ArrowRight, Check, Play } from 'lucide-react';
import { motion } from 'motion/react';
import { useCtf } from '../ctf/store';
import { challengeById } from '../ctf/challenges';
import { GroupLabel } from '../ui/controls';
import { tick } from '../ui/kit/haptics';
import { cn } from '@/lib/utils';
import { LESSONS } from './lessons';
import { useGuide } from './store';

/**
 * Basic training: the walkthroughs in order, each paired with the Tasking
 * challenge that tests the same skill for points.
 */
export function WalkthroughList() {
  const completed = useGuide((s) => s.completed);
  const start = useGuide((s) => s.start);
  const solved = useCtf((s) => s.solved);

  const doneCount = LESSONS.filter((l) => completed.includes(l.id)).length;
  const upNext = LESSONS.find((l) => !completed.includes(l.id));
  const totalMin = LESSONS.reduce((n, l) => n + l.minutes, 0);

  return (
    <div className="thin-scroll h-full overflow-y-auto">
      <div className="mx-auto min-h-full max-w-2xl border-x border-line">
        <section className="screen-line-bottom px-4 py-5 sm:px-6">
          <GroupLabel>Basic training</GroupLabel>
          <h1 className="mt-1.5 text-[19px] font-semibold tracking-tight text-foreground">
            Learn the receiver by using it
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            Seven short walkthroughs on the live receiver. Each one teaches a skill on a practice band, then
            hands you a Tasking challenge that tests it for points.
          </p>

          <div className="mt-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={false}
                animate={{ width: `${(doneCount / LESSONS.length) * 100}%` }}
                transition={{ type: 'spring', stiffness: 200, damping: 30 }}
              />
            </div>
            <span className="mono-feats shrink-0 font-mono text-[11px] text-muted-foreground">
              {doneCount}/{LESSONS.length}
            </span>
          </div>

          {upNext && (
            <button
              onClick={() => {
                tick();
                start(upNext.id);
              }}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-foreground px-4 text-left text-background transition-opacity hover:opacity-90 sm:w-auto"
            >
              <span className="flex items-center gap-2.5">
                <Play className="size-4" fill="currentColor" />
                <span className="text-[13.5px] font-medium">
                  {doneCount === 0 ? 'Start training' : 'Continue'}: {upNext.title}
                </span>
              </span>
              <ArrowRight className="size-4 opacity-70" />
            </button>
          )}
        </section>

        <h2 className="mono-feats flex items-baseline justify-between border-b border-line bg-background px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:px-6">
          <span>Walkthroughs · {LESSONS.length}</span>
          <span>~{totalMin} min</span>
        </h2>

        <ol>
          {LESSONS.map((lesson, i) => {
            const isDone = completed.includes(lesson.id);
            const isNext = lesson.id === upNext?.id;
            const challenge = challengeById(lesson.challengeId);
            const challengeSolved = challenge ? Boolean(solved[challenge.id]) : false;
            return (
              <li key={lesson.id} className="border-b border-line">
                <button
                  onClick={() => {
                    tick();
                    start(lesson.id);
                  }}
                  className={cn(
                    'flex w-full items-start gap-3.5 px-4 py-3.5 text-left transition-colors sm:px-6',
                    isNext ? 'bg-accent/60 hover:bg-accent' : 'hover:bg-accent/50',
                  )}
                >
                  <span
                    className={cn(
                      'mono-feats mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border font-mono text-[11px]',
                      isDone
                        ? 'border-primary bg-primary text-primary-foreground'
                        : isNext
                          ? 'border-foreground text-foreground'
                          : 'border-border text-muted-foreground',
                    )}
                  >
                    {isDone ? <Check className="size-3.5" strokeWidth={3} /> : String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="text-[14px] font-medium text-foreground">{lesson.title}</span>
                      {isNext && (
                        <span className="mono-feats font-mono text-[9.5px] uppercase tracking-[0.14em] text-primary">
                          Up next
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">{lesson.skill}</span>
                    {challenge && (
                      <span className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                        <ArrowRight className="size-3" />
                        Then: {challenge.name}
                        <span className={cn('mono-feats font-mono', challengeSolved ? 'text-primary' : '')}>
                          {challengeSolved ? '· solved' : `· +${challenge.points} pts`}
                        </span>
                      </span>
                    )}
                  </span>
                  <span className="mono-feats mt-1 shrink-0 font-mono text-[11px] text-muted-foreground">
                    {lesson.minutes} min
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <p className="px-4 py-5 text-[12px] leading-relaxed text-muted-foreground sm:px-6">
          Walkthroughs run on their own practice bands, so finishing one never gives away a Tasking answer.
        </p>
      </div>
    </div>
  );
}
