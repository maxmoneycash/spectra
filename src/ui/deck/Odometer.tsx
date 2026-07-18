import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * Rolling-digit readout. Each character position keeps a fixed 1ch cell;
 * when the character changes, the new one slides up and the old one out.
 */
export function Odometer({ text }: { text: string }) {
  const reduce = useReducedMotion();
  return (
    <span style={{ display: 'inline-flex' }} aria-label={text} role="text">
      {text.split('').map((ch, i) => (
        <span key={i} className={`odo-cell ${ch === '.' ? 'narrow' : ''}`} aria-hidden="true">
          {reduce ? (
            <span className="odo-char">{ch}</span>
          ) : (
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={ch}
                className="odo-char"
                initial={{ y: '58%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '-58%', opacity: 0 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              >
                {ch}
              </motion.span>
            </AnimatePresence>
          )}
        </span>
      ))}
    </span>
  );
}
