import { useEffect, useLayoutEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, ChevronRight, X } from 'lucide-react';
import { useStore } from '../store/store';
import { lock, ok } from '../ui/kit/haptics';
import { utcStamp } from '../ui/kit/time';
import { GroupLabel } from '../ui/controls';
import { cn } from '@/lib/utils';
import { LESSONS, lessonById, type GuideTarget } from './lessons';
import { guideCtx, useGuide } from './store';
import { challengeById } from '../ctf/challenges';

/** A passing check must hold this long, so sweeping past a setting doesn't count. */
const HOLD_MS = 450;
/** Pause on the confirmation before moving on, so it registers. */
const CELEBRATE_MS = 800;

/**
 * Watches the receiver and advances the active lesson when the current step's
 * check holds. Mounted once, in the console.
 */
function useGuideRunner() {
  const lessonId = useGuide((s) => s.lessonId);
  const step = useGuide((s) => s.step);
  const [passed, setPassed] = useState(false);

  useEffect(() => {
    setPassed(false);
    const lesson = lessonId ? lessonById(lessonId) : undefined;
    const check = lesson?.steps[step]?.check;
    if (!lesson || !check) return;

    let holdTimer: number | undefined;
    let advanceTimer: number | undefined;
    let done = false;

    const evaluate = () => {
      if (done) return;
      const pass = check(guideCtx(useGuide.getState().baseIntercepts));
      if (pass && holdTimer === undefined) {
        holdTimer = window.setTimeout(() => {
          done = true;
          setPassed(true);
          lock();
          advanceTimer = window.setTimeout(() => useGuide.getState().next(), CELEBRATE_MS);
        }, HOLD_MS);
      } else if (!pass && holdTimer !== undefined) {
        window.clearTimeout(holdTimer);
        holdTimer = undefined;
      }
    };

    evaluate();
    const unsub = useStore.subscribe(evaluate);
    return () => {
      unsub();
      window.clearTimeout(holdTimer);
      window.clearTimeout(advanceTimer);
    };
  }, [lessonId, step]);

  return passed;
}

/**
 * The most prominent visible element tagged with this guide target. Several
 * controls can share a target (the header play button and the big power
 * button on the start screen); the larger one is the one to point at.
 */
function findTarget(t: GuideTarget): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestArea = 0;
  for (const el of document.querySelectorAll<HTMLElement>(`[data-guide="${t}"]`)) {
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    if (area > bestArea && el.offsetParent !== null) {
      best = el;
      bestArea = area;
    }
  }
  return best;
}

/**
 * Target brackets around the control the current step needs: the same four
 * corners the waterfall closes on a locked signal, so "the thing to operate"
 * and "the thing you locked" share one mark.
 */
function Reticle({ target }: { target: GuideTarget }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    let last = '';
    const measure = () => {
      const el = findTarget(target);
      const r = el?.getBoundingClientRect() ?? null;
      const key = r ? `${r.x | 0},${r.y | 0},${r.width | 0},${r.height | 0}` : '';
      if (key !== last) {
        last = key;
        setRect(r);
      }
    };
    measure();
    // Layout shifts constantly (deck pages, sheets, resizes); a light poll keeps up.
    const id = window.setInterval(measure, 250);
    window.addEventListener('resize', measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', measure);
    };
  }, [target]);

  if (!rect) return null;
  const pad = 8;
  const corner = 'absolute size-3 border-tuned';
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed z-[60]"
      initial={{ opacity: 0, scale: 1.35 }}
      animate={{
        opacity: 1,
        scale: 1,
        left: rect.left - pad,
        top: rect.top - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }}
      exit={{ opacity: 0, scale: 1.15 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
    >
      <motion.div
        className="absolute inset-0"
        animate={reduce ? { opacity: 1 } : { opacity: [1, 0.45, 1] }}
        transition={reduce ? { duration: 0.2 } : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className={`${corner} left-0 top-0 border-l-2 border-t-2`} />
        <span className={`${corner} right-0 top-0 border-r-2 border-t-2`} />
        <span className={`${corner} bottom-0 left-0 border-b-2 border-l-2`} />
        <span className={`${corner} bottom-0 right-0 border-b-2 border-r-2`} />
      </motion.div>
      <motion.span
        className="absolute inset-0 bg-tuned/15"
        initial={{ opacity: 0.9 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
    </motion.div>
  );
}

const panelClass =
  'pointer-events-auto w-full max-w-[360px] overflow-hidden rounded-md border border-line bg-card/95 shadow-xl backdrop-blur-md';
const panelMotion = {
  initial: { opacity: 0, y: -8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.98 },
  transition: { type: 'spring', stiffness: 420, damping: 36 },
} as const;

/**
 * The walkthrough coach, run as tasking: one directive at a time, the
 * tradecraft behind it, and a confirmation stamped off the station clock
 * when the receiver shows you did it.
 */
export function GuideCoach({ docked = false }: { docked?: boolean }) {
  const lessonId = useGuide((s) => s.lessonId);
  const step = useGuide((s) => s.step);
  const finishedId = useGuide((s) => s.finishedId);
  const next = useGuide((s) => s.next);
  const quit = useGuide((s) => s.quit);
  const passed = useGuideRunner();
  const [showWhy, setShowWhy] = useState(false);
  const [stamp, setStamp] = useState<string | null>(null);
  const [log, setLog] = useState<{ title: string; stamp: string } | null>(null);

  const lesson = lessonId ? lessonById(lessonId) : undefined;
  const current = lesson?.steps[step];
  const stepKey = `${lessonId}:${step}`;
  const nn = lesson ? String(LESSONS.findIndex((l) => l.id === lesson.id) + 1).padStart(2, '0') : '';

  // Phone explanations expand on demand, leaving room to operate the radio.
  // Desktop keeps the explanation visible through the responsive styles below.
  useEffect(() => setShowWhy(false), [stepKey]);
  useEffect(() => setLog(null), [lessonId]);

  // Stamp the confirmation the moment the check holds.
  useEffect(() => {
    if (passed && current) {
      const t = utcStamp();
      setStamp(t);
      setLog({ title: current.title, stamp: t });
    } else {
      setStamp(null);
    }
    // `current` changes with stepKey, which is what we want to key on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passed, stepKey]);

  return (
    <>
      <AnimatePresence>{current?.target && !passed && <Reticle key={stepKey} target={current.target} />}</AnimatePresence>
      <div className={docked
        ? 'thin-scroll relative z-40 max-h-[36dvh] shrink-0 overflow-y-auto'
        : 'pointer-events-none absolute bottom-4 left-4 z-40'}>
        <AnimatePresence mode="wait">
          {lesson && current && (
            <motion.section key="coach" role="region" aria-label={`Tasking: ${lesson.title}`} {...panelMotion} className={cn(panelClass, docked && 'max-w-none rounded-none border-x-0 border-t-0 shadow-none')}>
              <header className="flex items-center gap-2 border-b border-line px-3.5 py-1 lg:py-2">
                <span className="size-1.5 shrink-0 rounded-full bg-tuned" aria-hidden />
                <span className="mono-feats truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Tasking · {nn} {lesson.title}
                </span>
                <span
                  className="mono-feats ml-auto shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
                  aria-label={`Step ${step + 1} of ${lesson.steps.length}`}
                >
                  Step {step + 1}/{lesson.steps.length}
                </span>
                <button
                  onClick={quit}
                  aria-label="End tasking"
                  className="-mr-1.5 grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:size-7"
                >
                  <X className="size-3.5" />
                </button>
              </header>
              <div className="h-[2px] w-full bg-border" aria-hidden>
                <motion.div
                  className="h-full bg-tuned"
                  initial={false}
                  animate={{ width: `${((step + (passed ? 1 : 0)) / lesson.steps.length) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 220, damping: 30 }}
                />
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={stepKey}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}
                  className="px-3.5 py-2 lg:py-3"
                >
                  <h3 className="text-[15px] font-semibold tracking-tight text-foreground">{current.title}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-foreground/90">{current.body}</p>
                  {current.why && (
                    <>
                      <div className={cn('lg:mt-2.5 lg:block', showWhy ? 'block' : 'hidden')}>
                        <GroupLabel className="hidden lg:block">Tradecraft</GroupLabel>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{current.why}</p>
                      </div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>

              <footer className="flex items-center gap-2 border-t border-line px-3.5 lg:py-2">
                {current.why && !passed && (
                  <button
                    onClick={() => setShowWhy((v) => !v)}
                    aria-expanded={showWhy}
                    className="inline-flex min-h-11 items-center gap-1 text-muted-foreground transition-colors hover:text-foreground lg:hidden"
                  >
                    <ChevronRight className={cn('size-3.5 transition-transform', showWhy && 'rotate-90')} />
                    <GroupLabel className="text-inherit">Tradecraft</GroupLabel>
                  </button>
                )}
                {current.check ? (
                  <span
                    className={cn(
                      'mono-feats inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em]',
                      !passed && current.why ? 'hidden lg:inline-flex' : 'min-h-11 lg:min-h-0',
                      passed ? 'text-emerald-500' : 'text-muted-foreground',
                    )}
                  >
                    {passed ? (
                      <>
                        <Check className="size-3.5" strokeWidth={3} />
                        Confirmed {stamp}
                      </>
                    ) : (
                      <>
                        <span className="relative flex size-2">
                          <span className="absolute inline-flex size-full animate-ping rounded-full bg-tuned/60" />
                          <span className="relative inline-flex size-2 rounded-full bg-tuned" />
                        </span>
                        Awaiting RX
                      </>
                    )}
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      ok();
                      next();
                    }}
                    className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-md bg-foreground px-3 text-[12.5px] font-medium text-background transition-opacity hover:opacity-90 lg:ml-0 lg:min-h-9"
                  >
                    Acknowledge <ArrowRight className="size-3.5" />
                  </button>
                )}
                {current.check && !passed && (
                  <button
                    onClick={next}
                    className="mono-feats ml-auto min-h-11 rounded-md px-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground lg:min-h-8"
                  >
                    Skip
                  </button>
                )}
              </footer>

              {log && !passed && (
                <p className="mono-feats hidden truncate border-t border-dashed border-line px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80 lg:block">
                  {log.stamp} · Confirmed · {log.title}
                </p>
              )}
            </motion.section>
          )}
          {!lesson && finishedId && <Finished key="finished" id={finishedId} docked={docked} />}
        </AnimatePresence>
      </div>
    </>
  );
}

/** End-of-lesson card: skill confirmed, and the mission that tests it. */
function Finished({ id, docked }: { id: string; docked: boolean }) {
  const lesson = lessonById(id);
  const start = useGuide((s) => s.start);
  const dismiss = useGuide((s) => s.dismissFinished);
  const openChallenge = useGuide((s) => s.openChallenge);
  if (!lesson) return null;
  const challenge = challengeById(lesson.challengeId);
  const idx = LESSONS.findIndex((l) => l.id === id);
  const upNext = LESSONS[idx + 1];

  return (
    <motion.section role="status" {...panelMotion} className={cn(panelClass, docked && 'max-w-none rounded-none border-x-0 border-t-0 shadow-none')}>
      <header className="flex items-center gap-2 border-b border-line px-3.5 py-2">
        <span className="grid size-4 place-items-center rounded-full bg-emerald-500 text-background">
          <Check className="size-2.5" strokeWidth={3.5} />
        </span>
        <span className="mono-feats font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Collection complete · {utcStamp()}
        </span>
        <button
          onClick={dismiss}
          aria-label="Close"
          className="-mr-1.5 ml-auto grid size-11 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:size-7"
        >
          <X className="size-3.5" />
        </button>
      </header>
      <div className="px-3.5 pb-3.5 pt-3">
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">{lesson.title}</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          Skill confirmed: {lesson.skill.charAt(0).toLowerCase() + lesson.skill.slice(1)}.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {challenge && (
            <button
              onClick={() => openChallenge(id)}
              className="inline-flex min-h-11 items-center justify-between gap-2 rounded-md bg-foreground px-3.5 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
            >
              <span>Cleared for: {challenge.name}</span>
              <span className="mono-feats font-mono text-[11px] opacity-80">+{challenge.points}</span>
            </button>
          )}
          {upNext && (
            <button
              onClick={() => start(upNext.id)}
              className="inline-flex min-h-11 items-center justify-between gap-2 rounded-md border border-border px-3.5 text-[13px] text-foreground transition-colors hover:bg-secondary"
            >
              <span>Next tasking: {upNext.title}</span>
              <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </motion.section>
  );
}
