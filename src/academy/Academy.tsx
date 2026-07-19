import { useCallback, useState } from 'react';
import { motion } from 'motion/react';
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
      className="thin-scroll min-h-0 overflow-y-auto bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="mx-auto min-h-full max-w-3xl border-x border-line">
        <section className="screen-line-bottom px-4 py-8 sm:px-6">
          <h1 className="text-2xl font-medium tracking-tight text-foreground">
            The radio spectrum
          </h1>
          <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
            100 kHz to 10 GHz. Scroll to zoom, drag to pan, click a band to inspect it. Bands
            marked ▶ exist live in the simulator.
          </p>
        </section>

        <section className="screen-line-bottom">
          <div className="mono-feats flex items-baseline justify-between border-b border-line px-4 py-2 sm:px-6">
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              Explorer
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              log ν · λ = c/ν
            </span>
          </div>
          <div className="relative h-[320px] bg-stage sm:h-[360px]">
            <LogAxis selectedId={selectedId} onSelect={(b) => setSelectedId(b?.id ?? null)} />
          </div>
        </section>

        <div className="stripe-divider screen-line-bottom" aria-hidden />

        <section className="screen-line-bottom px-4 py-6 sm:px-6">
          <Inspector band={selected} onPick={setSelectedId} onTune={openInSimulator} />
        </section>

        <section className="px-4 py-6 sm:px-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-medium tracking-tight text-foreground">Concepts</h2>
            <span className="mono-feats font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              5 lessons · live demos
            </span>
          </div>
          <Lessons onTune={openInSimulator} />
        </section>
      </div>
    </motion.div>
  );
}
