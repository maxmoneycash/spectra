import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Power, GraduationCap } from 'lucide-react';
import { useStore } from '../store/store';
import { lock } from './kit/haptics';
import { useGuide } from '../guide/store';
import { LESSONS } from '../guide/lessons';

const canHover = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
    : true;

/**
 * The receiver before it's switched on. One big power control, a line on
 * what you're about to see, and a way into the guided walkthrough for anyone
 * who has never touched a radio. Keyboard hints only appear where there is a
 * keyboard to use them.
 */
export function StartOverlay() {
  const running = useStore((s) => s.running);
  const start = useStore((s) => s.start);
  const inLesson = useGuide((s) => s.lessonId !== null);
  const startLesson = useGuide((s) => s.start);
  const reduce = useReducedMotion();
  const hover = canHover();

  return (
    <AnimatePresence>
      {!running && (
        <motion.div
          className="absolute inset-0 z-[8] grid place-items-center bg-stage/70 backdrop-blur-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
        >
          <div className="flex max-w-xs flex-col items-center px-6 text-center">
            <div className="relative grid size-24 place-items-center">
              {/* idle carrier rings — the receiver is waiting for power */}
              {!reduce &&
                [0, 1].map((i) => (
                  <motion.span
                    key={i}
                    aria-hidden
                    className="absolute inset-0 rounded-full border border-stage-foreground/25"
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: [0.7, 1.25], opacity: [0.5, 0] }}
                    transition={{ duration: 2.4, repeat: Infinity, delay: i * 1.2, ease: 'easeOut' }}
                  />
                ))}
              <motion.button
                onClick={() => {
                  lock();
                  void start();
                }}
                whileTap={{ scale: 0.92 }}
                data-guide="power"
                aria-label="Power on the receiver"
                className="relative grid size-[72px] place-items-center rounded-full bg-stage-foreground text-stage shadow-[0_10px_40px_-8px_rgba(0,0,0,0.6)] outline-none ring-offset-2 ring-offset-stage focus-visible:ring-2 focus-visible:ring-stage-foreground"
              >
                <Power className="size-7" strokeWidth={2.2} />
              </motion.button>
            </div>
            <p className="mt-5 text-[15px] font-semibold tracking-tight text-stage-foreground">Power on the receiver</p>
            {!inLesson && (
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-stage-muted">
                A live radio band is synthesized right here. Tap a signal on the waterfall to lock onto it and listen.
              </p>
            )}
            {!inLesson && (
            <button
              onClick={() => startLesson(LESSONS[0].id)}
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full border border-stage-border px-4 text-[12px] font-medium text-stage-foreground/90 transition-colors hover:bg-stage-foreground/5"
            >
              <GraduationCap className="size-4" />
              New to radio? Start the first walkthrough
            </button>
            )}
            {hover && !inLesson && (
              <div className="mono-feats mt-5 flex flex-wrap justify-center gap-x-3.5 gap-y-1.5 font-mono text-[9.5px] text-stage-muted">
                {[
                  ['Space', 'power'],
                  ['Click', 'lock on'],
                  ['Scroll', 'zoom'],
                  ['↑↓', 'next signal'],
                ].map(([k, v]) => (
                  <span key={k}>
                    <kbd className="rounded border border-stage-border bg-stage-foreground/5 px-1 py-0.5">{k}</kbd> {v}
                  </span>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
