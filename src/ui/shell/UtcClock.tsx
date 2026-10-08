import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

function stamp(d: Date, seconds: boolean): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}${seconds ? `:${p(d.getUTCSeconds())}` : ''}`;
}

/**
 * Station clock in UTC — what every log, schedule, and beacon rotation in
 * radio is kept in. Ticks on the second boundary so it never drifts.
 */
export function UtcClock({ className, seconds = true }: { className?: string; seconds?: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let t: number;
    const loop = () => {
      setNow(new Date());
      t = window.setTimeout(loop, 1000 - (Date.now() % 1000) + 5);
    };
    t = window.setTimeout(loop, 1000 - (Date.now() % 1000) + 5);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <time
      dateTime={now.toISOString()}
      aria-label={`UTC time ${stamp(now, false)}`}
      className={cn('mono-feats font-mono tabular-nums', className)}
    >
      {stamp(now, seconds)}
      <span className="text-muted-foreground">Z</span>
    </time>
  );
}
