import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, ChevronUp, Radio, X } from 'lucide-react';
import { useStore } from '../store/store';
import type { TrackMsg } from '../engine/protocol';
import { KIND_INFO, type SignalKind } from '../sim/signal-kinds';
import { fmtBw, fmtMHz } from './format';
import { tick, ok, bad } from './kit/haptics';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '../hooks/useMediaQuery';

/** How long a correct/incorrect verdict stays on the card. */
const VERDICT_MS = 6000;

function infoFor(label: string) {
  return Object.values(KIND_INFO).find((k) => k.label === label);
}

/**
 * Tap a signal, and it explains itself: what it is, whether you're hearing it
 * in the right mode, what's being said on it, and a chance to confirm the
 * machine's identification — the analyst's job.
 */
export function SignalCard() {
  const selectedId = useStore((s) => s.selectedId);
  const detections = useStore((s) => s.detections);
  const selectTrack = useStore((s) => s.selectTrack);

  // Bursty signals drop out of the detection list between bursts; keep the
  // last snapshot on screen so the card doesn't vanish mid-read.
  const live = useMemo(() => detections.find((d) => d.id === selectedId) ?? null, [detections, selectedId]);
  const [snapshot, setSnapshot] = useState<TrackMsg | null>(null);
  useEffect(() => {
    if (live) setSnapshot(live);
    else if (!selectedId) setSnapshot(null);
  }, [live, selectedId]);

  const track = live ?? snapshot;

  // A phone stage is ~390px tall: open as a one-line bar, expand on demand.
  const wide = useMediaQuery('(min-width: 640px)');
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [selectedId]);
  const compact = !wide && !expanded;
  // On wide screens, sit on the side away from the signal you tapped. The
  // left side shares the stage with the walkthrough coach, so cap it there.
  const onLeft = Boolean(track && track.offsetHz > 0);
  const side = onLeft ? 'sm:left-3' : 'sm:right-3';

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-2 z-[15] flex flex-col justify-end sm:inset-auto sm:bottom-3 sm:top-3 sm:w-80 sm:justify-start',
        side,
      )}
    >
      <AnimatePresence>
        {track && selectedId && (
          <Card
            key={track.id}
            track={track}
            lost={!live}
            compact={compact}
            onExpand={() => setExpanded(true)}
            onCollapse={wide ? undefined : () => setExpanded(false)}
            capped={onLeft}
            onClose={() => selectTrack(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Card({
  track,
  lost,
  compact,
  onExpand,
  onCollapse,
  capped,
  onClose,
}: {
  track: TrackMsg;
  lost: boolean;
  compact: boolean;
  capped: boolean;
  onExpand: () => void;
  onCollapse?: () => void;
  onClose: () => void;
}) {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const identify = useStore((s) => s.identify);
  const idFeedback = useStore((s) => s.idFeedback);
  const onAir = useStore((s) => s.onAir);
  const [more, setMore] = useState(false);
  const [answered, setAnswered] = useState<SignalKind | null>(null);

  const info = infoFor(track.guessLabel);
  const wants = info?.recommendedDemod;
  const modeMatches = !wants || wants === mode;
  const pct = Math.round(track.guessConfidence * 100);
  const bursty = track.duty < 0.6;

  // What's being said on this signal right now, if it carries speech.
  const now = Date.now();
  const speech = Object.values(onAir).find(
    (a) => a.until > now && Math.abs(a.freqHz - track.centerFreqHz) <= Math.max(track.bandwidthHz / 2, 6000),
  );

  const verdict = idFeedback && answered && now - idFeedback.at < VERDICT_MS ? idFeedback : null;
  useEffect(() => {
    if (!verdict) return;
    if (verdict.correct) ok();
    else bad();
  }, [verdict]);

  if (compact) {
    return (
      <motion.section
        role="dialog"
        aria-label={`Signal: ${track.guessLabel} at ${fmtMHz(track.centerFreqHz)} megahertz`}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        className="pointer-events-auto flex w-full items-center gap-2 rounded-2xl border border-line bg-card/95 py-1.5 pl-1.5 pr-1 shadow-xl backdrop-blur-md"
      >
        <button
          onClick={onExpand}
          aria-label="Show signal details"
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1.5 text-left active:bg-secondary"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-secondary">
            <Radio className="size-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-semibold text-foreground">{track.guessLabel}</span>
            <span className="mono-feats block font-mono text-[11px] text-muted-foreground">
              {fmtMHz(track.centerFreqHz)} MHz · {pct}%
            </span>
          </span>
          <ChevronUp className="ml-auto size-4 shrink-0 text-muted-foreground" />
        </button>
        {wants &&
          (modeMatches ? (
            <span className="mono-feats inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg bg-secondary px-2.5 font-mono text-[11px] font-semibold uppercase text-foreground">
              {wants} <Check className="size-3 text-primary" strokeWidth={3} />
            </span>
          ) : (
            <button
              onClick={() => {
                tick();
                setMode(wants);
              }}
              className="mono-feats inline-flex min-h-9 shrink-0 items-center rounded-lg bg-foreground px-2.5 font-mono text-[11px] font-semibold uppercase text-background"
            >
              Use {wants}
            </button>
          ))}
        <button
          onClick={onClose}
          aria-label="Close signal card"
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground active:bg-secondary"
        >
          <X className="size-4" />
        </button>
      </motion.section>
    );
  }

  return (
    <motion.section
      role="dialog"
      aria-label={`Signal: ${track.guessLabel} at ${fmtMHz(track.centerFreqHz)} megahertz`}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      className={cn(
        'pointer-events-auto thin-scroll max-h-[80%] w-full overflow-y-auto rounded-2xl border border-line bg-card/95 p-4 shadow-xl backdrop-blur-md',
        capped ? 'sm:max-h-[62%]' : 'sm:max-h-full',
      )}
    >
      <header className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-secondary">
          <Radio className="size-4 text-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold tracking-tight text-foreground">{track.guessLabel}</h3>
          <p className="mono-feats mt-0.5 font-mono text-[11.5px] text-muted-foreground">
            {fmtMHz(track.centerFreqHz)} MHz · {pct}% likely
            {lost && <span className="ml-1.5 text-foreground/60">· between bursts</span>}
          </p>
        </div>
        {onCollapse && (
          <button
            onClick={onCollapse}
            aria-label="Collapse signal card"
            className="-mt-1 grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ChevronDown className="size-4" />
          </button>
        )}
        <button
          onClick={onClose}
          aria-label="Close signal card"
          className="-mr-1.5 -mt-1 grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </header>

      {info && <p className="mt-3 text-[13px] leading-relaxed text-foreground/90">{info.blurb}</p>}

      {/* Are you hearing it the right way? */}
      {wants && (
        <div
          className={cn(
            'mt-3 flex items-center gap-2.5 rounded-xl border px-3 py-2.5',
            modeMatches ? 'border-line bg-secondary/60' : 'border-primary/50 bg-primary/10',
          )}
        >
          <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-foreground">
            {modeMatches ? (
              <>
                Listening in <span className="mono-feats font-mono font-semibold uppercase">{wants}</span>, the right mode
                for this signal.
              </>
            ) : (
              <>
                You&rsquo;re in <span className="mono-feats font-mono font-semibold uppercase">{mode}</span>. This signal
                wants <span className="mono-feats font-mono font-semibold uppercase">{wants}</span>.
              </>
            )}
          </span>
          {modeMatches ? (
            <Check className="size-4 shrink-0 text-primary" strokeWidth={3} />
          ) : (
            <button
              onClick={() => {
                tick();
                setMode(wants);
              }}
              className="mono-feats inline-flex min-h-9 shrink-0 items-center rounded-lg bg-foreground px-3 font-mono text-[11.5px] font-semibold uppercase text-background transition-opacity hover:opacity-90"
            >
              Use {wants}
            </button>
          )}
        </div>
      )}

      {/* Live transcript, when the signal carries speech. */}
      {speech && (
        <div className="mt-3 rounded-xl border border-line px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
            </span>
            <span className="mono-feats font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              On air · {speech.who}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-foreground">&ldquo;{speech.text}&rdquo;</p>
        </div>
      )}

      <dl className="mono-feats mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-border text-center">
        {[
          ['Width', fmtBw(track.bandwidthHz)],
          ['SNR', `${Math.round(track.snrDb)} dB`],
          ['Keying', bursty ? 'Bursty' : 'Steady'],
        ].map(([k, v]) => (
          <div key={k} className="bg-card px-2 py-2">
            <dt className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">{k}</dt>
            <dd className="mt-0.5 font-mono text-[13px] font-medium text-foreground">{v}</dd>
          </div>
        ))}
      </dl>

      {info && (
        <>
          <button
            onClick={() => setMore((v) => !v)}
            aria-expanded={more}
            className="mt-2.5 inline-flex min-h-8 items-center gap-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown className={cn('size-3.5 transition-transform', more && 'rotate-180')} />
            How to spot it
          </button>
          {more && (
            <div className="space-y-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
              <p>
                <span className="text-foreground">On the waterfall:</span> {info.waterfall}
              </p>
              <p>
                <span className="text-foreground">Where you hear it:</span> {info.realWorld}
              </p>
            </div>
          )}
        </>
      )}

      {/* The analyst's call: confirm or correct the machine. */}
      {track.candidates.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="mono-feats font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Confirm the ID
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {track.candidates.slice(0, 4).map((c) => {
              const picked = answered === c.kind;
              return (
                <button
                  key={c.kind}
                  onClick={() => {
                    tick();
                    setAnswered(c.kind);
                    identify(track.id, c.kind);
                  }}
                  className={cn(
                    'inline-flex min-h-9 items-center rounded-lg border px-3 text-[12.5px] transition-colors',
                    picked && verdict
                      ? verdict.correct
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-destructive/60 bg-destructive/10 text-foreground'
                      : 'border-border text-foreground hover:bg-secondary',
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          <AnimatePresence>
            {verdict && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role="status"
                className={cn('mt-2 text-[12.5px] leading-snug', verdict.correct ? 'text-primary' : 'text-foreground')}
              >
                {verdict.message}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.section>
  );
}
