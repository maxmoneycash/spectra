import { AnimatePresence, motion } from 'motion/react';
import { Play } from 'lucide-react';
import { useStore } from '../store/store';

/** First-run state on the stage: play control + the core gestures. */
export function StartOverlay() {
  const running = useStore((s) => s.running);
  const start = useStore((s) => s.start);

  return (
    <AnimatePresence>
      {!running && (
        <motion.div
          className="absolute inset-0 z-[8] grid place-items-center bg-stage/60 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="flex max-w-sm flex-col items-center gap-3.5 p-5 text-center">
            <motion.button
              onClick={start}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              aria-label="Start the simulation"
              className="grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
            >
              <Play className="size-5 translate-x-px" strokeWidth={1.75} />
            </motion.button>
            <div>
              <div className="text-[14px] font-medium text-stage-foreground">
                Start the simulation
              </div>
              <div className="mt-1 text-[11.5px] leading-relaxed text-stage-muted">
                A live RF environment is synthesized in your browser. No hardware, no install.
              </div>
            </div>
            <div className="mono-feats flex flex-wrap justify-center gap-x-3.5 gap-y-1.5 font-mono text-[9.5px] text-stage-muted">
              <span>
                <kbd className="rounded border border-stage-border bg-white/5 px-1 py-0.5">Space</kbd>{' '}
                play
              </span>
              <span>
                <kbd className="rounded border border-stage-border bg-white/5 px-1 py-0.5">Click</kbd>{' '}
                tune
              </span>
              <span>
                <kbd className="rounded border border-stage-border bg-white/5 px-1 py-0.5">Scroll</kbd>{' '}
                zoom
              </span>
              <span>
                <kbd className="rounded border border-stage-border bg-white/5 px-1 py-0.5">↑↓</kbd>{' '}
                hop signals
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
