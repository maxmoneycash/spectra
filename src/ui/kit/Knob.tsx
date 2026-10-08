import { useId, useRef } from 'react';
import { KnobHeadless, KnobHeadlessLabel, KnobHeadlessOutput, useKnobKeyboardControls } from 'react-knob-headless';
import { cn } from '@/lib/utils';
import { detent } from './haptics';

const SWEEP = 270; // degrees of travel, -135° … +135°
const START = -135;

function polar(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
}

function arc(r: number, from: number, to: number): string {
  if (to - from < 0.01) return '';
  const [x0, y0] = polar(r, from);
  const [x1, y1] = polar(r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

export interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  /** Haptic detent every N steps (0 disables). */
  detentEvery?: number;
  size?: number;
  /** Map the value onto the dial non-linearly (e.g. log for bandwidth). */
  mapTo01?: (x: number, min: number, max: number) => number;
  mapFrom01?: (x: number, min: number, max: number) => number;
  /** Draw the value arc from the center (for bipolar controls). */
  bipolar?: boolean;
  className?: string;
  disabled?: boolean;
}

/**
 * A rotary control with a printed tick ring, a lit value arc, and a shaded
 * cap with an indicator notch. Drag in any direction (or use arrow keys);
 * crossing a detent ticks the haptics so the knob feels notched under your
 * thumb. Built on react-knob-headless for the gesture and ARIA plumbing.
 */
export function Knob({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  detentEvery = 1,
  size = 64,
  mapTo01,
  mapFrom01,
  bipolar,
  className,
  disabled,
}: KnobProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const lastDetent = useRef<number | null>(null);
  const lastBuzz = useRef(0);

  const round = (v: number) => {
    const r = Math.round((v - min) / step) * step + min;
    return Math.min(max, Math.max(min, Number(r.toFixed(6))));
  };

  const commit = (raw: number) => {
    const v = round(raw);
    if (detentEvery > 0) {
      const d = Math.round((v - min) / (step * detentEvery));
      const now = performance.now();
      if (lastDetent.current !== null && d !== lastDetent.current && now - lastBuzz.current > 35) {
        detent();
        lastBuzz.current = now;
      }
      lastDetent.current = d;
    }
    if (v !== value) onChange(v);
  };

  const keys = useKnobKeyboardControls({
    valueRaw: value,
    valueMin: min,
    valueMax: max,
    step,
    stepLarger: step * Math.max(1, Math.round((max - min) / step / 10)),
    onValueRawChange: commit,
  });

  const t = mapTo01 ? mapTo01(value, min, max) : (value - min) / (max - min || 1);
  const t01 = Math.min(1, Math.max(0, t));
  const angle = START + t01 * SWEEP;
  const ticks = 28;

  return (
    <div className={cn('flex select-none flex-col items-center gap-1', disabled && 'opacity-40', className)}>
      <KnobHeadless
        id={id}
        aria-labelledby={labelId}
        valueRaw={value}
        valueMin={min}
        valueMax={max}
        dragSensitivity={0.006}
        valueRawRoundFn={round}
        valueRawDisplayFn={format}
        onValueRawChange={commit}
        axis="xy"
        mapTo01={mapTo01}
        mapFrom01={mapFrom01}
        includeIntoTabOrder
        {...keys}
        className="relative cursor-grab touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:cursor-grabbing"
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 100 100" className="size-full overflow-visible" aria-hidden>
          <defs>
            <radialGradient id={`${id}-cap`} cx="38%" cy="32%" r="75%">
              <stop offset="0%" className="[stop-color:var(--color-zinc-100)] dark:[stop-color:var(--color-zinc-600)]" />
              <stop offset="100%" className="[stop-color:var(--color-zinc-300)] dark:[stop-color:var(--color-zinc-800)]" />
            </radialGradient>
          </defs>
          {/* printed tick ring */}
          {Array.from({ length: ticks + 1 }, (_, i) => {
            const deg = START + (i / ticks) * SWEEP;
            const major = i % 7 === 0;
            const [x0, y0] = polar(major ? 44 : 46, deg);
            const [x1, y1] = polar(49, deg);
            const lit = i / ticks <= t01 + 1e-6 && (!bipolar || (i / ticks >= Math.min(t01, 0.5) && i / ticks <= Math.max(t01, 0.5)));
            return (
              <line
                key={i}
                x1={x0}
                y1={y0}
                x2={x1}
                y2={y1}
                strokeWidth={major ? 2 : 1.25}
                strokeLinecap="round"
                className={lit ? 'stroke-foreground' : 'stroke-muted-foreground/35'}
              />
            );
          })}
          {/* track + value arc */}
          <path d={arc(38, START, START + SWEEP)} fill="none" strokeWidth={3.5} strokeLinecap="round" className="stroke-border" />
          <path
            d={bipolar ? arc(38, Math.min(angle, 0), Math.max(angle, 0)) : arc(38, START, angle)}
            fill="none"
            strokeWidth={3.5}
            strokeLinecap="round"
            className="stroke-foreground"
          />
          {/* cap */}
          <circle cx="50" cy="50" r="29" fill={`url(#${id}-cap)`} className="stroke-black/10 dark:stroke-white/10" strokeWidth={1} />
          <circle cx="50" cy="50" r="25" fill="none" className="stroke-white/40 dark:stroke-white/5" strokeWidth={1} />
          {/* indicator notch */}
          <line
            x1={polar(11, angle)[0]}
            y1={polar(11, angle)[1]}
            x2={polar(24, angle)[0]}
            y2={polar(24, angle)[1]}
            strokeWidth={3}
            strokeLinecap="round"
            className="stroke-zinc-900 dark:stroke-zinc-50"
          />
        </svg>
      </KnobHeadless>
      <KnobHeadlessLabel
        id={labelId}
        className="mono-feats font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground"
      >
        {label}
      </KnobHeadlessLabel>
      <KnobHeadlessOutput htmlFor={id} className="mono-feats -mt-0.5 font-mono text-[11px] tabular-nums text-foreground">
        {format(value)}
      </KnobHeadlessOutput>
    </div>
  );
}

/** Log mapping helpers — bandwidth spans decades, so a linear dial wastes travel. */
export const logTo01 = (x: number, min: number, max: number) => Math.log(x / min) / Math.log(max / min);
export const logFrom01 = (t: number, min: number, max: number) => min * Math.pow(max / min, t);
