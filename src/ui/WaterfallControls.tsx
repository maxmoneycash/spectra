import { useEffect, useRef, useState, type RefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../store/store';
import { COLORMAPS } from './colormaps';
import { Fader } from './deck/Fader';

/** Floating display controls: zoom readout, colormap, auto-level, dB range. */
export function WaterfallControls({
  onAuto,
  zoomLabelRef,
}: {
  onAuto: () => void;
  zoomLabelRef: RefObject<HTMLDivElement>;
}) {
  const cmapIndex = useStore((s) => s.cmapIndex);
  const setCmap = useStore((s) => s.setCmap);
  const floorDb = useStore((s) => s.floorDb);
  const ceilDb = useStore((s) => s.ceilDb);
  const setDbRange = useStore((s) => s.setDbRange);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div className="wf-controls" ref={rootRef} onPointerDown={(e) => e.stopPropagation()}>
      <div ref={zoomLabelRef} className="wfc-zoom" />
      <button
        className="wfc-btn"
        title="Cycle colormap"
        onClick={() => setCmap((cmapIndex + 1) % COLORMAPS.length)}
      >
        {COLORMAPS[cmapIndex].name}
      </button>
      <button className="wfc-btn" title="Auto-level the dB range" onClick={onAuto}>
        Auto
      </button>
      <button
        className={`wfc-btn ${open ? 'on' : ''}`}
        title="Waterfall dB floor / ceiling"
        onClick={() => setOpen((o) => !o)}
      >
        Levels
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="wf-pop"
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            style={{ transformOrigin: 'bottom right' }}
          >
            <Fader
              name="Floor"
              value={floorDb}
              min={-120}
              max={ceilDb - 5}
              step={1}
              fmt={(v) => `${v} dB`}
              onChange={(v) => setDbRange(v, ceilDb)}
            />
            <Fader
              name="Ceiling"
              value={ceilDb}
              min={floorDb + 5}
              max={0}
              step={1}
              fmt={(v) => `${v} dB`}
              onChange={(v) => setDbRange(floorDb, v)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
