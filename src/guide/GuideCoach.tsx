import { useEffect, useLayoutEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, ChevronRight, Crosshair, X } from 'lucide-react';
import { useStore } from '../store/store';
import { lock, ok } from '../ui/kit/haptics';
import { cn } from '@/lib/utils';
import { LESSONS, lessonById, type GuideTarget } from './lessons';
import { guideCtx, useGuide } from './store';
import { challengeById } from '../ctf/challenges';

/** A passing check must hold this long, so sweeping past a setting doesn't count. */
const HOLD_MS = 450;
/** Pause on the green check before moving on, so the success registers. */
const CELEBRATE_MS = 700;

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

/** A pulsing ring around the control the current step needs. */
function Spotlight({ target }: { target: GuideTarget }) {
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
  const pad = 6;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed z-[60] rounded-xl border-2 border-primary"
      style={{ boxShadow: '0 0 0 4px color-mix(in oklch, var(--primary) 22%, transparent)' }}
      initial={{ opacity: 0, scale: 1.08 }}
      animate={
        reduce
          ? { opacity: 1, scale: 1, left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
          : {
              opacity: [1, 0.55, 1],
              scale: 1,
              left: rect.left - pad,
              top: rect.top - pad,
              width: rect.width + pad * 2,
              height: rect.height + pad * 2,
            }
      }
      transition={{
        opacity: reduce ? { duration: 0.2 } : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
        default: { type: 'spring', stiffness: 380, damping: 34 },
      }}
    />
  );
}

/**
 * The walkthrough coach: one card that says what to do, why it works, and
 * moves on by itself when the receiver shows you did it.
 */
export function GuideCoach() {
  const lessonId = useGuide((s) => s.lessonId);
  const step = useGuide((s) => s.step);
  const finishedId = useGuide((s) => s.finishedId);
  const next = useGuide((s) => s.next);
  const quit = useGuide((s) => s.quit);
  const passed = useGuideRunner();
  const [showWhy, setShowWhy] = useState(true);

  const lesson = lessonId ? lessonById(lessonId) : undefined;
  const current = lesson?.steps[step];
  const stepKey = `${lessonId}:${step}`;

  // Re-open the explanation on every new step.
  useEffect(() => setShowWhy(true), [stepKey]);

  return (
    <>
      <AnimatePresence>{current?.target && !passed && <Spotlight key={stepKey} target={current.target} />}</AnimatePresence>
      <div className="pointer-events-none absolute inset-x-2 top-2 z-40 flex justify-center sm:inset-x-auto sm:bottom-4 sm:left-4 sm:top-auto sm:block">
        <AnimatePresence mode="wait">
          {lesson && current && (
            <motion.section
              key="coach"
              role="region"
              aria-label={`Walkthrough: ${lesson.title}`}
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              className="pointer-events-auto w-full max-w-[360px] rounded-2xl border border-line bg-card/95 p-4 shadow-xl backdrop-blur-md"
            >
              <header className="flex items-center gap-2">
                <Crosshair className="size-3.5 text-primary" aria-hidden />
                <span className="mono-feats font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Training · {lesson.title}
                </span>
                <button
                  onClick={quit}
                  aria-label="End walkthrough"
                  className="-mr-1.5 ml-auto grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </header>

              <div className="mt-2 flex gap-1" aria-label={`Step ${step + 1} of ${lesson.steps.length}`}>
                {lesson.steps.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-[3px] flex-1 rounded-full transition-colors duration-300',
                      i < step || (i === step && passed) ? 'bg-primary' : i === step ? 'bg-foreground/40' : 'bg-border',
                    )}
                  />
                ))}
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={stepKey}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}
                  className="mt-3"
                >
                  <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-foreground">
                    <AnimatePresence>
                      {passed && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', bounce: 0.5, duration: 0.4 }}
                          className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"
                        >
                          <Check className="size-3" strokeWidth={3} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {current.title}
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-foreground/90">{current.body}</p>
                  {current.why && (
                    <>
                      <button
                        onClick={() => setShowWhy((v) => !v)}
                        aria-expanded={showWhy}
                        className="mt-2 inline-flex min-h-8 items-center gap-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:hidden"
                      >
                        <ChevronRight className={cn('size-3.5 transition-transform', showWhy && 'rotate-90')} />
                        Why this works
                      </button>
                      <p
                        className={cn(
                          'text-[12.5px] leading-relaxed text-muted-foreground sm:mt-2 sm:block',
                          showWhy ? 'block' : 'hidden',
                        )}
                      >
                        {current.why}
                      </p>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>

              <footer className="mt-3 flex items-center gap-2">
                {current.check ? (
                  <span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
                    <span className="relative flex size-2">
                      {!passed && <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />}
                      <span className="relative inline-flex size-2 rounded-full bg-primary" />
                    </span>
                    {passed ? 'Done' : 'Do it on the receiver'}
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      ok();
                      next();
                    }}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-foreground px-3.5 text-[12.5px] font-medium text-background transition-opacity hover:opacity-90"
                  >
                    Got it <ArrowRight className="size-3.5" />
                  </button>
                )}
                {current.check && !passed && (
                  <button
                    onClick={next}
                    className="ml-auto min-h-8 rounded-md px-2 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Skip step
                  </button>
                )}
              </footer>
            </motion.section>
          )}
          {!lesson && finishedId && <Finished key="finished" id={finishedId} />}
        </AnimatePresence>
      </div>
    </>
  );
}

/** End-of-lesson card: what you learned, and the challenge that tests it. */
function Finished({ id }: { id: string }) {
  const lesson = lessonById(id);
  const start = useGuide((s) => s.start);
  const dismiss = useGuide((s) => s.dismissFinished);
  const openChallenge = useGuide((s) => s.openChallenge);
  if (!lesson) return null;
  const challenge = challengeById(lesson.challengeId);
  const idx = LESSONS.findIndex((l) => l.id === id);
  const upNext = LESSONS[idx + 1];

  return (
    <motion.section
      role="status"
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      className="pointer-events-auto w-full max-w-[360px] rounded-2xl border border-line bg-card/95 p-4 shadow-xl backdrop-blur-md"
    >
      <header className="flex items-center gap-2">
        <span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" strokeWidth={3} />
        </span>
        <span className="mono-feats font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Lesson complete
        </span>
        <button
          onClick={dismiss}
          aria-label="Close"
          className="-mr-1.5 ml-auto grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </header>
      <h3 className="mt-2 text-[15px] font-semibold tracking-tight text-foreground">{lesson.title}</h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">You can now: {lesson.skill.toLowerCase()}.</p>
      <div className="mt-3 flex flex-col gap-2">
        {challenge && (
          <button
            onClick={() => openChallenge(id)}
            className="inline-flex min-h-11 items-center justify-between gap-2 rounded-lg bg-foreground px-3.5 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
          >
            <span>Test it: {challenge.name}</span>
            <span className="mono-feats font-mono text-[11px] opacity-80">+{challenge.points} pts</span>
          </button>
        )}
        {upNext && (
          <button
            onClick={() => start(upNext.id)}
            className="inline-flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border px-3.5 text-[13px] text-foreground transition-colors hover:bg-secondary"
          >
            <span>Next lesson: {upNext.title}</span>
            <ArrowRight className="size-4" />
          </button>
        )}
      </div>
    </motion.section>
  );
}
