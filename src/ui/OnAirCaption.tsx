import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useStore, type OnAir } from '@/store/store';

/** Linger after the carrier drops so the last line can be finished. */
const LINGER_MS = 1600;

/**
 * Live transcript of whoever the receiver is tuned to. The full sentence is
 * shown so it can be read along, with each word lighting up as it's spoken
 * — the closest thing to a radio operator looking over your shoulder.
 */
export function OnAirCaption() {
  const onAir = useStore((s) => s.onAir);
  const running = useStore((s) => s.running);
  const centerFreqHz = useStore((s) => s.centerFreqHz);
  const tuningOffsetHz = useStore((s) => s.tuningOffsetHz);
  const bandwidthHz = useStore((s) => s.bandwidthHz);
  const reduce = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());

  const tuned = centerFreqHz + tuningOffsetHz;
  const current: (OnAir & { id: string }) | null = useMemo(() => {
    if (!running) return null;
    let best: (OnAir & { id: string }) | null = null;
    for (const [id, t] of Object.entries(onAir)) {
      if (t.until + LINGER_MS < now) continue;
      if (Math.abs(tuned - t.freqHz) > Math.max(1500, bandwidthHz / 2)) continue;
      if (!best || t.startedAt > best.startedAt) best = { ...t, id };
    }
    return best;
  }, [onAir, now, tuned, bandwidthHz, running]);

  // Tick only while something is (or was just) on air.
  useEffect(() => {
    const live = Object.values(onAir).some((t) => t.until + LINGER_MS > Date.now());
    if (!live) return;
    const t = window.setInterval(() => setNow(Date.now()), 90);
    return () => window.clearInterval(t);
  }, [onAir]);

  const words = useMemo(() => (current ? current.text.split(/\s+/) : []), [current]);
  const keyed = current ? now < current.until : false;
  const spoken = current ? Math.max(0, Math.min(1, (now - current.startedAt) / Math.max(1, current.until - 350 - current.startedAt))) : 0;
  const lit = keyed ? Math.ceil(spoken * words.length) : words.length;

  return (
    <div data-stage-ui className="pointer-events-none absolute inset-x-3 bottom-3 z-[9] flex justify-center">
      <AnimatePresence>
        {current && (
          <motion.div
            key={`${current.id}-${current.startedAt}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduce ? 0 : 6 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="w-full max-w-xl rounded-2xl border border-white/10 bg-black/65 px-3.5 py-2.5 text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)] backdrop-blur-md"
          >
            <div className="mono-feats flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.14em]">
              <span className="relative flex size-2">
                {keyed && !reduce && <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/70" />}
                <span className={keyed ? 'relative size-2 rounded-full bg-rose-500' : 'relative size-2 rounded-full bg-white/30'} />
              </span>
              <span className={keyed ? 'text-rose-300' : 'text-white/50'}>{keyed ? 'On air' : 'Clear'}</span>
              <span className="font-semibold text-white">{current.who}</span>
              <span className="ml-auto normal-case tabular-nums text-white/55">{(current.freqHz / 1e6).toFixed(4)} MHz</span>
            </div>
            <p className="mt-1 text-[13.5px] leading-snug">
              {words.map((w, i) => (
                <span key={i} className={i < lit ? 'text-white transition-colors duration-150' : 'text-white/35'}>
                  {w}{' '}
                </span>
              ))}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
