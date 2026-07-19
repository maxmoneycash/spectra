import { motion } from 'motion/react';
import { useStore } from '../store/store';
import { ALL_KINDS, KIND_INFO } from '../sim/signal-kinds';
import { fmtMHz } from './format';
import { Plus } from 'lucide-react';

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

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
        {ALL_KINDS.map((kind, i) => {
          const info = KIND_INFO[kind];
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
                <span className="size-2 shrink-0 rounded-[3px]" style={{ background: info.color }} />
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
      </div>
    </div>
  );
}
