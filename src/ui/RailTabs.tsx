import { AnimatePresence, motion } from 'framer-motion';
import { useStore, type PanelTab } from '../store/store';
import { DetectionsPanel } from './DetectionsPanel';
import { SignalLibrary } from './SignalLibrary';
import { ScenarioPanel } from './ScenarioPanel';

const TABS: { id: PanelTab; label: string }[] = [
  { id: 'signals', label: 'Stations' },
  { id: 'library', label: 'Library' },
  { id: 'scenario', label: 'Mission' },
];

/** Segmented tab control shared by the desktop rail and the mobile sheet. */
export function RailTabs({ pillId }: { pillId: string }) {
  const panel = useStore((s) => s.panel);
  const setPanel = useStore((s) => s.setPanel);
  const detections = useStore((s) => s.detections);

  return (
    <div className="segctl" role="tablist" aria-label="Panels">
      {TABS.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={panel === t.id}
          className={`seg-item ${panel === t.id ? 'active' : ''}`}
          onClick={() => setPanel(t.id)}
        >
          {panel === t.id && (
            <motion.span
              layoutId={pillId}
              className="seg-pill"
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            />
          )}
          <span>{t.label}</span>
          {t.id === 'signals' && detections.length > 0 && (
            <span className="seg-count">{detections.length}</span>
          )}
        </button>
      ))}
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
