import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../store/store';
import { IconPlay } from './icons';

/** First-run state on the stage: big play control + the core gestures. */
export function StartOverlay() {
  const running = useStore((s) => s.running);
  const start = useStore((s) => s.start);

  return (
    <AnimatePresence>
      {!running && (
        <motion.div
          className="start-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="start-card">
            <motion.button
              className="start-play"
              onClick={start}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.93 }}
              aria-label="Start the simulation"
            >
              <IconPlay />
            </motion.button>
            <div>
              <div className="start-title">Start the simulation</div>
              <div className="start-sub" style={{ marginTop: 5 }}>
                A live RF environment is synthesized in your browser. No hardware, no install.
              </div>
            </div>
            <div className="start-hints">
              <span className="start-hint">
                <span className="kbd">Space</span> play
              </span>
              <span className="start-hint">
                <span className="kbd">Click</span> tune
              </span>
              <span className="start-hint">
                <span className="kbd">Scroll</span> zoom
              </span>
              <span className="start-hint">
                <span className="kbd">↑↓</span> hop signals
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
