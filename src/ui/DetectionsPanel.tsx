import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../store/store';
import { getEngine } from '../engine/engine';
import { nearestGroundTruth } from '../scenarios/scoring';
import type { TrackMsg } from '../engine/protocol';
import { KIND_INFO } from '../sim/signal-kinds';
import { SnrHistory } from './SnrHistory';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function kindColor(track: TrackMsg): string {
  return KIND_INFO[track.guessKind]?.color ?? '#8e8e96';
}

function Metrics() {
  const detections = useStore((s) => s.detections);
  const running = useStore((s) => s.running);
  const strongest = detections.reduce((m, d) => Math.max(m, d.snrDb), -Infinity);
  const items: [string, string][] = [
    ['Tracked', String(detections.length)],
    ['Strongest SNR', strongest === -Infinity ? '—' : `${strongest.toFixed(0)} dB`],
    ['Engine', running ? 'Live' : 'Idle'],
  ];
  return (
    <div className="mb-3 grid grid-cols-3 border border-line">
      {items.map(([label, value], i) => (
        <div
          key={label}
          className={cn('px-3 py-2.5', i > 0 && 'border-l border-line')}
        >
          <div className="mono-feats font-mono text-[8.5px] uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </div>
          <div className="mono-feats mt-0.5 font-mono text-lg leading-none text-foreground">
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

function DetRow({ track }: { track: TrackMsg }) {
  const selectedId = useStore((s) => s.selectedId);
  const tuneToTrack = useStore((s) => s.tuneToTrack);
  const identify = useStore((s) => s.identify);
  const revealTruth = useStore((s) => s.revealTruth);
  const selected = selectedId === track.id;
  const truth = revealTruth
    ? nearestGroundTruth(track.centerFreqHz, track.bandwidthHz, getEngine().groundTruth())
    : null;
  const color = kindColor(track);
  const conf = Math.round(track.guessConfidence * 100);

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'cursor-pointer px-3 py-2.5 transition-colors',
        selected ? 'bg-accent' : 'hover:bg-accent/60',
      )}
      onClick={() => tuneToTrack(track)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') tuneToTrack(track);
      }}
    >
      <div className="flex items-center gap-2.5">
        <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
        <span className="truncate text-[12.5px] font-medium text-foreground">
          {track.guessLabel}
        </span>
        <span className="mono-feats ml-auto font-mono text-[11.5px] text-foreground">
          {(track.centerFreqHz / 1e6).toFixed(4)}
        </span>
      </div>
      <div className="mono-feats mt-1 flex items-center gap-3 pl-[18px] font-mono text-[9.5px] text-muted-foreground">
        <span>SNR {track.snrDb.toFixed(0)} dB</span>
        <span>BW {(track.bandwidthHz / 1000).toFixed(1)} kHz</span>
        <span>{track.duty > 0.7 ? 'continuous' : 'bursty'}</span>
        <Badge variant="secondary" className="mono-feats ml-auto h-4 px-1.5 font-mono text-[9px]">
          {conf}%
        </Badge>
      </div>
      {truth && (
        <div className="mono-feats mt-1.5 pl-[18px] font-mono text-[10px] text-foreground">
          truth: {truth.label}
        </div>
      )}
      <AnimatePresence initial={false}>
        {selected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
            className="overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mt-2.5 border-t border-border pt-2.5">
              <div className="mono-feats mb-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                Identify as
              </div>
              <div className="flex flex-wrap gap-1.5">
                {track.candidates.map((c) => (
                  <button
                    key={c.kind}
                    title={c.reason}
                    onClick={() => identify(track.id, c.kind)}
                    className="mono-feats rounded-md border border-border px-2 py-1 font-mono text-[9.5px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                  >
                    {c.label} {Math.round(c.confidence * 100)}%
                  </button>
                ))}
              </div>
              <SnrHistory trackId={track.id} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function DetectionsPanel() {
  const detections = useStore((s) => s.detections);
  const idFeedback = useStore((s) => s.idFeedback);
  const running = useStore((s) => s.running);
  const sorted = [...detections].sort((a, b) => b.snrDb - a.snrDb);

  return (
    <div>
      <Metrics />
      <AnimatePresence>
        {idFeedback && Date.now() - idFeedback.at < 6000 && (
          <motion.div
            key={idFeedback.at}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={cn(
              'mb-3 rounded-lg border px-3 py-2 text-[12px]',
              idFeedback.correct
                ? 'border-foreground bg-secondary text-foreground'
                : 'border-border bg-card text-muted-foreground',
            )}
          >
            {idFeedback.message}
          </motion.div>
        )}
      </AnimatePresence>
      {sorted.length === 0 ? (
        <div className="px-4 py-10 text-center text-[12px] leading-relaxed text-muted-foreground">
          <b className="block font-medium text-foreground">No emissions detected</b>
          {running
            ? 'The detector is scanning the averaged spectrum. Emissions will appear here as they are found.'
            : 'Start the simulation and the detector will find and classify signals across the band.'}
        </div>
      ) : (
        <div className="divide-y divide-border border-y border-line">
          {sorted.map((t) => (
            <DetRow key={t.id} track={t} />
          ))}
        </div>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Click a signal to tune it. The classifier grades its guess from bandwidth, duty cycle and
        carrier shape. Select a tuned row to grade your own identification.
      </p>
    </div>
  );
}
