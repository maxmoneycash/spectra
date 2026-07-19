import { useCallback, useState } from 'react';
import { motion } from 'motion/react';
import { useStore } from '../store/store';
import { BANDS } from './data';
import { LogAxis } from './LogAxis';
import { Inspector } from './Inspector';
import { Lessons } from './Lessons';
import { CourseView } from './course/CourseView';
import { ReferenceView } from './course/ReferenceView';
import { cn } from '@/lib/utils';

type AcademyTab = 'explorer' | 'course' | 'reference';

const TABS: { id: AcademyTab; label: string }[] = [
  { id: 'explorer', label: 'Explorer' },
  { id: 'course', label: 'Course' },
  { id: 'reference', label: 'Reference' },
];

function ExplorerView({ onTune }: { onTune: (scenarioId: string) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = BANDS.find((b) => b.id === selectedId) ?? null;

  return (
    <div className="thin-scroll h-full overflow-y-auto">
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
          <Inspector band={selected} onPick={setSelectedId} onTune={onTune} />
        </section>

        <section className="px-4 py-6 sm:px-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-medium tracking-tight text-foreground">Concepts</h2>
            <span className="mono-feats font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              5 lessons · live demos
            </span>
          </div>
          <Lessons onTune={onTune} />
        </section>
      </div>
    </div>
  );
}

/**
 * RF Academy — explorer, course (The Radio Bench curriculum), reference
 * (glossary + widget playground). Everything hands off into the simulator.
 */
export function Academy() {
  const [tab, setTab] = useState<AcademyTab>('explorer');

  const openInSimulator = useCallback((scenarioId: string) => {
    const s = useStore.getState();
    if (scenarioId !== s.scenarioId) s.loadScenario(scenarioId);
    s.setView('console');
    if (!s.running) void s.start();
  }, []);

  return (
    <motion.div
      className="flex min-h-0 flex-col bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center gap-4 border-b border-line px-4 sm:px-6">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cn(
                'relative py-2.5 text-[12.5px] transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              {active && (
                <motion.span
                  layoutId="academy-line"
                  className="absolute inset-x-0 -bottom-[1px] h-px bg-foreground"
                  transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                />
              )}
            </button>
          );
        })}
        <span className="flex-1" />
        <a
          href="https://github.com/jemcik/the-radio-bench"
          target="_blank"
          rel="noreferrer"
          className="mono-feats hidden font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground sm:inline"
        >
          Course: The Radio Bench · MIT
        </a>
      </div>

      <div className="min-h-0 flex-1">
        {tab === 'explorer' && <ExplorerView onTune={openInSimulator} />}
        {tab === 'course' && (
          <div className="h-full">
            <CourseView onTune={openInSimulator} />
          </div>
        )}
        {tab === 'reference' && (
          <div className="thin-scroll h-full overflow-y-auto">
            <ReferenceView />
          </div>
        )}
      </div>
    </motion.div>
  );
}
