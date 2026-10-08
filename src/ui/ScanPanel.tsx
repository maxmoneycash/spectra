import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Radar, Square, SkipForward, Ban, RotateCcw } from 'lucide-react';
import { useStore } from '@/store/store';
import { Segmented } from './kit/Segmented';
import { lock, tick } from './kit/haptics';
import { cn } from '@/lib/utils';

const STEPS = [5_000, 12_500, 25_000, 100_000] as const;
const fmtStep = (hz: number) => (hz >= 1000 ? `${hz / 1000}k` : `${hz}`);
const mhz = (hz: number, dp = 4) => (hz / 1e6).toFixed(dp);

function ago(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`;
}

/**
 * Scanner controls. The sweep bar is the band: the cursor races across it
 * while scanning and parks (green) on a hold; every hit leaves a tick, taller
 * the more often that channel comes up; locked-out channels are crossed off.
 */
export function ScanPanel({ compact = false }: { compact?: boolean }) {
  const scan = useStore((s) => s.scan);
  const running = useStore((s) => s.running);
  const centerFreqHz = useStore((s) => s.centerFreqHz);
  const toggle = useStore((s) => s.scanToggle);
  const setStep = useStore((s) => s.scanStep);
  const lockout = useStore((s) => s.scanLockout);
  const next = useStore((s) => s.scanNext);
  const clearLockouts = useStore((s) => s.scanClearLockouts);
  const tuneTo = useStore((s) => s.tuneTo);
  const reduce = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const status = scan?.status ?? 'idle';
  const lo = scan?.loHz ?? centerFreqHz - 560_000;
  const hi = scan?.hiHz ?? centerFreqHz + 560_000;
  const span = Math.max(1, hi - lo);
  const x = (hz: number) => `${Math.min(100, Math.max(0, ((hz - lo) / span) * 100))}%`;
  const scanning = status === 'scanning';
  const holding = status === 'hold';
  const hits = scan?.hits ?? [];
  const maxCount = Math.max(1, ...hits.map((h) => h.count));

  return (
    <div className={cn('flex flex-col', compact ? 'gap-2' : 'gap-3')}>
      {/* status */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'mono-feats inline-flex h-6 items-center gap-1.5 rounded-full px-2 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em]',
            holding
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : scanning
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                : 'bg-secondary text-muted-foreground',
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              holding ? 'bg-emerald-500' : scanning ? 'animate-pulse bg-amber-500' : 'bg-muted-foreground/50',
            )}
          />
          {holding ? 'Hold' : scanning ? 'Scanning' : 'Scanner'}
        </span>
        <span className="mono-feats truncate font-mono text-[12px] tabular-nums text-foreground">
          {scan && status !== 'idle' ? `${mhz(scan.freqHz)} MHz` : `${mhz(lo, 3)}–${mhz(hi, 3)}`}
        </span>
        {scan && status !== 'idle' && (
          <span className="mono-feats ml-auto shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
            {scan.levelDb.toFixed(0)} / {scan.thresholdDb.toFixed(0)} dB
          </span>
        )}
      </div>

      {/* sweep bar */}
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border border-stage-border bg-stage',
          compact ? 'h-11' : 'h-14',
        )}
        aria-hidden
      >
        {/* raster ticks */}
        <div className="absolute inset-x-0 bottom-0 h-3 bg-[repeating-linear-gradient(to_right,rgb(255_255_255/0.14)_0_1px,transparent_1px_8px)]" />
        {/* hits */}
        {hits.map((h) => (
          <span
            key={h.id}
            className="absolute bottom-0 w-[3px] -translate-x-1/2 rounded-t-sm bg-emerald-400/80"
            style={{ left: x(h.freqHz), height: `${30 + (h.count / maxCount) * 55}%` }}
          />
        ))}
        {/* lockouts */}
        {(scan?.lockouts ?? []).map((f) => (
          <span
            key={f}
            className="mono-feats absolute top-1 -translate-x-1/2 font-mono text-[10px] leading-none text-rose-400"
            style={{ left: x(f) }}
          >
            ×
          </span>
        ))}
        {/* cursor */}
        {scan && status !== 'idle' && (
          <motion.span
            className={cn('absolute inset-y-0 w-[2px] -translate-x-1/2', holding ? 'bg-emerald-400' : 'bg-amber-300')}
            animate={{ left: x(scan.freqHz) }}
            transition={reduce ? { duration: 0 } : { type: 'tween', ease: 'linear', duration: holding ? 0.15 : 0.09 }}
            style={{ boxShadow: holding ? '0 0 12px 2px rgb(52 211 153 / 0.55)' : '0 0 10px 1px rgb(252 211 77 / 0.45)' }}
          />
        )}
        {!scan || status === 'idle' ? (
          <span className="mono-feats absolute inset-0 grid place-items-center font-mono text-[10px] uppercase tracking-[0.14em] text-stage-muted">
            {hits.length ? `${hits.length} active channel${hits.length === 1 ? '' : 's'} found` : 'Stops on anything that breaks squelch'}
          </span>
        ) : null}
      </div>

      {/* controls */}
      <div className="flex items-center gap-2">
        <button
          data-guide="scan"
          onClick={() => {
            lock();
            toggle();
          }}
          disabled={!running}
          className={cn(
            'inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[13.5px] font-semibold transition-[transform,opacity] active:scale-[0.98] disabled:opacity-40',
            status === 'idle' ? 'bg-foreground text-background' : 'border border-border bg-card text-foreground',
          )}
        >
          {status === 'idle' ? <Radar className="size-4" /> : <Square className="size-3.5" fill="currentColor" />}
          {!running ? 'Power on to scan' : status === 'idle' ? 'Scan the band' : 'Stop'}
        </button>
        {holding && (
          <>
            <button
              onClick={() => {
                tick();
                next();
              }}
              aria-label="Resume scanning"
              className="grid size-11 place-items-center rounded-xl border border-border bg-card text-foreground active:scale-95"
            >
              <SkipForward className="size-4" />
            </button>
            <button
              onClick={() => {
                tick();
                lockout();
              }}
              aria-label="Lock out this channel"
              className="grid size-11 place-items-center rounded-xl border border-border bg-card text-rose-600 active:scale-95 dark:text-rose-400"
            >
              <Ban className="size-4" />
            </button>
          </>
        )}
      </div>

      <Segmented
        size="sm"
        label="Scan step"
        value={(scan?.stepHz ?? 12_500) as (typeof STEPS)[number]}
        onChange={(v) => setStep(v)}
        options={STEPS.map((s) => ({ value: s, label: `${fmtStep(s)} step`, aria: `${s / 1000} kilohertz steps` }))}
      />

      {!compact && (
        <div>
          <div className="flex items-baseline justify-between pb-1.5 pt-1">
            <p className="mono-feats font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Active channels · {hits.length}
            </p>
            {(scan?.lockouts.length ?? 0) > 0 && (
              <button
                onClick={clearLockouts}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3" /> Clear {scan!.lockouts.length} lockout{scan!.lockouts.length === 1 ? '' : 's'}
              </button>
            )}
          </div>
          {hits.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-3 text-[12px] leading-relaxed text-muted-foreground">
              Nothing yet. Start a scan and leave it running — repeaters and nets key up every few seconds.
            </p>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-line">
              {hits.slice(0, 12).map((h) => (
                <button
                  key={h.id}
                  onClick={() => {
                    tick();
                    tuneTo(h.freqHz);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent"
                >
                  <span className="mono-feats font-mono text-[12.5px] tabular-nums text-foreground">{mhz(h.freqHz)}</span>
                  <span className="mono-feats font-mono text-[10.5px] text-muted-foreground">×{h.count}</span>
                  <span className="mono-feats ml-auto font-mono text-[10.5px] tabular-nums text-muted-foreground">
                    {h.peakDb.toFixed(0)} dB · {ago(h.at, now)} ago
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
