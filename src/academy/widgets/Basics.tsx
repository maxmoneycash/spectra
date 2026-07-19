import { useState } from 'react';
import { WidgetCard, useStaticCanvas, canvasClass, AX, hline } from './shared';
import { Fader } from '../../ui/deck/Fader';

/** One sine, three knobs: amplitude, frequency, phase. */
export function SineExplorer() {
  const [amp, setAmp] = useState(0.8);
  const [freq, setFreq] = useState(3);
  const [phase, setPhase] = useState(0);
  const ref = useStaticCanvas((ctx, w, h) => {
    const mid = h / 2;
    hline(ctx, mid, w);
    ctx.strokeStyle = AX.trace;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const y = mid - amp * Math.sin(u * freq * Math.PI * 2 + phase) * (h / 2 - 12);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.font = `9px ${AX.mono}`;
    ctx.fillStyle = AX.label;
    ctx.fillText(`y = ${amp.toFixed(2)}·sin(${freq}·2πx ${phase >= 0 ? '+' : '−'} ${Math.abs(phase).toFixed(2)})`, 6, 12);
  }, [amp, freq, phase]);

  return (
    <WidgetCard title="The sine wave" blurb="Every RF signal is built from sines. Three numbers describe one completely.">
      <canvas ref={ref} className={canvasClass} />
      <div className="mt-2.5 grid grid-cols-3 gap-4">
        <Fader name="Amplitude" value={amp} min={0.1} max={1} step={0.05} fmt={(v) => v.toFixed(2)} onChange={setAmp} />
        <Fader name="Frequency" value={freq} min={1} max={8} step={1} fmt={(v) => `${v} Hz`} onChange={setFreq} />
        <Fader name="Phase" value={phase} min={-3.14} max={3.14} step={0.1} fmt={(v) => `${v.toFixed(1)} rad`} onChange={setPhase} />
      </div>
    </WidgetCard>
  );
}

/** λ = c/ν locked pair. */
export function WavelengthConverter() {
  const [logHz, setLogHz] = useState(7); // log10(Hz)
  const hz = 10 ** logHz;
  const lambda = 299_792_458 / hz;
  const fmtLambda = (m: number) =>
    m >= 1000 ? `${(m / 1000).toFixed(2)} km` : m >= 1 ? `${m.toFixed(1)} m` : `${(m * 100).toFixed(1)} cm`;
  const fmtHz = (f: number) =>
    f >= 1e9 ? `${(f / 1e9).toFixed(2)} GHz` : f >= 1e6 ? `${(f / 1e6).toFixed(1)} MHz` : `${(f / 1e3).toFixed(0)} kHz`;

  const ref = useStaticCanvas((ctx, w, h) => {
    // spectrum bar with the current frequency marked
    const x0 = 20;
    const x1 = w - 20;
    const logTo = (l: number) => x0 + ((l - 3) / 9) * (x1 - x0);
    hline(ctx, h / 2, 0);
    ctx.strokeStyle = AX.grid;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x0, h / 2);
    ctx.lineTo(x1, h / 2);
    ctx.stroke();
    for (let l = 3; l <= 12; l++) {
      const x = logTo(l);
      ctx.strokeStyle = AX.grid;
      ctx.beginPath();
      ctx.moveTo(x, h / 2 - 8);
      ctx.lineTo(x, h / 2 + 8);
      ctx.stroke();
      if (l % 3 === 0) {
        ctx.font = `8px ${AX.mono}`;
        ctx.fillStyle = AX.dim;
        ctx.fillText(fmtHz(10 ** l), x - 8, h / 2 + 20);
      }
    }
    const x = logTo(logHz);
    ctx.strokeStyle = AX.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, h / 2 - 16);
    ctx.lineTo(x, h / 2 + 16);
    ctx.stroke();
    ctx.font = `10px ${AX.mono}`;
    ctx.fillStyle = AX.accentHi;
    const label = `${fmtHz(hz)}  ↔  ${fmtLambda(lambda)}`;
    ctx.fillText(label, Math.min(w - ctx.measureText(label).width - 8, Math.max(8, x - 40)), h / 2 - 24);
  }, [logHz, hz, lambda]);

  return (
    <WidgetCard title="Wavelength ↔ frequency" blurb="Locked together by λ = c / ν. Higher frequency, shorter wave — antennas are sized from this.">
      <canvas ref={ref} className={canvasClass} />
      <div className="mt-2.5">
        <Fader
          name="Frequency"
          value={logHz}
          min={3}
          max={12}
          step={0.1}
          fmt={() => `${fmtHz(hz)} · λ ${fmtLambda(lambda)}`}
          onChange={setLogHz}
        />
      </div>
    </WidgetCard>
  );
}

/** SI prefixes from pico to giga. */
export function PrefixConverter() {
  const [exp, setExp] = useState(6);
  const [value, setValue] = useState(98.5);
  const prefixes: [number, string][] = [
    [-12, 'p'], [-9, 'n'], [-6, 'µ'], [-3, 'm'], [0, ''], [3, 'k'], [6, 'M'], [9, 'G'],
  ];
  const idx = prefixes.findIndex(([e]) => e === exp);
  const scaled = value * 10 ** (exp - 6);

  return (
    <WidgetCard title="SI prefixes" blurb="Radio speaks in kHz, MHz, GHz and pF, nF, µH. Slide the exponent and watch the same quantity change costume.">
      <div className="mono-feats rounded-lg border border-border bg-stage p-4 text-center font-mono">
        <div className="text-2xl text-stage-foreground">
          {scaled >= 1000 || (scaled < 0.01 && scaled > 0) ? scaled.toExponential(2) : scaled.toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
          <span className="text-stage-muted">{prefixes[idx][1]}Hz</span>
        </div>
        <div className="mt-1 text-[11px] text-stage-muted">
          = {(scaled * 10 ** exp).toExponential(2)} Hz
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-4">
        <Fader name="Value" value={value} min={1} max={999} step={0.5} fmt={(v) => v.toFixed(1)} onChange={setValue} />
        <Fader
          name="Prefix"
          value={idx}
          min={0}
          max={prefixes.length - 1}
          step={1}
          fmt={(i) => `${prefixes[Math.round(i)][1] || '(base)'} (10^${prefixes[Math.round(i)][0]})`}
          onChange={(i) => setExp(prefixes[Math.round(i)][0])}
        />
      </div>
    </WidgetCard>
  );
}

/** dB ↔ ratio converter. */
export function DbCalculator() {
  const [db, setDb] = useState(10);
  const powerRatio = 10 ** (db / 10);
  const voltRatio = 10 ** (db / 20);
  return (
    <WidgetCard title="The decibel" blurb="dB is a logarithmic ratio — it turns huge multiplications into small additions. +3 dB doubles power, +10 dB is ten times, +20 dB a hundred.">
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
        {[
          [`${db.toFixed(1)} dB`, 'decibels'],
          [`${powerRatio >= 1000 ? powerRatio.toExponential(1) : powerRatio.toFixed(2)}×`, 'power ratio'],
          [`${voltRatio.toFixed(2)}×`, 'voltage ratio'],
        ].map(([v, l]) => (
          <div key={l} className="bg-background p-3 text-center">
            <div className="mono-feats font-mono text-[15px] text-foreground">{v}</div>
            <div className="mono-feats mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-foreground">{l}</div>
          </div>
        ))}
      </div>
      <div className="mt-2.5">
        <Fader name="dB" value={db} min={-30} max={60} step={0.5} fmt={(v) => `${v.toFixed(1)} dB`} onChange={setDb} />
      </div>
    </WidgetCard>
  );
}
