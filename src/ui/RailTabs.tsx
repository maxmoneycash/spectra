import { AnimatePresence, motion } from 'motion/react';
import { useStore, type PanelTab } from '../store/store';
import { DetectionsPanel } from './DetectionsPanel';
import { SignalLibrary } from './SignalLibrary';
import { ScenarioPanel } from './ScenarioPanel';
import { UnderlineTabs } from './controls';

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
    <UnderlineTabs
      items={TABS.map((t) => (t.id === 'signals' ? { ...t, badge: detections.length } : t))}
      value={panel}
      onChange={setPanel}
      layoutId={lineId}
      ariaLabel="Panels"
      touch
    />
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
