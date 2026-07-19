import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

/**
 * Rolling-digit readout. Each character position keeps a fixed 1ch cell;
 * when the character changes, the new one slides up and the old one out.
 */
export function Odometer({ text }: { text: string }) {
  const reduce = useReducedMotion();
  return (
    <span className="inline-flex" aria-label={text} role="text">
      {text.split('').map((ch, i) => (
        <span
          key={i}
          className={cn('inline-block w-[1ch] overflow-hidden text-center', ch === '.' && 'w-[0.55ch]')}
          aria-hidden="true"
        >
          {reduce ? (
            <span className="inline-block">{ch}</span>
          ) : (
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={ch}
                className="inline-block will-change-transform"
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
