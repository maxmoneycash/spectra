import { useEffect, useState } from 'react';
import { NCDXF_BANDS, activeBeacon, nextSlotIn } from '../../sim/ncdxf';

/**
 * Live NCDXF beacon clock: which beacon is on each band right now.
 * Runs on the same wall-clock schedule as the real network (and our
 * Beacon Carousel scenario).
 */
export function BeaconClock() {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const countdown = nextSlotIn(now) / 1000;

  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-[13px] font-medium text-foreground">NCDXF beacon clock</div>
        <span className="mono-feats font-mono text-[10px] text-muted-foreground">
          next in {countdown.toFixed(0)}s
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        18 beacons rotate across 5 HF channels, 10 seconds each — this is the real schedule,
        right now. Hear it in the Beacon Carousel mission.
      </p>
      <div className="mt-3 divide-y divide-border border-y border-line">
        {NCDXF_BANDS.map((b, i) => {
          const active = activeBeacon(i, now);
          return (
            <div key={b.band} className="flex items-baseline gap-3 py-2">
              <span className="mono-feats w-16 shrink-0 font-mono text-[11px] text-foreground">
                {b.band}
              </span>
              <span className="mono-feats w-20 shrink-0 font-mono text-[12px] font-medium text-foreground">
                {active.call}
              </span>
              <span className="mono-feats shrink-0 font-mono text-[10px] text-muted-foreground">
                {active.grid}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">{active.qth}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-foreground transition-[width] duration-500 ease-linear"
          style={{ width: `${((10 - countdown) / 10) * 100}%` }}
        />
      </div>
      <div className="mono-feats mt-2 flex justify-between font-mono text-[9px] text-muted-foreground">
        <span>{NCDXF_BANDS.map((b) => (b.freqHz / 1e6).toFixed(3)).join(' · ')} MHz</span>
        <span>UTC-synced</span>
      </div>
    </div>
  );
}
