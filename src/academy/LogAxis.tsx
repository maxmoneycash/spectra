import { useEffect, useRef } from 'react';
import { REGIONS, BANDS, AXIS_MIN_HZ, AXIS_MAX_HZ, fmtAxisFreq, fmtWavelength, type AcademyBand } from './data';
import { THEME } from '../ui/theme';

const L_MIN = Math.log10(AXIS_MIN_HZ);
const L_MAX = Math.log10(AXIS_MAX_HZ);

// Lane layout (CSS px from top).
const AXIS_H = 24; // tick labels
const RIBBON_Y = 30;
const RIBBON_H = 24;
const BAND_Y = 64;
const BAND_H = 34;
const SVC_Y = 106;
const SVC_H = 28;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export interface LogAxisProps {
  selectedId: string | null;
  onSelect: (band: AcademyBand | null) => void;
}

/**
 * Zoomable log-frequency explorer (100 kHz – 10 GHz). Wheel/pinch zoom
 * anchored at the cursor, drag to pan, click a band to inspect it.
 * Rendered imperatively on canvas; redrawn only when the view changes.
 */
export function LogAxis({ selectedId, onSelect }: LogAxisProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef({ center: (L_MIN + L_MAX) / 2, span: L_MAX - L_MIN });
  const hoverX = useRef<number | null>(null);
  const selRef = useRef<string | null>(selectedId);
  selRef.current = selectedId;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const scheduleRef = useRef<() => void>(() => {});

  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let width = 0;
    let height = 0;
    let raf = 0;

    const xToLog = (x: number) => view.current.center + (x / width - 0.5) * view.current.span;
    const logToX = (l: number) => ((l - (view.current.center - view.current.span / 2)) / view.current.span) * width;
    const fToX = (hz: number) => logToX(Math.log10(hz));

    const clampView = () => {
      const v = view.current;
      v.span = Math.max(0.45, Math.min(L_MAX - L_MIN, v.span));
      const half = v.span / 2;
      if (v.center - half < L_MIN) v.center = L_MIN + half;
      if (v.center + half > L_MAX) v.center = L_MAX - half;
    };

    const draw = () => {
      raf = 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = THEME.plotBg;
      ctx.fillRect(0, 0, width, height);
      const v = view.current;
      const loL = v.center - v.span / 2;

      // --- frequency grid: decades + minor ticks when zoomed ---
      ctx.font = `9px ${THEME.mono}`;
      const dLo = Math.ceil(loL);
      const dHi = Math.floor(loL + v.span);
      for (let d = dLo; d <= dHi; d++) {
        const x = logToX(d);
        ctx.strokeStyle = 'rgba(255,255,255,0.09)';
        ctx.beginPath();
        ctx.moveTo(x + 0.5, AXIS_H);
        ctx.lineTo(x + 0.5, height);
        ctx.stroke();
        const hz = 10 ** d;
        ctx.fillStyle = THEME.label;
        ctx.fillText(fmtAxisFreq(hz), x + 4, 15);
        if (v.span < 2.3) {
          for (let m = 2; m <= 9; m++) {
            const mx = logToX(d + Math.log10(m));
            if (mx < 0 || mx > width) continue;
            ctx.strokeStyle = 'rgba(255,255,255,0.045)';
            ctx.beginPath();
            ctx.moveTo(mx + 0.5, AXIS_H);
            ctx.lineTo(mx + 0.5, height);
            ctx.stroke();
            if (v.span < 1.15) {
              ctx.fillStyle = THEME.labelDim;
              ctx.fillText(fmtAxisFreq(m * hz), mx + 3, 15);
            }
          }
        }
      }
      // axis baseline
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.moveTo(0, AXIS_H + 0.5);
      ctx.lineTo(width, AXIS_H + 0.5);
      ctx.stroke();

      // --- region ribbon ---
      ctx.font = `600 9px ${THEME.mono}`;
      for (const r of REGIONS) {
        const x0 = fToX(r.fStartHz);
        const x1 = fToX(r.fEndHz);
        if (x1 < 0 || x0 > width) continue;
        const bx0 = Math.max(0, x0);
        const bx1 = Math.min(width, x1);
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        ctx.fillRect(bx0, RIBBON_Y, bx1 - bx0, RIBBON_H);
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0 + 0.5, RIBBON_Y);
        ctx.lineTo(x0 + 0.5, RIBBON_Y + RIBBON_H);
        ctx.stroke();
        const label = x1 - x0 > 90 ? `${r.name} · ${r.longName}` : r.name;
        if (ctx.measureText(label).width < bx1 - bx0 - 10) {
          ctx.fillStyle = THEME.label;
          ctx.fillText(label, bx0 + 6, RIBBON_Y + 15);
        } else if (bx1 - bx0 > 24) {
          ctx.fillStyle = THEME.label;
          ctx.fillText(r.name, bx0 + 5, RIBBON_Y + 15);
        }
      }

      // --- bands ---
      // Labels fade in as you zoom: a label is drawn only when it does not
      // collide with the previously drawn label in its lane.
      const sel = selRef.current;
      const drawBand = (b: AcademyBand, y: number, h: number, last: { right: number }) => {
        const x0 = fToX(b.fStartHz);
        const x1 = fToX(b.fEndHz);
        if (x1 < -40 || x0 > width + 40) return;
        const isSel = b.id === sel;
        const isSim = !!b.scenarioId;
        const bx0 = Math.max(-20, x0);
        const bw = Math.max(3, x1 - x0);

        if (isSim) {
          ctx.fillStyle = isSel ? 'rgba(245,98,47,0.24)' : 'rgba(245,98,47,0.11)';
          ctx.strokeStyle = isSel ? THEME.accent : 'rgba(245,98,47,0.5)';
        } else {
          ctx.fillStyle = isSel ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.055)';
          ctx.strokeStyle = isSel ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.16)';
        }
        ctx.lineWidth = isSel ? 1.5 : 1;
        roundRect(ctx, bx0, y, bw, h, 6);
        ctx.fill();
        ctx.stroke();

        // SIM caret
        if (isSim && bw > 34) {
          ctx.fillStyle = isSel ? THEME.accentHi : 'rgba(255,138,92,0.85)';
          const cx = bx0 + bw - 13;
          ctx.beginPath();
          ctx.moveTo(cx, y + h / 2 - 3.5);
          ctx.lineTo(cx + 6, y + h / 2);
          ctx.lineTo(cx, y + h / 2 + 3.5);
          ctx.closePath();
          ctx.fill();
        }

        // Label: centered on the visible part of the block, skipped on collision.
        const name = b.name;
        ctx.font = `500 10px ${THEME.mono}`;
        const tw = ctx.measureText(name).width;
        const visL = Math.max(x0, 0);
        const visR = Math.min(x1, width);
        if (visR - visL < 0.35 * bw) return; // mostly offscreen
        let tx = bx0 + bw / 2 - tw / 2;
        tx = Math.max(4, Math.min(width - tw - 4, tx));
        if (tx - 6 < last.right) return; // would collide
        ctx.fillStyle = isSim
          ? isSel
            ? THEME.accentHi
            : 'rgba(255,138,92,0.9)'
          : isSel
            ? '#f5f4f2'
            : 'rgba(215,212,208,0.85)';
        ctx.fillText(name, tx, y + h / 2 + 3.5);
        last.right = tx + tw;
      };

      const lane1 = { right: -Infinity };
      for (const b of BANDS) if (b.tier === 1) drawBand(b, BAND_Y, BAND_H, lane1);
      if (v.span < 2.6) {
        const lane2 = { right: -Infinity };
        for (const b of BANDS) if (b.tier === 2) drawBand(b, SVC_Y, SVC_H, lane2);
      }

      // hint to zoom when services hidden
      if (v.span >= 2.6) {
        ctx.font = `9.5px ${THEME.mono}`;
        ctx.fillStyle = THEME.labelDim;
        ctx.fillText('scroll to zoom — services and channels appear as you descend', 8, SVC_Y + 18);
      }

      // --- hover ---
      const hx = hoverX.current;
      if (hx !== null) {
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hx + 0.5, 0);
        ctx.lineTo(hx + 0.5, height);
        ctx.stroke();
        const hz = 10 ** xToLog(hx);
        const label = `${fmtAxisFreq(hz)}   λ ${fmtWavelength(hz)}`;
        ctx.font = `9.5px ${THEME.mono}`;
        const tw = ctx.measureText(label).width + 14;
        const px = Math.min(width - tw - 6, hx + 10);
        ctx.fillStyle = 'rgba(24,23,26,0.95)';
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        roundRect(ctx, px, 6, tw, 17, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f0efed';
        ctx.fillText(label, px + 7, 17.5);
      }
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    scheduleRef.current = schedule;

    const resize = () => {
      width = Math.max(64, wrap.clientWidth);
      height = Math.max(64, wrap.clientHeight);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      schedule();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // ---- interaction ----
    const rectLeft = () => wrap.getBoundingClientRect().left;
    const pointers = new Map<number, { x: number; y: number }>();
    let panStartX = 0;
    let panStartCenter = 0;
    let moved = false;
    let pinchDist = 0;

    const down = (e: PointerEvent) => {
      wrap.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        panStartX = e.clientX;
        panStartCenter = view.current.center;
        moved = false;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.abs(a.x - b.x);
      }
    };

    const move = (e: PointerEvent) => {
      const x = e.clientX - rectLeft();
      hoverX.current = x >= 0 && x <= width ? x : null;
      if (!pointers.has(e.pointerId)) {
        schedule();
        return;
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        const dx = e.clientX - panStartX;
        if (Math.abs(dx) > 3) moved = true;
        if (moved) {
          view.current.center = panStartCenter - (dx / width) * view.current.span;
          clampView();
        }
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.max(20, Math.abs(a.x - b.x));
        if (pinchDist > 0) {
          const midLog = xToLog((a.x + b.x) / 2 - rectLeft());
          view.current.span *= pinchDist / dist;
          clampView();
          // keep the midpoint stationary
          const newHalf = view.current.span / 2;
          const midX = ((a.x + b.x) / 2 - rectLeft()) / width;
          view.current.center = midLog + (0.5 - midX) * 2 * newHalf;
          clampView();
        }
        pinchDist = dist;
        moved = true;
      }
      schedule();
    };

    const up = (e: PointerEvent) => {
      const wasClick = pointers.size === 1 && !moved;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
      if (wasClick) {
        const x = e.clientX - rectLeft();
        const y = e.clientY - wrap.getBoundingClientRect().top;
        // hit test: most specific (narrowest) band under the point
        const hit: { band: AcademyBand | null; w: number } = { band: null, w: Infinity };
        const tryHit = (b: AcademyBand, y0: number, h: number) => {
          if (y < y0 || y > y0 + h) return;
          const x0 = fToX(b.fStartHz);
          const x1 = fToX(b.fEndHz);
          const w = x1 - x0;
          if (x >= x0 && x <= x1 && w < hit.w) {
            hit.band = b;
            hit.w = w;
          }
        };
        for (const b of BANDS) if (b.tier === 1) tryHit(b, BAND_Y, BAND_H);
        if (view.current.span < 2.6) for (const b of BANDS) if (b.tier === 2) tryHit(b, SVC_Y, SVC_H);
        onSelectRef.current(hit.band && hit.band.id !== selRef.current ? hit.band : null);
      }
      schedule();
    };

    const leave = () => {
      hoverX.current = null;
      schedule();
    };

    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const x = e.clientX - rectLeft();
      const anchorLog = xToLog(x);
      const factor = e.deltaY < 0 ? 0.82 : 1.22;
      view.current.span *= factor;
      clampView();
      const newHalf = view.current.span / 2;
      view.current.center = anchorLog + (0.5 - x / width) * 2 * newHalf;
      clampView();
      schedule();
    };

    wrap.addEventListener('pointerdown', down);
    wrap.addEventListener('pointermove', move);
    wrap.addEventListener('pointerup', up);
    wrap.addEventListener('pointercancel', up);
    wrap.addEventListener('pointerleave', leave);
    wrap.addEventListener('wheel', wheel, { passive: false });

    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      wrap.removeEventListener('pointerdown', down);
      wrap.removeEventListener('pointermove', move);
      wrap.removeEventListener('pointerup', up);
      wrap.removeEventListener('pointercancel', up);
      wrap.removeEventListener('pointerleave', leave);
      wrap.removeEventListener('wheel', wheel);
    };
  }, []);

  // Redraw when the selection changes (selRef is read inside draw).
  useEffect(() => {
    scheduleRef.current();
  }, [selectedId]);

  return (
    <div ref={wrapRef} className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
