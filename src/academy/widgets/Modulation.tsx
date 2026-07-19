import { useState } from 'react';
import { WidgetCard, useStaticCanvas, canvasClass, AX, hline } from './shared';
import { Fader } from '../../ui/deck/Fader';

/** AM: modulation index drives time + frequency views; overmodulation past m=1. */
export function AmModulationExplorer() {
  const [m, setM] = useState(0.6);
  const ref = useStaticCanvas((ctx, w, h) => {
    const mid = h / 2;
    const env = (u: number) => Math.sin(u * Math.PI * 4);
    // envelope (dashed)
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = AX.accent;
    ctx.lineWidth = 1;
    for (const s of [1, -1]) {
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const y = mid - s * (1 + m * env(u)) * (h / 2 - 14) * 0.9;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // carrier
    ctx.strokeStyle = AX.trace;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const y = mid - (1 + m * env(u)) * Math.sin(u * 120) * (h / 2 - 14) * 0.9;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    hline(ctx, mid, w);
    ctx.font = `9px ${AX.mono}`;
    ctx.fillStyle = m > 1 ? '#ff6e5a' : AX.label;
    ctx.fillText(
      m > 1 ? 'm > 1 — overmodulated: the envelope tears, splatter everywhere' : `m = ${m.toFixed(2)} — carrier and sidebands carry the message`,
      6,
      12,
    );
  }, [m]);

  return (
    <WidgetCard
      title="AM, by hand"
      blurb="Amplitude modulation scales the carrier with the message. Push the index past 100% and watch it break."
    >
      <canvas ref={ref} className={canvasClass} />
      <div className="mt-2.5">
        <Fader
          name="Modulation index"
          value={m}
          min={0}
          max={1.4}
          step={0.05}
          fmt={(v) => `${Math.round(v * 100)}%`}
          onChange={setM}
        />
      </div>
    </WidgetCard>
  );
}

/** FM: deviation drives the carrier's frequency swing (and its bandwidth). */
export function FmModulationExplorer() {
  const [dev, setDev] = useState(3);
  const ref = useStaticCanvas((ctx, w, h) => {
    const mid = h / 2;
    const msg = (u: number) => Math.sin(u * Math.PI * 4);
    ctx.strokeStyle = AX.trace;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const phase = u * 90 - dev * 1.6 * Math.cos(u * Math.PI * 4);
      const y = mid - Math.sin(phase) * (h / 2 - 14) * 0.85;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // message trace for reference
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = AX.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const y = mid - msg(u) * (h / 2 - 14) * 0.85;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    hline(ctx, mid, w);
    ctx.font = `9px ${AX.mono}`;
    ctx.fillStyle = AX.label;
    const bw = 2 * (dev + 1);
    ctx.fillText(`the wave speeds up and slows down with the message · Carson BW ≈ ${bw.toFixed(0)}× fm`, 6, 12);
  }, [dev]);

  return (
    <WidgetCard
      title="FM, by hand"
      blurb="Frequency modulation keeps amplitude constant and bends the wave's speed instead. More deviation means more bandwidth — and better noise rejection."
    >
      <canvas ref={ref} className={canvasClass} />
      <div className="mt-2.5">
        <Fader
          name="Deviation"
          value={dev}
          min={0.5}
          max={8}
          step={0.5}
          fmt={(v) => `±${v.toFixed(1)} kHz`}
          onChange={setDev}
        />
      </div>
    </WidgetCard>
  );
}
