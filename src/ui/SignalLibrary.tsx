import { motion } from 'motion/react';
import { useStore } from '../store/store';
import {
  ALL_KINDS,
  FAMILY_LABEL,
  KIND_INFO,
  familyOf,
  type SignalFamily,
} from '../sim/signal-kinds';
import { fmtMHz } from './format';
import { familyColor } from './signalColor';
import { GroupLabel } from './controls';
import { Plus } from 'lucide-react';

const FAMILIES: SignalFamily[] = ['voice', 'data', 'spread'];

export function SignalLibrary() {
  const injectSignal = useStore((s) => s.injectSignal);
  const running = useStore((s) => s.running);
  const recordings = useStore((s) => s.recordings);

  return (
    <div>
      {recordings.length > 0 && (
        <>
          <div className="mb-2 flex items-baseline gap-2">
            <span className="text-[13px] font-medium text-foreground">Captures</span>
            <span className="mono-feats font-mono text-[9.5px] text-muted-foreground">
              {recordings.length} saved
            </span>
          </div>
          <div className="mb-4 divide-y divide-border border-y border-line">
            {recordings.map((r) => (
              <div key={r.name} className="mono-feats flex items-baseline gap-2 py-1.5 font-mono text-[10px] text-muted-foreground">
                <span className="truncate text-foreground">{r.name}</span>
                <span className="ml-auto shrink-0">
                  {fmtMHz(r.centerFreqHz)} MHz · {r.durationSec.toFixed(0)}s
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-[13px] font-medium text-foreground">Signal library</span>
        <span className="mono-feats font-mono text-[9.5px] text-muted-foreground">
          {ALL_KINDS.length} types
        </span>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
        An interactive field guide. Inject a signal into the live band to see its waterfall
        signature and hear it demodulated.
      </p>

      {/* Grouped by family. The headers double as the legend for the family
          colors used on the spectrum and in the Stations list. */}
      <div className="space-y-4">
        {FAMILIES.map((family) => {
          const kinds = ALL_KINDS.filter((k) => familyOf(k) === family);
          return (
            <section key={family} aria-label={FAMILY_LABEL[family]}>
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-[3px]"
                  style={{ background: `var(--sig-${family})` }}
                />
                <GroupLabel>{FAMILY_LABEL[family]}</GroupLabel>
                <span className="mono-feats ml-auto font-mono text-[10px] text-muted-foreground">
                  {kinds.length}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
                {kinds.map((kind) => {
                  const info = KIND_INFO[kind];
                  const i = ALL_KINDS.indexOf(kind);
                  return (
                    <motion.button
                      key={kind}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: Math.min(i * 0.025, 0.2) }}
                      className="group relative flex flex-col items-start gap-1 bg-background p-3 text-left transition-colors hover:bg-accent disabled:opacity-50"
                      disabled={!running}
                      onClick={() => injectSignal(kind)}
                      title={running ? `Inject ${info.label} into the band` : 'Start the simulation first'}
                    >
                      <span className="flex w-full items-center gap-2">
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-[3px]"
                          style={{ background: familyColor(kind) }}
                        />
                        <span className="truncate text-[12px] font-medium text-foreground">
                          {info.label}
                        </span>
                        <Plus className="ml-auto size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </span>
                      <span className="mono-feats font-mono text-[9px] text-muted-foreground">
                        {info.bandwidthHz >= 1000
                          ? `${(info.bandwidthHz / 1000).toFixed(0)} kHz`
                          : `${info.bandwidthHz} Hz`}{' '}
                        · {info.category}
                      </span>
                      <span className="line-clamp-2 text-[10.5px] leading-snug text-muted-foreground">
                        {info.waterfall}
                      </span>
                    </motion.button>
                  );
                })}
                {/* Odd counts would leave a hairline-colored hole in the grid. */}
                {kinds.length % 2 === 1 && <div aria-hidden className="bg-background" />}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
