import { useState } from 'react';
import { WidgetCard, useStaticCanvas, canvasClass, AX, hline } from './shared';
import { Fader } from '../../ui/deck/Fader';

/** Ohm's law: V = I·R with a live V/I plot. */
export function OhmsLawPlot() {
  const [r, setR] = useState(100);
  const ref = useStaticCanvas((ctx, w, h) => {
    const pad = 26;
    const pw = w - pad - 8;
    const ph = h - pad - 6;
    // axes: x = I (0..0.12A), y = V (0..12V)
    hline(ctx, h - pad, w, AX.grid);
    ctx.strokeStyle = AX.grid;
    ctx.beginPath();
    ctx.moveTo(pad, 4);
    ctx.lineTo(pad, h - pad);
    ctx.stroke();
    ctx.font = `8px ${AX.mono}`;
    ctx.fillStyle = AX.dim;
    ctx.fillText('I (A)', w - 30, h - pad + 12);
    ctx.fillText('V', 6, 14);
    const x = (i: number) => pad + (i / 0.12) * pw;
    const y = (v: number) => h - pad - (v / 12) * ph;
    for (const [rr, color] of [[r, AX.accent], [50, AX.dim], [220, AX.dim]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = rr === r ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x(0), y(0));
      ctx.lineTo(x(0.12), y(0.12 * rr));
      ctx.stroke();
      if (rr === r) {
        ctx.fillStyle = AX.label;
        ctx.fillText(`${rr} Ω slope`, x(0.055), y(0.12 * rr) - 4);
      } else {
        ctx.fillStyle = AX.dim;
        ctx.fillText(`${rr}`, x(0.1), y(0.12 * rr) - 4);
      }
    }
  }, [r]);

  return (
    <WidgetCard title="Ohm's law" blurb="V = I·R. The plot's slope IS the resistance — steeper means more ohms.">
      <canvas ref={ref} className={canvasClass} />
      <div className="mt-2.5">
        <Fader name="Resistance" value={r} min={10} max={470} step={10} fmt={(v) => `${v} Ω`} onChange={setR} />
      </div>
    </WidgetCard>
  );
}

/** Voltage divider with resistor values. */
export function VoltageDivider() {
  const [r1, setR1] = useState(10);
  const [r2, setR2] = useState(22);
  const vin = 12;
  const vout = (vin * r2) / (r1 + r2);
  return (
    <WidgetCard title="Voltage divider" blurb="Two resistors split voltage in their ratio — the most-used circuit in electronics.">
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
        {[
          [`${vin.toFixed(0)} V`, 'input'],
          [`${vout.toFixed(2)} V`, 'output'],
          [`${((r2 / (r1 + r2)) * 100).toFixed(0)}%`, 'ratio R₂/(R₁+R₂)'],
        ].map(([v, l]) => (
          <div key={l} className="bg-background p-3 text-center">
            <div className="mono-feats font-mono text-[15px] text-foreground">{v}</div>
            <div className="mono-feats mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-foreground">{l}</div>
          </div>
        ))}
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-4">
        <Fader name="R₁" value={r1} min={1} max={100} step={1} fmt={(v) => `${v} kΩ`} onChange={setR1} />
        <Fader name="R₂" value={r2} min={1} max={100} step={1} fmt={(v) => `${v} kΩ`} onChange={setR2} />
      </div>
    </WidgetCard>
  );
}

const BAND_COLORS = [
  ['black', '#1c1c1e', 0], ['brown', '#7b4a2b', 1], ['red', '#d5362f', 2],
  ['orange', '#f07020', 3], ['yellow', '#f5d020', 4], ['green', '#2f9e4f', 5],
  ['blue', '#2a6fd6', 6], ['violet', '#8a4fd6', 7], ['grey', '#8a8a8e', 8], ['white', '#f2f2f2', 9],
] as const;

/** 4-band resistor colour decoder. */
export function ColourCodeDecoder() {
  const [bands, setBands] = useState([4, 7, 2]); // yellow, violet, red
  const [d1, d2, mul] = bands;
  const value = (d1 * 10 + d2) * 10 ** mul;
  const fmt = (v: number) =>
    v >= 1e6 ? `${(v / 1e6).toFixed(1).replace(/\.0$/, '')} MΩ` : v >= 1e3 ? `${(v / 1e3).toFixed(1).replace(/\.0$/, '')} kΩ` : `${v} Ω`;

  return (
    <WidgetCard title="Colour code" blurb="Resistors say their value in stripes: digit, digit, multiplier. Click the bands.">
      <div className="flex items-center justify-center gap-2 py-1">
        <div className="flex h-10 w-44 items-stretch justify-center gap-2 rounded-sm bg-gradient-to-r from-[#c9a86a] via-[#e0c48c] to-[#c9a86a] px-3 py-1">
          {bands.map((b, i) => (
            <button
              key={i}
              onClick={() => setBands((prev) => prev.map((v, j) => (j === i ? (v + 1) % 10 : v)))}
              className="w-6 rounded-[2px] transition-transform hover:scale-y-110"
              style={{ background: BAND_COLORS[b][1] }}
              title={`Band ${i + 1}: ${BAND_COLORS[b][0]} (${i === 2 ? `×10^${BAND_COLORS[b][2]}` : BAND_COLORS[b][2]})`}
            />
          ))}
        </div>
        <div className="mono-feats ml-3 font-mono text-lg text-foreground">{fmt(value)}</div>
      </div>
      <div className="mono-feats text-center font-mono text-[9.5px] text-muted-foreground">
        {BAND_COLORS[d1][0]} {BAND_COLORS[d2][0]} {BAND_COLORS[mul][0]} = {d1}
        {d2} × 10^{mul} ±5%
      </div>
    </WidgetCard>
  );
}

/** LC resonance: f₀ and the response curve. */
export function ResonanceCalc() {
  const [l, setL] = useState(10); // µH
  const [c, setC] = useState(100); // pF
  const f0 = 1 / (2 * Math.PI * Math.sqrt(l * 1e-6 * c * 1e-12));
  const fmtF = (f: number) => (f >= 1e6 ? `${(f / 1e6).toFixed(2)} MHz` : `${(f / 1e3).toFixed(0)} kHz`);

  const ref = useStaticCanvas((ctx, w, h) => {
    const mid = h - 20;
    // response curve: 1/sqrt(1 + (Q*(f/f0 - f0/f))^2), log x around f0
    const Q = 12;
    const fLo = f0 / 4;
    const fHi = f0 * 4;
    ctx.strokeStyle = AX.trace;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const f = fLo * (fHi / fLo) ** (x / w);
      const g = 1 / Math.sqrt(1 + (Q * (f / f0 - f0 / f)) ** 2);
      const y = mid - g * (h - 34);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    const xf = (Math.log(1) / Math.log(fHi / fLo)) * w; // f=f0 → ratio 1
    ctx.strokeStyle = AX.accent;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(xf, 4);
    ctx.lineTo(xf, mid);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `9px ${AX.mono}`;
    ctx.fillStyle = AX.accentHi;
    ctx.fillText(`f₀ = ${fmtF(f0)}`, Math.min(w - 80, xf + 6), 12);
    ctx.fillStyle = AX.dim;
    ctx.fillText(fmtF(fLo), 4, h - 6);
    ctx.fillText(fmtF(fHi), w - 44, h - 6);
  }, [l, c, f0]);

  return (
    <WidgetCard title="Resonance" blurb="A coil and a capacitor trade energy back and forth at f₀ = 1/(2π√(LC)). This is how radios pick one station from the whole band.">
      <canvas ref={ref} className={canvasClass} />
      <div className="mt-2.5 grid grid-cols-2 gap-4">
        <Fader name="Inductance" value={l} min={1} max={100} step={1} fmt={(v) => `${v} µH`} onChange={setL} />
        <Fader name="Capacitance" value={c} min={10} max={1000} step={10} fmt={(v) => `${v} pF`} onChange={setC} />
      </div>
    </WidgetCard>
  );
}
