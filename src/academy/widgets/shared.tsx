import { useEffect, useRef, type ReactNode } from 'react';
import { THEME } from '../../ui/theme';

/** Static demo canvas: redraws when deps change (no animation loop). DPR-scaled. */
export function useStaticCanvas(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  deps: readonly unknown[],
) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 110;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = THEME.scopeBg;
    ctx.fillRect(0, 0, w, h);
    draw(ctx, w, h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

export function WidgetCard({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <div className="text-[13px] font-medium text-foreground">{title}</div>
      {blurb && <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{blurb}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

export const canvasClass = 'block h-[110px] w-full rounded-lg border border-border bg-stage';

export const AX = {
  grid: 'rgba(255,255,255,0.07)',
  label: '#8e8e96',
  dim: '#5f5f66',
  trace: 'rgba(250,250,250,0.9)',
  accent: '#f5622f',
  accentHi: '#ff8a5c',
  mono: '"Geist Mono", ui-monospace, monospace',
} as const;

export function hline(ctx: CanvasRenderingContext2D, y: number, w: number, color = AX.grid) {
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(w, y);
  ctx.stroke();
}

export function vline(ctx: CanvasRenderingContext2D, x: number, h: number, color = AX.grid) {
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, h);
  ctx.stroke();
}
