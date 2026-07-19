import { useEffect, useRef, useState } from 'react';
import { getEngine } from '../engine/engine';
import { Matrix } from '@/components/ui/matrix';

const COLS = 18;
const SCALE = ['S1', '3', '5', '7', 'S9', '+20', '+40'];
const pct = (db: number) => Math.max(0, Math.min(1, (db + 120) / 110));

/**
 * S-meter as an elevenlabs Matrix dot-matrix VU meter with decay.
 * Driven by the engine's meter events at control rate.
 */
export function Meter() {
  const [levels, setLevels] = useState<number[]>(() => Array(COLS).fill(0));
  const [dbText, setDbText] = useState('—');
  const peak = useRef(0);

  useEffect(() => {
    const unsub = getEngine().on('meter', (db) => {
      const v = pct(db);
      peak.current = Math.max(v, peak.current - 0.02);
      setLevels((prev) =>
        prev.map((p, i) => {
          const target = Math.min(Math.max(v * COLS - i, 0), 1);
          return Math.max(target, p - 0.07);
        }),
      );
      setDbText(`${db.toFixed(0)} dB`);
    });
    return unsub;
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="mono-feats font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted-foreground">
          Signal
        </span>
        <span className="mono-feats font-mono text-[10.5px] text-foreground">{dbText}</span>
      </div>
      <Matrix
        rows={7}
        cols={COLS}
        mode="vu"
        levels={levels}
        size={4}
        gap={2}
        ariaLabel="Signal level meter"
        className="text-foreground"
      />
      <div className="flex justify-between font-mono text-[7.5px] text-muted-foreground">
        {SCALE.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
    </div>
  );
}
