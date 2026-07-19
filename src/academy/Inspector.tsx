import { motion, AnimatePresence } from 'motion/react';
import { Play } from 'lucide-react';
import { BANDS, fmtAxisFreq, fmtWavelength, type AcademyBand } from './data';
import { Button } from '@/components/ui/button';

const SIM_BANDS = BANDS.filter((b) => b.scenarioId);

export function Inspector({
  band,
  onPick,
  onTune,
}: {
  band: AcademyBand | null;
  onPick: (id: string) => void;
  onTune: (scenarioId: string) => void;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {band ? (
        <motion.div
          key={band.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.16 }}
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[15px] font-medium text-foreground">{band.name}</span>
            <span className="mono-feats font-mono text-[10.5px] text-muted-foreground">
              {fmtAxisFreq(band.fStartHz)} – {fmtAxisFreq(band.fEndHz)}
            </span>
            <span className="mono-feats font-mono text-[10.5px] text-foreground">
              λ {fmtWavelength((band.fStartHz + band.fEndHz) / 2)}
            </span>
          </div>
          <p className="mt-2.5 max-w-prose text-[12.5px] leading-relaxed text-muted-foreground">
            {band.summary}
          </p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="mono-feats font-mono text-[8.5px] uppercase tracking-[0.14em] text-muted-foreground">
                Who is here
              </dt>
              <dd className="mt-1 text-[12px] leading-relaxed text-foreground">{band.services}</dd>
            </div>
            <div>
              <dt className="mono-feats font-mono text-[8.5px] uppercase tracking-[0.14em] text-muted-foreground">
                Propagation
              </dt>
              <dd className="mt-1 text-[12px] leading-relaxed text-foreground">
                {band.propagation}
              </dd>
            </div>
          </dl>
          {band.scenarioId && (
            <Button onClick={() => onTune(band.scenarioId!)} className="mt-4 gap-1.5" size="sm">
              <Play className="size-3.5" />
              Tune the simulator here
            </Button>
          )}
        </motion.div>
      ) : (
        <motion.div
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <span className="text-[15px] font-medium text-foreground">Pick a band</span>
          <p className="mt-2 max-w-prose text-[12.5px] leading-relaxed text-muted-foreground">
            Every frequency has an owner and a job. Click any block above to see who lives there
            and how the waves behave. These bands exist inside SPECTRA's simulator:
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SIM_BANDS.map((b) => (
              <button
                key={b.id}
                onClick={() => onPick(b.id)}
                className="mono-feats rounded-md border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
              >
                ▶ {b.name}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
