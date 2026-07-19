import { useState } from 'react';
import { WidgetCard, useStaticCanvas, canvasClass, AX } from './shared';
import { Fader } from '../../ui/deck/Fader';

/** SWR from forward/reflected power, with the meter verdict. */
export function SwrExplorer() {
  const [fwd, setFwd] = useState(50);
  const [rfl, setRfl] = useState(5);
  const reflClamped = Math.min(rfl, fwd - 0.1);
  const gamma = Math.sqrt(reflClamped / fwd);
  const swr = (1 + gamma) / (1 - gamma);
  const lostPct = gamma * gamma * 100;
  const verdict = swr < 1.5 ? 'excellent — almost everything radiates' : swr < 2.5 ? 'fine for most rigs' : swr < 4 ? 'mismatch — check the antenna' : 'stop — something is wrong';

  const ref = useStaticCanvas((ctx, w, h) => {
    const y = h / 2;
    const barW = (v: number, max: number) => (v / max) * (w - 90);
    const max = Math.max(fwd, 1);
    ctx.font = `9px ${AX.mono}`;
    // forward bar
    ctx.fillStyle = AX.trace;
    ctx.fillRect(70, y - 24, barW(fwd, max), 14);
    ctx.fillStyle = AX.label;
    ctx.fillText('FWD', 6, y - 14);
    ctx.fillText(`${fwd.toFixed(0)} W`, 74 + barW(fwd, max), y - 14);
    // reflected bar
    ctx.fillStyle = AX.accent;
    ctx.fillRect(70, y + 6, barW(reflClamped, max), 14);
    ctx.fillStyle = AX.label;
    ctx.fillText('RFL', 6, y + 16);
    ctx.fillText(`${reflClamped.toFixed(1)} W`, 74 + barW(reflClamped, max), y + 16);
  }, [fwd, reflClamped]);

  return (
    <WidgetCard title="SWR" blurb="The standing-wave ratio compares forward and reflected power. 1:1 is perfect; the reflected energy heats your final, not the ionosphere.">
      <canvas ref={ref} className={canvasClass} />
      <div className="mono-feats mt-2.5 flex items-baseline justify-between font-mono text-[12px]">
        <span className="text-foreground">SWR {swr.toFixed(2)} : 1</span>
        <span className="text-muted-foreground">{lostPct.toFixed(0)}% lost</span>
      </div>
      <div className="mt-0.5 text-[10.5px] text-muted-foreground">{verdict}</div>
      <div className="mt-2.5 grid grid-cols-2 gap-4">
        <Fader name="Forward" value={fwd} min={5} max={100} step={1} fmt={(v) => `${v} W`} onChange={setFwd} />
        <Fader name="Reflected" value={rfl} min={0} max={50} step={0.5} fmt={(v) => `${v} W`} onChange={setRfl} />
      </div>
    </WidgetCard>
  );
}

/** Dipole length from frequency + a small current/voltage sketch. */
export function DipoleLength() {
  const [mhz, setMhz] = useState(14.1);
  const totalM = 143 / mhz; // half-wave dipole with velocity factor
  const legM = totalM / 2;

  const ref = useStaticCanvas((ctx, w, h) => {
    const mid = h / 2;
    const x0 = 30;
    const x1 = w - 30;
    // dipole wire
    ctx.strokeStyle = AX.trace;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, mid);
    ctx.lineTo(x1, mid);
    ctx.stroke();
    // feed point
    ctx.fillStyle = AX.accent;
    ctx.fillRect(w / 2 - 2, mid - 5, 4, 10);
    // current envelope
    ctx.strokeStyle = AX.accent;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / (x1 - x0);
      const y = mid - Math.sin(u * Math.PI) * (h / 2 - 14);
      if (x === x0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `8.5px ${AX.mono}`;
    ctx.fillStyle = AX.label;
    ctx.fillText('current peaks at the feed point, zero at the ends', x0, h - 8);
    ctx.fillText(`${legM.toFixed(2)} m`, x0, mid + 16);
    ctx.fillText(`${legM.toFixed(2)} m`, x1 - ctx.measureText(`${legM.toFixed(2)} m`).width, mid + 16);
  }, [mhz, legM]);

  return (
    <WidgetCard title="Dipole length" blurb="A half-wave dipole is the most-loved antenna on HF: total length ≈ 143 / f(MHz) metres, split into two legs.">
      <canvas ref={ref} className={canvasClass} />
      <div className="mono-feats mt-2 text-center font-mono text-[12px] text-foreground">
        {(143 / mhz).toFixed(2)} m total · two legs of {(143 / mhz / 2).toFixed(2)} m
      </div>
      <div className="mt-2.5">
        <Fader name="Frequency" value={mhz} min={3} max={30} step={0.1} fmt={(v) => `${v.toFixed(1)} MHz`} onChange={setMhz} />
      </div>
    </WidgetCard>
  );
}
