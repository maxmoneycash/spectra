import { useEffect, useRef } from 'react';
import { getEngine } from '../engine/engine';

// S-meter scale: label -> dB (dBFS-ish) -> percentage of the -120..-10 span.
const SCALE: { label: string; db: number }[] = [
  { label: 'S1', db: -115 },
  { label: '3', db: -103 },
  { label: '5', db: -91 },
  { label: '7', db: -79 },
  { label: 'S9', db: -67 },
  { label: '+20', db: -47 },
  { label: '+40', db: -27 },
];
const pct = (db: number) => Math.max(0, Math.min(100, ((db + 120) / 110) * 100));

/**
 * S-meter with instant attack and a decaying peak-hold marker. Driven by the
 * engine's high-rate meter events, written straight to the DOM (no React state).
 */
export function Meter() {
  const fillRef = useRef<HTMLDivElement>(null);
  const peakRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const peak = useRef(0);

  useEffect(() => {
    const unsub = getEngine().on('meter', (db) => {
      const p = pct(db);
      peak.current = Math.max(p, peak.current - 0.6);
      if (fillRef.current) fillRef.current.style.width = `${p}%`;
      if (peakRef.current) peakRef.current.style.left = `${peak.current}%`;
      if (textRef.current) textRef.current.textContent = `${db.toFixed(0)} dB`;
    });
    return unsub;
  }, []);

  return (
    <div className="smeter">
      <div className="smeter-top">
        <span className="deck-label">Signal</span>
        <span ref={textRef} className="smeter-db">
          —
        </span>
      </div>
      <div className="smeter-scale">
        {SCALE.map((s) => (
          <span key={s.label} style={{ left: `${pct(s.db)}%` }}>
            {s.label}
          </span>
        ))}
      </div>
      <div className="smeter-bar">
        <div ref={fillRef} className="fill" style={{ width: '0%' }} />
        <div className="smeter-ticks">
          {SCALE.map((s) => (
            <i key={s.label} style={{ left: `${pct(s.db)}%` }} />
          ))}
        </div>
        <div ref={peakRef} className="peak" style={{ left: '0%' }} />
      </div>
    </div>
  );
}
