import { useRef, useState } from 'react';

interface FaderProps {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
  onChange: (v: number) => void;
}

/**
 * Console fader: pointer-capture drag on a hairline track, accent fill,
 * thumb appears on hover/drag. Full keyboard support (arrows, Shift = x10).
 */
export function Fader({ name, value, min, max, step, fmt, onChange }: FaderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const clamped = Math.min(max, Math.max(min, value));
  const pct = ((clamped - min) / (max - min)) * 100;
  const decimals = (String(step).split('.')[1] ?? '').length;
  const snap = (v: number) =>
    Number((Math.round(v / step) * step).toFixed(Math.min(decimals, 6)));

  const setFromX = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onChange(Math.min(max, Math.max(min, snap(min + t * (max - min)))));
  };

  const nudge = (dir: 1 | -1, coarse: boolean) => {
    const next = clamped + dir * step * (coarse ? 10 : 1);
    onChange(Math.min(max, Math.max(min, snap(next))));
  };

  return (
    <div className={`fader ${dragging ? 'dragging' : ''}`}>
      <div className="fader-head">
        <span className="fader-name">{name}</span>
        <span className="fader-val">{fmt(clamped)}</span>
      </div>
      <div
        ref={trackRef}
        className="fader-track"
        role="slider"
        aria-label={name}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={clamped}
        aria-valuetext={fmt(clamped)}
        tabIndex={0}
        onPointerDown={(e) => {
          e.preventDefault();
          trackRef.current!.setPointerCapture(e.pointerId);
          setDragging(true);
          setFromX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (dragging) setFromX(e.clientX);
        }}
        onPointerUp={(e) => {
          if (trackRef.current?.hasPointerCapture(e.pointerId)) {
            trackRef.current.releasePointerCapture(e.pointerId);
          }
          setDragging(false);
        }}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            nudge(-1, e.shiftKey);
          } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            nudge(1, e.shiftKey);
          }
        }}
      >
        <div className="fader-rail" />
        <div className="fader-fill" style={{ width: `${pct}%` }} />
        <div className="fader-thumb" style={{ left: `${pct}%` }} />
      </div>
    </div>
  );
}
