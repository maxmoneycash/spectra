import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store/store';
import { BANDS } from './data';
import { LogAxis } from './LogAxis';
import { Inspector } from './Inspector';
import { Lessons } from './Lessons';

/**
 * RF Academy — a zoomable tour of the radio spectrum that hands you off
 * into the live simulator wherever the band exists inside SPECTRA.
 */
export function Academy() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = BANDS.find((b) => b.id === selectedId) ?? null;

  const openInSimulator = useCallback((scenarioId: string) => {
    const s = useStore.getState();
    if (scenarioId !== s.scenarioId) s.loadScenario(scenarioId);
    s.setView('console');
    if (!s.running) void s.start();
  }, []);

  return (
    <motion.div
      className="academy"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div className="academy-head">
        <div className="academy-title">The radio spectrum, 100 kHz to 10 GHz</div>
        <div className="academy-sub">
          Scroll to zoom, drag to pan, click a band to inspect it. Bands marked ▶ exist live in the
          simulator.
        </div>
      </div>
      <div className="academy-axis">
        <LogAxis selectedId={selectedId} onSelect={(b) => setSelectedId(b?.id ?? null)} />
      </div>
      <div className="academy-rail">
        <Inspector band={selected} onPick={setSelectedId} onTune={openInSimulator} />
        <Lessons onTune={openInSimulator} />
      </div>
    </motion.div>
  );
}
