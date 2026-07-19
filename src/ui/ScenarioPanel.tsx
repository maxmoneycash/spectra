import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, IdCard } from 'lucide-react';
import { useStore } from '../store/store';
import { SCENARIOS, scenarioById } from '../scenarios/scenarios';
import { evaluateObjectives } from '../scenarios/scoring';
import { cn } from '@/lib/utils';

export function ScenarioPanel() {
  const scenarioId = useStore((s) => s.scenarioId);
  const loadScenario = useStore((s) => s.loadScenario);
  const detections = useStore((s) => s.detections);
  const tuningOffsetHz = useStore((s) => s.tuningOffsetHz);
  const mode = useStore((s) => s.mode);
  const morseText = useStore((s) => s.morseText);
  const correctlyIdentified = useStore((s) => s.correctlyIdentified);

  const active = scenarioById(scenarioId)!;
  const done = evaluateObjectives(active, {
    tracks: detections,
    tuningOffsetHz,
    mode,
    morseText,
    correctlyIdentified: new Set(correctlyIdentified),
  });
  const total = active.objectives.length;
  const doneCount = done.filter(Boolean).length;
  const complete = total > 0 && done.every(Boolean);
  const recordMission = useStore((s) => s.recordMission);
  const setCardOpen = useStore((s) => s.setCardOpen);

  useEffect(() => {
    if (complete) recordMission(active.id);
  }, [complete, active.id, recordMission]);

  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-[13px] font-medium text-foreground">{active.name}</span>
        <span className="mono-feats font-mono text-[9.5px] text-muted-foreground">
          {active.band}
        </span>
      </div>
      <p className="text-[11.5px] text-muted-foreground">{active.tagline}</p>
      <p className="mt-2.5 rounded-lg border border-line bg-card p-3 text-[11.5px] leading-relaxed text-muted-foreground">
        {active.brief}
      </p>

      {total > 0 && (
        <>
          <div className="mt-3 flex items-center gap-2.5">
            <div className="h-[2px] flex-1 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-foreground transition-[width] duration-500 ease-out"
                style={{ width: `${(doneCount / total) * 100}%` }}
              />
            </div>
            <span className="mono-feats font-mono text-[10px] text-muted-foreground">
              {doneCount}/{total}
            </span>
          </div>
          <div className="mt-2 divide-y divide-border border-b border-line">
            {active.objectives.map((o, i) => (
              <div key={i} className="flex items-start gap-2.5 py-2">
                <span
                  className={cn(
                    'mt-0.5 grid size-4 shrink-0 place-items-center rounded-[4px] border',
                    done[i] ? 'border-foreground bg-foreground text-background' : 'border-border',
                  )}
                >
                  <AnimatePresence>
                    {done[i] && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', bounce: 0.45, duration: 0.4 }}
                      >
                        <Check className="size-3" strokeWidth={2.5} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <span
                  className={cn(
                    'text-[12px] leading-snug',
                    done[i] ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {o.label}
                </span>
              </div>
            ))}
          </div>
          <AnimatePresence>
            {complete && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', bounce: 0.25, duration: 0.5 }}
                className="mt-3 rounded-lg border border-foreground bg-secondary p-3.5 text-center"
              >
                <div className="text-[12px] font-semibold tracking-[0.08em] text-foreground">
                  MISSION COMPLETE
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  All objectives met. Try a harder scenario.
                </div>
                <button
                  onClick={() => setCardOpen(true)}
                  className="mono-feats mx-auto mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-foreground bg-foreground px-2.5 py-1 font-mono text-[10px] text-background transition-opacity hover:opacity-85"
                >
                  <IdCard className="size-3.5" /> Share your operator card
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <div className="mb-2 mt-5 flex items-baseline gap-2">
        <span className="text-[13px] font-medium text-foreground">All missions</span>
      </div>
      <div className="divide-y divide-border border-y border-line">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => loadScenario(s.id)}
            className={cn(
              'flex w-full items-start gap-3 px-1 py-2.5 text-left transition-colors',
              s.id === scenarioId ? 'bg-accent' : 'hover:bg-accent/60',
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium text-foreground">
                {s.name}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                {s.tagline}
              </span>
            </span>
            <span className="mono-feats mt-0.5 shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-wide text-muted-foreground">
              {s.difficulty}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
