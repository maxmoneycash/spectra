import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { lock, tick } from './kit/haptics';
import { getEngine } from '../engine/engine';
import { SAMPLE_RATE } from '../engine/protocol';
import { useStore, type LockFx } from '../store/store';
import type { TrackMsg } from '../engine/protocol';
import { KIND_INFO } from '../sim/signal-kinds';
import { lutFor } from './colormaps';
import { WaterfallControls } from './WaterfallControls';
import { THEME, isCanvasDark } from './theme';
import { useTheme } from '../hooks/useTheme';

const SPEC_H = 172;
const RULER_H = 26;

function fmtFreqMHz(hz: number): string {
  return (hz / 1e6).toFixed(4);
}

function niceStep(span: number): number {
  const steps = [10e3, 20e3, 50e3, 100e3, 200e3, 500e3, 1e6, 2e6];
  const raw = span / 7;
  return steps.find((s) => s >= raw) ?? 2e6;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexA(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function kindColor(kind: TrackMsg['guessKind']): string {
  return KIND_INFO[kind]?.color ?? '#8a8680';
}

export function SpectrumWaterfall() {
  const specRef = useRef<HTMLCanvasElement>(null);
  const wfRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const vfoBandRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<HTMLDivElement>(null);
  const hoverLabelRef = useRef<HTMLDivElement>(null);
  const zoomLabelRef = useRef<HTMLDivElement>(null);
  const lockRef = useRef<HTMLDivElement>(null);

  const setTuning = useStore((s) => s.setTuning);
  const tuning = useStore((s) => s.tuningOffsetHz);
  const bandwidth = useStore((s) => s.bandwidthHz);
  const detections = useStore((s) => s.detections);
  const selectedId = useStore((s) => s.selectedId);
  const centerFreqHz = useStore((s) => s.centerFreqHz);
  const cmapIndex = useStore((s) => s.cmapIndex);
  const floorDb = useStore((s) => s.floorDb);
  const ceilDb = useStore((s) => s.ceilDb);
  const setDbRange = useStore((s) => s.setDbRange);
  const lockFx = useStore((s) => s.lockFx);
  const lockFxRef = useRef<LockFx | null>(null);
  useEffect(() => {
    lockFxRef.current = lockFx;
  }, [lockFx]);

  // Mutable state read by the (non-React) draw loop.
  const sig = useRef({ tuning: 0, bandwidth: 12000, detections: [] as TrackMsg[], selectedId: null as string | null, centerFreqHz: 100e6 });
  const disp = useRef({ floorDb: -78, ceilDb: -14, cmap: 0 });
  const view = useRef({ centerHz: 0, spanHz: SAMPLE_RATE });
  const hoverX = useRef<number | null>(null);
  const lastCol = useRef<Float32Array>(new Float32Array(0));

  useEffect(() => {
    sig.current = { tuning, bandwidth, detections, selectedId, centerFreqHz };
  }, [tuning, bandwidth, detections, selectedId, centerFreqHz]);
  useEffect(() => {
    disp.current = { floorDb, ceilDb, cmap: cmapIndex };
  }, [floorDb, ceilDb, cmapIndex]);
  // Reset zoom when the band center changes (new scenario / retune), and
  // re-level the waterfall for the new band once it has a few frames.
  const framesSinceBand = useRef(0);
  const autoLevelRef = useRef<() => void>(() => {});
  useEffect(() => {
    view.current = { centerHz: 0, spanHz: SAMPLE_RATE };
    framesSinceBand.current = 0;
  }, [centerFreqHz]);

  // Wipe the painted history on a theme flip so light and dark ramps
  // don't end up stacked in the same waterfall.
  const { theme } = useTheme();
  const clearWaterfallRef = useRef<() => void>(() => {});
  const redrawRef = useRef<() => void>(() => {});
  useEffect(() => {
    clearWaterfallRef.current();
    // Nothing repaints the plot until the next engine frame, so a theme flip
    // while the sim is stopped would otherwise leave it in the old palette.
    redrawRef.current();
  }, [theme]);

  useEffect(() => {
    const specCanvas = specRef.current!;
    const wfCanvas = wfRef.current!;
    const wrap = wrapRef.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let width = 0;
    let wfHeight = 0;
    let rowImg: ImageData | null = null;
    let col = new Float32Array(0);
    let peak = new Float32Array(0);

    const resize = () => {
      width = Math.max(64, Math.floor(wrap.clientWidth));
      wfHeight = Math.max(64, Math.floor(wrap.clientHeight - SPEC_H));
      // Spectrum plot is DPR-scaled for crisp hairlines; the waterfall stays
      // 1x because it scrolls via ImageData rows.
      specCanvas.width = width * dpr;
      specCanvas.height = SPEC_H * dpr;
      wfCanvas.width = width;
      wfCanvas.height = wfHeight;
      const c = wfCanvas.getContext('2d')!;
      c.fillStyle = THEME.waterfallBg;
      c.fillRect(0, 0, width, wfHeight);
      rowImg = c.createImageData(width, 1);
      col = new Float32Array(width);
      peak = new Float32Array(width).fill(-140);
      lastCol.current = col;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const viewStart = () => view.current.centerHz - view.current.spanHz / 2;
    const offToX = (off: number) => ((off - viewStart()) / view.current.spanHz) * width;
    const xToOff = (x: number) => viewStart() + (x / width) * view.current.spanHz;
    const clearWaterfall = () => {
      const c = wfCanvas.getContext('2d')!;
      c.fillStyle = THEME.waterfallBg;
      c.fillRect(0, 0, width, wfHeight);
    };
    clearWaterfallRef.current = clearWaterfall;
    redrawRef.current = () => {
      drawSpectrum();
      updateOverlays();
    };

    const onSpectrum = (db: Float32Array) => {
      if (!rowImg) return;
      const n = db.length;
      const vs = viewStart();
      const span = view.current.spanHz;
      // Pool the visible FFT bins into pixel columns.
      for (let x = 0; x < width; x++) {
        const offLo = vs + (x / width) * span;
        const offHi = vs + ((x + 1) / width) * span;
        let b0 = Math.floor((offLo / SAMPLE_RATE + 0.5) * n);
        let b1 = Math.floor((offHi / SAMPLE_RATE + 0.5) * n);
        if (b0 < 0) b0 = 0;
        if (b1 > n) b1 = n;
        if (b1 <= b0) b1 = b0 + 1;
        let m = -Infinity;
        for (let b = b0; b < b1; b++) if (db[b] > m) m = db[b];
        col[x] = m === -Infinity ? disp.current.floorDb : m;
        peak[x] = Math.max(col[x], peak[x] - 0.28);
      }

      const lut = lutFor(disp.current.cmap, isCanvasDark());
      const floor = disp.current.floorDb;
      const range = disp.current.ceilDb - floor;
      const wfCtx = wfCanvas.getContext('2d')!;
      wfCtx.drawImage(wfCanvas, 0, 0, width, wfHeight - 1, 0, 1, width, wfHeight - 1);
      const data = rowImg.data;
      for (let x = 0; x < width; x++) {
        let t = (col[x] - floor) / range;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const idx = (t * 255) | 0;
        data[x * 4] = lut[idx * 3];
        data[x * 4 + 1] = lut[idx * 3 + 1];
        data[x * 4 + 2] = lut[idx * 3 + 2];
        data[x * 4 + 3] = 255;
      }
      wfCtx.putImageData(rowImg, 0, 0);
      drawSpectrum();
      updateOverlays();
      if (++framesSinceBand.current === 28) autoLevelRef.current();
    };

    const drawSpectrum = () => {
      const ctx = specCanvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const st = sig.current;
      const floor = disp.current.floorDb;
      const ceil = disp.current.ceilDb;
      const plotH = SPEC_H - RULER_H;
      ctx.fillStyle = THEME.plotBg;
      ctx.fillRect(0, 0, width, SPEC_H);

      // Faint dB grid + labels.
      ctx.font = `9px ${THEME.mono}`;
      const dbStep = range10(ceil - floor);
      for (let d = Math.ceil(floor / dbStep) * dbStep; d <= ceil; d += dbStep) {
        const y = ((ceil - d) / (ceil - floor)) * plotH;
        ctx.strokeStyle = THEME.grid;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.fillStyle = THEME.labelDim;
        ctx.fillText(`${d}`, 5, y + 10);
      }

      // Occupied-band underlines, kind-colored, along the plot baseline.
      for (const d of st.detections) {
        const x0 = offToX(d.offsetHz - d.bandwidthHz / 2);
        const x1 = offToX(d.offsetHz + d.bandwidthHz / 2);
        if (x1 < 0 || x0 > width) continue;
        const sel = d.id === st.selectedId;
        ctx.fillStyle = hexA(kindColor(d.guessKind), sel ? 0.85 : 0.4);
        ctx.fillRect(Math.max(0, x0), plotH - 2.5, Math.min(width, x1) - Math.max(0, x0), 2.5);
      }

      // Peak-hold envelope.
      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        let t = (peak[x] - floor) / (ceil - floor);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const y = plotH - t * plotH;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = THEME.peak;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Live trace with a soft gradient fill.
      const fillGrad = ctx.createLinearGradient(0, 0, 0, plotH);
      fillGrad.addColorStop(0, 'rgba(246,245,243,0.13)');
      fillGrad.addColorStop(1, 'rgba(246,245,243,0.01)');
      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        let t = (col[x] - floor) / (ceil - floor);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const y = plotH - t * plotH;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(width, plotH);
      ctx.lineTo(0, plotH);
      ctx.closePath();
      ctx.fillStyle = fillGrad;
      ctx.fill();
      ctx.strokeStyle = THEME.trace;
      ctx.lineWidth = 1.1;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Tuner scale band.
      ctx.fillStyle = THEME.rulerBg;
      ctx.fillRect(0, plotH, width, RULER_H);
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath();
      ctx.moveTo(0, plotH + 0.5);
      ctx.lineTo(width, plotH + 0.5);
      ctx.stroke();

      const step = niceStep(view.current.spanHz);
      const minor = step / 5;
      const startHz = viewStart();
      const endHz = startHz + view.current.spanHz;
      ctx.strokeStyle = THEME.tick;
      ctx.lineWidth = 1;
      for (let f = Math.ceil(startHz / minor) * minor; f < endHz; f += minor) {
        const x = Math.round(offToX(f)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, plotH);
        ctx.lineTo(x, plotH + 4);
        ctx.stroke();
      }
      let lastLabelX = -Infinity;
      ctx.font = `9px ${THEME.mono}`;
      for (let f = Math.ceil(startHz / step) * step; f < endHz; f += step) {
        const x = Math.round(offToX(f)) + 0.5;
        ctx.strokeStyle = THEME.tickMajor;
        ctx.beginPath();
        ctx.moveTo(x, plotH);
        ctx.lineTo(x, plotH + 7);
        ctx.stroke();
        if (x - lastLabelX > 52) {
          ctx.fillStyle = THEME.label;
          ctx.fillText(fmtFreqMHz(st.centerFreqHz + f), x + 4, plotH + 17);
          lastLabelX = x;
        }
      }

      // Detection carets on the scale + labels at the plot top, kind-colored
      // (ties the stage to the Stations list).
      let lastDetLabelX = -Infinity;
      ctx.font = `8.5px ${THEME.mono}`;
      for (const d of st.detections) {
        const x = offToX(d.offsetHz);
        if (x < -20 || x > width + 20) continue;
        const sel = d.id === st.selectedId;
        const c = kindColor(d.guessKind);
        ctx.fillStyle = sel ? c : hexA(c, 0.75);
        ctx.beginPath();
        ctx.moveTo(x - 3.5, plotH + 1.5);
        ctx.lineTo(x + 3.5, plotH + 1.5);
        ctx.lineTo(x, plotH + 6.5);
        ctx.closePath();
        ctx.fill();
        // Leader line from the plot top to the label, then the label itself.
        if (x - lastDetLabelX > 66) {
          ctx.strokeStyle = hexA(c, sel ? 0.9 : 0.5);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + 0.5, 0);
          ctx.lineTo(x + 0.5, 8);
          ctx.stroke();
          ctx.fillStyle = sel ? c : hexA(c, 0.85);
          ctx.fillText(d.guessLabel, x + 5, 9);
          lastDetLabelX = x;
        }
      }
      ctx.font = `9px ${THEME.mono}`;

      // VFO needle + frequency pill.
      const vx = offToX(st.tuning);
      if (vx >= 0 && vx <= width) {
        ctx.strokeStyle = hexA(THEME.accent, 0.18);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(vx, 0);
        ctx.lineTo(vx, plotH);
        ctx.stroke();
        ctx.strokeStyle = hexA(THEME.accent, 0.95);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(vx + 0.5, 0);
        ctx.lineTo(vx + 0.5, plotH + 2);
        ctx.stroke();

        const label = fmtFreqMHz(st.centerFreqHz + st.tuning);
        ctx.font = `9.5px ${THEME.mono}`;
        const w = ctx.measureText(label).width + 13;
        let px = vx - w / 2;
        px = Math.max(2, Math.min(width - w - 2, px));
        ctx.fillStyle = THEME.accent;
        roundRect(ctx, px, plotH + 5, w, 16, 8);
        ctx.fill();
        ctx.fillStyle = '#2a1006';
        ctx.fillText(label, px + 6.5, plotH + 16.5);
      }
    };

    // Imperative overlay updates (VFO band, hover hairline, zoom label).
    const updateOverlays = () => {
      const st = sig.current;
      const cx = offToX(st.tuning);
      const bwPx = (st.bandwidth / view.current.spanHz) * width;
      const band = vfoBandRef.current!;
      band.style.left = `${cx - bwPx / 2}px`;
      band.style.width = `${Math.max(2, bwPx)}px`;

      const hl = hoverRef.current!;
      const label = hoverLabelRef.current!;
      const hx = hoverX.current;
      if (hx === null) {
        hl.style.display = 'none';
        label.style.display = 'none';
      } else {
        hl.style.display = 'block';
        hl.style.left = `${hx}px`;
        const off = xToOff(hx);
        const dbv = col[Math.max(0, Math.min(width - 1, Math.round(hx)))];
        label.style.display = 'block';
        label.style.left = `${Math.min(width - 130, hx + 9)}px`;
        label.textContent = `${fmtFreqMHz(st.centerFreqHz + off)} MHz   ${dbv.toFixed(0)} dB`;
      }

      // Lock-on reticle tracks the locked signal through zoom/pan, and fades
      // once the VFO has been tuned off it.
      const lk = lockRef.current;
      const fx = lockFxRef.current;
      if (lk) {
        if (!fx) lk.style.display = 'none';
        else {
          const lx = offToX(fx.offsetHz);
          const lw = Math.max(28, (fx.bandwidthHz / view.current.spanHz) * width + 14);
          lk.style.display = 'block';
          lk.style.left = `${lx - lw / 2}px`;
          lk.style.width = `${lw}px`;
          const away = Math.abs(st.tuning - fx.offsetHz) > Math.max(fx.bandwidthHz / 2, 1500);
          lk.style.opacity = away ? '0' : '1';
        }
      }

      if (zoomLabelRef.current) {
        const z = SAMPLE_RATE / view.current.spanHz;
        zoomLabelRef.current.textContent = z > 1.05 ? `${z.toFixed(1)}×` : '';
      }
    };

    const unsub = getEngine().on('spectrum', onSpectrum);

    // Pointer model.
    //  - Tap: lock onto the nearest detected signal (or tune to the spot).
    //  - Drag: mouse tunes to the cursor; touch slides the dial relative to
    //    where the finger started, so the finger never hides the passband.
    //  - Two fingers: pinch-zoom around their midpoint.
    //  - Shift-drag (zoomed, mouse): pan.
    type G = 'none' | 'pending' | 'tune' | 'pan' | 'pinch';
    let gesture: G = 'none';
    const pts = new Map<number, { x: number; y: number; type: string }>();
    let downX = 0;
    let downY = 0;
    let downTuning = 0;
    let downType = 'mouse';
    let panStartX = 0;
    let panStartCenter = 0;
    let pinchDist = 0;
    let pinchSpan = 0;
    let pinchAnchor = 0;
    let pinchZoomed = false;
    const TAP_SLOP = 7;
    const rectLeft = () => wrap.getBoundingClientRect().left;
    const clampTune = (hz: number) => Math.max(-SAMPLE_RATE / 2, Math.min(SAMPLE_RATE / 2, hz));
    const twoFingers = () => {
      const [a, b] = [...pts.values()];
      return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2 };
    };

    const down = (e: PointerEvent) => {
      // Controls floating over the stage handle their own input.
      if ((e.target as HTMLElement).closest('[data-stage-ui]')) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
      try {
        wrap.setPointerCapture(e.pointerId);
      } catch {
        /* capture is a nicety */
      }
      if (pts.size === 2) {
        const { d, mx } = twoFingers();
        gesture = 'pinch';
        pinchDist = Math.max(20, d);
        pinchSpan = view.current.spanHz;
        pinchAnchor = xToOff(mx - rectLeft());
        pinchZoomed = false;
        return;
      }
      if (pts.size > 2) return;
      if (e.shiftKey && view.current.spanHz < SAMPLE_RATE) {
        gesture = 'pan';
        panStartX = e.clientX;
        panStartCenter = view.current.centerHz;
        return;
      }
      gesture = 'pending';
      downX = e.clientX;
      downY = e.clientY;
      downTuning = sig.current.tuning;
      downType = e.pointerType;
    };
    // Touch devices have no hover, so a readout there would strand on screen.
    const canHover =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(hover: hover)').matches
        : true;

    const move = (e: PointerEvent) => {
      const x = e.clientX - rectLeft();
      hoverX.current =
        canHover && e.pointerType === 'mouse' && x >= 0 && x <= width ? x : null;
      const p = pts.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;

      if (gesture === 'pinch' && pts.size === 2) {
        const { d, mx } = twoFingers();
        let span = pinchSpan * (pinchDist / Math.max(20, d));
        span = Math.max(40_000, Math.min(SAMPLE_RATE, span));
        const mxLocal = mx - rectLeft();
        let center = pinchAnchor - (mxLocal / width - 0.5) * span;
        const maxC = (SAMPLE_RATE - span) / 2;
        center = Math.max(-maxC, Math.min(maxC, center));
        view.current = { centerHz: center, spanHz: span };
        pinchZoomed = true;
        return;
      }
      if (gesture === 'pending') {
        if (Math.abs(e.clientX - downX) < TAP_SLOP && Math.abs(e.clientY - downY) < TAP_SLOP) return;
        gesture = 'tune';
      }
      if (gesture === 'tune') {
        if (downType === 'mouse') setTuning(Math.round(clampTune(xToOff(x))));
        else {
          const dHz = ((e.clientX - downX) / width) * view.current.spanHz;
          setTuning(Math.round(clampTune(downTuning + dHz)));
        }
      } else if (gesture === 'pan') {
        const dHz = ((e.clientX - panStartX) / width) * view.current.spanHz;
        const maxC = (SAMPLE_RATE - view.current.spanHz) / 2;
        view.current.centerHz = Math.max(-maxC, Math.min(maxC, panStartCenter - dHz));
      }
    };

    const up = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (gesture === 'pinch') {
        if (pts.size < 2) {
          if (pinchZoomed) clearWaterfall();
          gesture = 'none';
          // A finger still down after a pinch shouldn't turn into a tap.
          pts.clear();
        }
        return;
      }
      if (gesture === 'pending') {
        const off = xToOff(e.clientX - rectLeft());
        // Of the emissions whose footprint (plus a finger's width) covers the
        // tap, the strongest wins, with up to 6 dB off for distance from its
        // center. Nearest-center alone let a weak 4 kHz fragment on a station's
        // skirt beat the 180 kHz station you actually tapped.
        const slopHz = (18 / Math.max(1, width)) * view.current.spanHz;
        let best: TrackMsg | null = null;
        let bestScore = -Infinity;
        for (const d of sig.current.detections) {
          const reach = d.bandwidthHz / 2 + slopHz;
          const dist = Math.abs(d.offsetHz - off);
          if (dist > reach) continue;
          const score = d.snrDb - 6 * (dist / Math.max(reach, 1));
          if (score > bestScore) {
            best = d;
            bestScore = score;
          }
        }
        if (best) {
          lock();
          useStore.getState().lockOn(best);
        } else {
          tick();
          setTuning(Math.round(clampTune(off)));
        }
      }
      if (pts.size === 0) gesture = 'none';
    };
    const cancel = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size === 0) gesture = 'none';
    };
    const leave = () => {
      hoverX.current = null;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const x = e.clientX - rectLeft();
      const anchorOff = xToOff(x);
      const factor = e.deltaY < 0 ? 0.8 : 1.25;
      let newSpan = view.current.spanHz * factor;
      newSpan = Math.max(40_000, Math.min(SAMPLE_RATE, newSpan));
      // Keep the frequency under the cursor fixed.
      let newCenter = anchorOff - (x / width - 0.5) * newSpan;
      const maxC = (SAMPLE_RATE - newSpan) / 2;
      newCenter = Math.max(-maxC, Math.min(maxC, newCenter));
      view.current = { centerHz: newCenter, spanHz: newSpan };
      clearWaterfall();
    };
    const dbl = () => {
      view.current = { centerHz: 0, spanHz: SAMPLE_RATE };
      clearWaterfall();
    };

    wrap.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    wrap.addEventListener('pointerleave', leave);
    wrap.addEventListener('wheel', wheel, { passive: false });
    wrap.addEventListener('dblclick', dbl);

    return () => {
      unsub();
      ro.disconnect();
      wrap.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      wrap.removeEventListener('pointerleave', leave);
      wrap.removeEventListener('wheel', wheel);
      wrap.removeEventListener('dblclick', dbl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const autoLevel = () => {
    const col = lastCol.current;
    if (!col.length) return;
    const sorted = Float32Array.from(col).sort();
    const p = (q: number) => sorted[Math.floor(q * (sorted.length - 1))];
    const floor = Math.round(p(0.05) - 4);
    // Keep at least 45 dB of range: a band caught between transmissions
    // would otherwise level to the noise and saturate the first key-up.
    const ceil = Math.max(Math.round(p(0.99) + 6), floor + 45);
    setDbRange(floor, ceil);
  };
  autoLevelRef.current = autoLevel;

  return (
    <div ref={wrapRef} data-guide="waterfall" className="absolute inset-0 flex cursor-crosshair flex-col touch-none">
      <WaterfallControls onAuto={autoLevel} zoomLabelRef={zoomLabelRef} />
      <div ref={vfoBandRef} className="vfo-band" />
      <div
        ref={lockRef}
        aria-hidden
        className="pointer-events-none absolute top-0 z-[6] transition-opacity duration-300"
        style={{ height: SPEC_H - RULER_H, display: 'none' }}
      >
        {lockFx && <LockReticle key={lockFx.at} mode={lockFx.mode} label={lockFx.label} />}
      </div>
      <div ref={hoverRef} className="hover-line" />
      <div ref={hoverLabelRef} className="hover-label" />
      <canvas ref={specRef} style={{ height: SPEC_H }} />
      <canvas ref={wfRef} style={{ flex: 1 }} />
    </div>
  );
}

/** Pick a readable dB grid step for the visible dynamic range. */
function range10(total: number): number {
  if (total <= 40) return 10;
  if (total <= 80) return 20;
  return 30;
}


/**
 * Target lock: four brackets close in on the signal and settle, with a tag
 * naming what the receiver thinks it is and the mode it switched to.
 */
function LockReticle({ mode, label }: { mode: string; label: string }) {
  const corner = 'absolute size-2.5 border-emerald-500 dark:border-emerald-400';
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ scale: 1.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
    >
      <span className={`${corner} left-0 top-1 border-l-2 border-t-2`} />
      <span className={`${corner} right-0 top-1 border-r-2 border-t-2`} />
      <span className={`${corner} bottom-0 left-0 border-b-2 border-l-2`} />
      <span className={`${corner} bottom-0 right-0 border-b-2 border-r-2`} />
      <motion.span
        className="absolute inset-0 rounded-sm bg-emerald-500/15"
        initial={{ opacity: 0.9 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
      <motion.span
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="mono-feats absolute bottom-[7px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm bg-emerald-500 px-1.5 py-[1px] font-mono text-[8.5px] font-semibold uppercase tracking-[0.12em] text-white shadow-sm dark:bg-emerald-400 dark:text-emerald-950"
      >
        Lock · {mode} · {label}
      </motion.span>
    </motion.div>
  );
}
