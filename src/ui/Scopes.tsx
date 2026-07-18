import { useEffect, useRef } from 'react';
import { getEngine } from '../engine/engine';
import { THEME } from './theme';

const SIZE = 92;

/** IQ constellation / phase scope of the tuned channel (post-filter). */
function IQScope() {
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
      ctx.fillStyle = 'rgba(12,11,13,0.32)';
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
  return (
    <div className="scope-well">
      <div className="scope-title">IQ</div>
      <canvas ref={ref} className="scope-canvas" style={{ width: SIZE, height: SIZE }} />
    </div>
  );
}

/** Time-domain scope of the demodulated audio. */
function AudioScope() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0;
    const resize = () => {
      w = canvas.clientWidth || 180;
      canvas.width = w * dpr;
      canvas.height = SIZE * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = THEME.scopeBg;
      ctx.fillRect(0, 0, w, SIZE);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const unsub = getEngine().on('audio', (pcm) => {
      ctx.fillStyle = THEME.scopeBg;
      ctx.fillRect(0, 0, w, SIZE);
      ctx.strokeStyle = THEME.scopeGrid;
      ctx.beginPath();
      ctx.moveTo(0, SIZE / 2);
      ctx.lineTo(w, SIZE / 2);
      ctx.stroke();
      ctx.strokeStyle = THEME.scopeTrace;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const step = pcm.length / w;
      for (let x = 0; x < w; x++) {
        const s = pcm[Math.floor(x * step)] || 0;
        const y = SIZE / 2 - s * (SIZE / 2) * 0.88;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
    return () => {
      unsub();
      ro.disconnect();
    };
  }, []);
  return (
    <div className="scope-well" style={{ flex: 1, minWidth: 0 }}>
      <div className="scope-title">Audio</div>
      <canvas ref={ref} className="scope-canvas" style={{ width: '100%', height: SIZE }} />
    </div>
  );
}

/** Deck scopes: IQ constellation + audio waveform, side by side. */
export function DeckScopes() {
  return (
    <>
      <IQScope />
      <AudioScope />
    </>
  );
}
