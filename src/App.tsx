import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useStore } from './store/store';
import { Academy } from './academy/Academy';
import { ExamView } from './exam/ExamView';
import { CtfView } from './ctf/CtfView';
import { TopBar } from './ui/TopBar';
import { SpectrumWaterfall } from './ui/SpectrumWaterfall';
import { StartOverlay } from './ui/StartOverlay';
import { OnAirCaption } from './ui/OnAirCaption';
import { ReceiverDeck } from './ui/deck/ReceiverDeck';
import { MobileDeck } from './ui/deck/MobileDeck';
import { useMediaQuery } from './hooks/useMediaQuery';
import { RailTabs, PanelView } from './ui/RailTabs';
import { PanelSheet } from './ui/PanelSheet';
import { StatusBar } from './ui/StatusBar';
import { BottomNav } from './ui/shell/BottomNav';
import { useHotkeys } from './hooks/useHotkeys';
import { useUrlSync } from './hooks/useUrlSync';
import { OperatorCard } from './ui/OperatorCard';
import { OgCardCapture } from './ui/card/OgCardCapture';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

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
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      style={{ transformOrigin: 'top right' }}
      className="fixed right-3 top-[3.75rem] z-[60] w-64 rounded-xl border border-border bg-popover p-3.5 text-popover-foreground shadow-xl"
    >
      <div className="mb-2 text-[13px] font-medium">Keyboard shortcuts</div>
      {SHORTCUTS.map((s) => (
        <div key={s.what} className="flex items-center gap-2 py-1 text-[11.5px] text-muted-foreground">
          <span>{s.what}</span>
          <span className="flex-1" />
          {s.keys.map((k, i) => (
            <kbd
              key={i}
              className="mono-feats rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[9.5px] text-secondary-foreground shadow-[0_1.5px_0_0_var(--color-border)]"
            >
              {k}
            </kbd>
          ))}
        </div>
      ))}
      <div className="mt-2 border-t border-border pt-2 text-[10.5px] text-muted-foreground">
        Click the frequency to open the tuner.
      </div>
    </motion.div>
  );
}

export function App() {
  const panel = useStore((s) => s.panel);
  const view = useStore((s) => s.view);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const wide = useMediaQuery('(min-width: 1024px)');
  const toggleKeys = useCallback(() => setKeysOpen((o) => !o), []);
  useHotkeys(toggleKeys);
  useUrlSync();

  // Dev-only capture route for the site OG image (scripts/make-og.mjs).
  if (new URLSearchParams(window.location.search).get('ogcard') === '1') {
    return <OgCardCapture />;
  }

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={300}>
        <div className="grid h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] bg-background">
          <TopBar onOpenPanels={() => setSheetOpen(true)} onToggleKeys={toggleKeys} />
          <main className="min-h-0 min-w-0">
            {view === 'console' ? (
              <div className="flex h-full min-h-0 flex-col">
                <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_360px] max-lg:grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_380px]">
                  <div className="relative min-h-0 min-w-0 overflow-hidden bg-stage">
                    <SpectrumWaterfall />
                    <OnAirCaption />
                    <StartOverlay />
                  </div>
                  <aside
                    aria-label="Inspector"
                    className="flex min-h-0 flex-col border-l border-line bg-background max-lg:hidden"
                  >
                    <div className="border-b border-line px-3 pt-3">
                      <RailTabs />
                    </div>
                    <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-3">
                      <PanelView panel={panel} />
                    </div>
                  </aside>
                </div>
                {wide ? <ReceiverDeck /> : <MobileDeck />}
                <div className="max-lg:hidden">
                  <StatusBar />
                </div>
              </div>
            ) : view === 'exam' ? (
              <ExamView />
            ) : view === 'ctf' ? (
              <CtfView />
            ) : (
              <Academy />
            )}
          </main>
          <BottomNav />
          <OperatorCard />
          <PanelSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
          <AnimatePresence>
            {keysOpen && <KeysPop onClose={() => setKeysOpen(false)} />}
          </AnimatePresence>
        </div>
        <Toaster position="bottom-right" gap={8} />
      </TooltipProvider>
    </MotionConfig>
  );
}
