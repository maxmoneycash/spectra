import { useEffect, useRef } from 'react';
import { getEngine } from '../engine/engine';
import { useTheme } from '../hooks/useTheme';
import { THEME } from './theme';

const SIZE = 76;

/** IQ constellation / phase scope of the tuned channel (post-filter). */
export function IQScope() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = THEME.scopeBg;
    ctx.fillRect(0, 0, SIZE, SIZE);
    let frame = 0;
    const unsub = getEngine().on('chanIQ', (re, im) => {
      if (frame++ % 2 !== 0) return;
      // Fade the previous frame for a persistence trail.
      ctx.fillStyle = THEME.scopeFade;
      ctx.fillRect(0, 0, SIZE, SIZE);
      // Axes.
      ctx.strokeStyle = THEME.scopeGrid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(SIZE / 2, 0);
      ctx.lineTo(SIZE / 2, SIZE);
      ctx.moveTo(0, SIZE / 2);
      ctx.lineTo(SIZE, SIZE / 2);
      ctx.stroke();
      let max = 1e-6;
      for (let i = 0; i < re.length; i++) {
        const m = Math.hypot(re[i], im[i]);
        if (m > max) max = m;
      }
      const scale = (SIZE / 2 - 4) / max;
      ctx.fillStyle = 'rgba(245,98,47,0.9)';
      for (let i = 0; i < re.length; i++) {
        const x = SIZE / 2 + re[i] * scale;
        const y = SIZE / 2 - im[i] * scale;
        ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
      }
    });
    return unsub;
  }, []);
  // Frames only arrive while the receiver runs, so a theme flip while it is
  // stopped would leave the last frame in the old palette. Repaint the
  // background; the trail restarts with the next frame.
  const { theme } = useTheme();
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = THEME.scopeBg;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }, [theme]);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="mono-feats font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted-foreground">
        IQ
      </span>
      <canvas
        ref={ref}
        // Background comes from the token so it follows the theme; the draw
        // loop repaints over it once samples arrive.
        className="rounded-lg border border-border bg-stage"
        style={{ width: SIZE, height: SIZE }}
      />
    </div>
  );
}
