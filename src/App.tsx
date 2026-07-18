import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useStore } from './store/store';
import { Academy } from './academy/Academy';
import { TopBar } from './ui/TopBar';
import { SpectrumWaterfall } from './ui/SpectrumWaterfall';
import { StartOverlay } from './ui/StartOverlay';
import { ReceiverDeck } from './ui/deck/ReceiverDeck';
import { RailTabs, PanelView } from './ui/RailTabs';
import { PanelSheet } from './ui/PanelSheet';
import { StatusBar } from './ui/StatusBar';
import { useHotkeys } from './hooks/useHotkeys';

const SHORTCUTS: { keys: string[]; what: string }[] = [
  { keys: ['Space'], what: 'Start / stop the simulation' },
  { keys: ['←', '→'], what: 'Nudge tuning 2.5 kHz' },
  { keys: ['Shift', '←', '→'], what: 'Coarse tune 25 kHz' },
  { keys: ['↑', '↓'], what: 'Hop between detected signals' },
  { keys: ['M'], what: 'Cycle demod mode' },
  { keys: ['R'], what: 'Record I/Q (SigMF export)' },
  { keys: ['?'], what: 'Toggle this panel' },
];

function KeysPop({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      className="keys-pop"
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      style={{ transformOrigin: 'top right' }}
    >
      <div className="keys-title">Keyboard shortcuts</div>
      {SHORTCUTS.map((s) => (
        <div className="keys-row" key={s.what}>
          <span>{s.what}</span>
          {s.keys.map((k, i) => (
            <span className="kbd" key={i}>
              {k}
            </span>
          ))}
        </div>
      ))}
      <div className="keys-row" style={{ marginTop: 8, color: 'var(--text-faint)' }}>
        Click the VFO readout to type a frequency.
      </div>
    </motion.div>
  );
}

export function App() {
  const panel = useStore((s) => s.panel);
  const view = useStore((s) => s.view);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const toggleKeys = useCallback(() => setKeysOpen((o) => !o), []);
  useHotkeys(toggleKeys);

  return (
    <MotionConfig reducedMotion="user">
      <div className="app">
        <TopBar onOpenPanels={() => setSheetOpen(true)} onToggleKeys={toggleKeys} />
        {view === 'console' ? (
          <>
            <div className="main">
              <div className="stage">
                <SpectrumWaterfall />
                <StartOverlay />
              </div>
              <aside className="rail" aria-label="Inspector">
                <div className="rail-tabs">
                  <RailTabs pillId="rail-pill" />
                </div>
                <div className="rail-body">
                  <PanelView panel={panel} />
                </div>
              </aside>
            </div>
            <ReceiverDeck />
          </>
        ) : (
          <Academy />
        )}
        <StatusBar />
        <PanelSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
        <AnimatePresence>{keysOpen && <KeysPop onClose={() => setKeysOpen(false)} />}</AnimatePresence>
      </div>
    </MotionConfig>
  );
}
