import { AnimatePresence, motion } from 'motion/react';
import { useStore, type PanelTab } from '../store/store';
import { DetectionsPanel } from './DetectionsPanel';
import { SignalLibrary } from './SignalLibrary';
import { ScenarioPanel } from './ScenarioPanel';
import { cn } from '@/lib/utils';

const TABS: { id: PanelTab; label: string }[] = [
  { id: 'signals', label: 'Stations' },
  { id: 'library', label: 'Library' },
  { id: 'scenario', label: 'Mission' },
];

/** Underline tabs shared by the desktop rail and the mobile sheet. */
export function RailTabs({ lineId = 'rail-line' }: { lineId?: string }) {
  const panel = useStore((s) => s.panel);
  const setPanel = useStore((s) => s.setPanel);
  const detections = useStore((s) => s.detections);

  return (
    <div className="flex items-center gap-4" role="tablist" aria-label="Panels">
      {TABS.map((t) => {
        const active = panel === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => setPanel(t.id)}
            className={cn(
              'relative py-2 text-[12.5px] transition-colors',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            {t.id === 'signals' && detections.length > 0 && (
              <sup className="mono-feats ml-1 font-mono text-[9px] text-muted-foreground">
                {detections.length}
              </sup>
            )}
            {active && (
              <motion.span
                layoutId={lineId}
                className="absolute inset-x-0 -bottom-[1px] h-px bg-foreground"
                transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The active panel, with a quick crossfade on tab change. */
export function PanelView({ panel }: { panel: PanelTab }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={panel}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        {panel === 'signals' && <DetectionsPanel />}
        {panel === 'library' && <SignalLibrary />}
        {panel === 'scenario' && <ScenarioPanel />}
      </motion.div>
    </AnimatePresence>
  );
}
