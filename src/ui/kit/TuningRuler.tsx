import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { tick } from './haptics';

export interface TuningRulerProps {
  /** Tuned offset from band center, Hz. */
  value: number;
  /** Absolute band center, Hz — only used to label the ticks. */
  centerHz: number;
  /** One detent of the dial, Hz (the mode's channel step). */
  stepHz: number;
  min: number;
  max: number;
  onChange: (offsetHz: number) => void;
  className?: string;
  label?: string;
}

const PX_PER_STEP = 11;
const FRICTION = 0.92; // per 16 ms frame
const MIN_V = 0.02; // px/ms below which momentum stops

function fmtTick(hz: number, stepHz: number): string {
  const mhz = hz / 1e6;
  // Enough decimals to tell neighbouring major ticks apart.
  const majorHz = stepHz * 10;
  const dp = majorHz >= 1e6 ? 0 : majorHz >= 100e3 ? 1 : majorHz >= 10e3 ? 2 : majorHz >= 1e3 ? 3 : 4;
  return mhz.toFixed(dp);
}

/**
 * The receiver's main tuning dial, unrolled into a strip. Drag or flick it:
 * it carries momentum, then settles on the nearest channel step; every step
 * it passes ticks the haptics like a detented VFO knob. The needle stays
 * put and the frequencies slide under it, which is how a real dial reads.
 */
export function TuningRuler({ value, centerHz, stepHz, min, max, onChange, className, label = 'Tuning dial' }: TuningRulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Position in Hz while dragging/coasting, decoupled from the store value
  // so the strip moves at 60 fps without waiting for React.
  const live = useRef(value);
  const dragging = useRef(false);
  const raf = useRef(0);
  const props = useRef({ centerHz, stepHz, min, max, onChange });
  props.current = { centerHz, stepHz, min, max, onChange };

  const draw = () => {
    const c = canvasRef.current;
    const wrap = wrapRef.current;
    if (!c || !wrap) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const css = getComputedStyle(wrap);
    const fg = css.getPropertyValue('--ruler-fg').trim() || '#fafafa';
    const dim = css.getPropertyValue('--ruler-dim').trim() || 'rgba(250,250,250,0.35)';
    const { stepHz: step, centerHz: center } = props.current;
    const pos = live.current;
    const mid = w / 2;
    const firstStep = Math.floor((pos - (mid / PX_PER_STEP) * step) / step) - 1;
    const lastStep = Math.ceil((pos + (mid / PX_PER_STEP) * step) / step) + 1;
    ctx.font = '500 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    for (let k = firstStep; k <= lastStep; k++) {
      const hz = k * step;
      const x = mid + ((hz - pos) / step) * PX_PER_STEP;
      const major = k % 10 === 0;
      const half = k % 5 === 0;
      const len = major ? 16 : half ? 11 : 7;
      ctx.strokeStyle = major ? fg : dim;
      ctx.lineWidth = major ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x, h - 4);
      ctx.lineTo(x, h - 4 - len);
      ctx.stroke();
      if (major) {
        ctx.fillStyle = dim;
        ctx.fillText(fmtTick(center + hz, step), x, h - 25);
      }
    }
  };

  // External value changes (seek buttons, locks, keyboard) re-seat the strip
  // unless the user is mid-gesture.
  useEffect(() => {
    if (dragging.current) return;
    live.current = value;
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, stepHz, centerHz]);

  useEffect(() => {
    const wrap = wrapRef.current!;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const redraw = () => draw();
    mq.addEventListener('change', redraw);
    const mo = new MutationObserver(redraw);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', redraw);
      mo.disconnect();
      cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current!;
    let lastX = 0;
    let lastT = 0;
    let v = 0; // px/ms, pointer velocity
    let lastStepIdx = 0;
    let lastEmit = 0;
    let pid: number | null = null;

    const clamp = (hz: number) => Math.max(props.current.min, Math.min(props.current.max, hz));
    const stepIdx = (hz: number) => Math.round(hz / props.current.stepHz);
    const emit = (snap: boolean) => {
      const { stepHz } = props.current;
      const hz = snap ? clamp(Math.round(live.current / stepHz) * stepHz) : clamp(live.current);
      const si = stepIdx(hz);
      if (si !== lastStepIdx) {
        const now = performance.now();
        if (now - lastEmit > 32) {
          tick();
          lastEmit = now;
        }
        lastStepIdx = si;
      }
      props.current.onChange(Math.round(hz));
    };

    const down = (e: PointerEvent) => {
      cancelAnimationFrame(raf.current);
      dragging.current = true;
      pid = e.pointerId;
      wrap.setPointerCapture(e.pointerId);
      lastX = e.clientX;
      lastT = performance.now();
      v = 0;
      lastStepIdx = stepIdx(live.current);
    };
    const move = (e: PointerEvent) => {
      if (!dragging.current || e.pointerId !== pid) return;
      const now = performance.now();
      const dx = e.clientX - lastX;
      const dt = Math.max(1, now - lastT);
      v = 0.7 * (dx / dt) + 0.3 * v;
      lastX = e.clientX;
      lastT = now;
      // Drag right = slide the dial right = lower frequencies come to the needle.
      live.current = clamp(live.current - (dx / PX_PER_STEP) * props.current.stepHz);
      draw();
      emit(false);
    };
    const up = (e: PointerEvent) => {
      if (!dragging.current || e.pointerId !== pid) return;
      pid = null;
      // Release velocity decays with friction, then the dial settles on a step.
      let vel = performance.now() - lastT > 80 ? 0 : v;
      let prev = performance.now();
      const coast = (t: number) => {
        const dt = Math.min(48, t - prev);
        prev = t;
        if (Math.abs(vel) > MIN_V) {
          live.current = clamp(live.current - ((vel * dt) / PX_PER_STEP) * props.current.stepHz);
          vel *= Math.pow(FRICTION, dt / 16);
          draw();
          emit(false);
          raf.current = requestAnimationFrame(coast);
          return;
        }
        // Settle: ease to the nearest step.
        const target = clamp(Math.round(live.current / props.current.stepHz) * props.current.stepHz);
        const from = live.current;
        const t0 = t;
        const settle = (tt: number) => {
          const k = Math.min(1, (tt - t0) / 140);
          const e2 = 1 - Math.pow(1 - k, 3);
          live.current = from + (target - from) * e2;
          draw();
          if (k < 1) raf.current = requestAnimationFrame(settle);
          else {
            dragging.current = false;
            emit(true);
          }
        };
        raf.current = requestAnimationFrame(settle);
      };
      raf.current = requestAnimationFrame(coast);
    };

    wrap.addEventListener('pointerdown', down);
    wrap.addEventListener('pointermove', move);
    wrap.addEventListener('pointerup', up);
    wrap.addEventListener('pointercancel', up);
    return () => {
      wrap.removeEventListener('pointerdown', down);
      wrap.removeEventListener('pointermove', move);
      wrap.removeEventListener('pointerup', up);
      wrap.removeEventListener('pointercancel', up);
    };
  }, []);

  const nudge = (dir: 1 | -1) => {
    const { stepHz, min: lo, max: hi } = props.current;
    const next = Math.max(lo, Math.min(hi, Math.round(value / stepHz) * stepHz + dir * stepHz));
    tick();
    onChange(next);
  };

  return (
    <div
      ref={wrapRef}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${((centerHz + value) / 1e6).toFixed(4)} megahertz`}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          nudge(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          nudge(-1);
        }
      }}
      className={cn(
        'relative h-12 cursor-grab touch-none select-none overflow-hidden outline-none active:cursor-grabbing',
        'focus-visible:ring-2 focus-visible:ring-ring/50',
        '[--ruler-fg:var(--color-zinc-900)] [--ruler-dim:color-mix(in_oklab,var(--color-zinc-900)_42%,transparent)]',
        'dark:[--ruler-fg:var(--color-zinc-50)] dark:[--ruler-dim:color-mix(in_oklab,var(--color-zinc-50)_40%,transparent)]',
        '[mask-image:linear-gradient(to_right,transparent,black_14%,black_86%,transparent)]',
        className,
      )}
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      {/* needle */}
      <span aria-hidden className="absolute bottom-0 left-1/2 top-1 w-[2px] -translate-x-1/2 rounded-full bg-tuned" />
      <span
        aria-hidden
        className="absolute left-1/2 top-0 size-0 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent border-t-tuned"
      />
    </div>
  );
}
