import { useMemo, useState } from 'react';
import { WidgetCard } from './shared';
import { Fader } from '../../ui/deck/Fader';
import { gridToLatLon, greatCircle, isValidGrid } from '../../sim/geo';
import { cn } from '@/lib/utils';

/** Grid squares → distance + short/long-path beam headings. */
export function GridBeam() {
  const [home, setHome] = useState('FN30');
  const [dx, setDx] = useState('PM84');

  const result = useMemo(() => {
    if (!isValidGrid(home) || !isValidGrid(dx)) return null;
    const a = gridToLatLon(home);
    const b = gridToLatLon(dx);
    if (!a || !b) return null;
    return greatCircle(a, b);
  }, [home, dx]);

  const inputCls = (valid: boolean) =>
    cn(
      'mono-feats w-full rounded-lg border bg-background px-2.5 py-1.5 font-mono text-[13px] uppercase text-foreground focus:outline-2',
      valid ? 'border-border focus:outline-ring' : 'border-destructive focus:outline-destructive',
    );

  return (
    <WidgetCard
      title="Beam heading"
      blurb="Maidenhead grid squares to great-circle path. Aim the yagi along the short path — or the long way around, if the band gods say so."
    >
      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="mono-feats font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            Your grid
          </span>
          <input
            value={home}
            onChange={(e) => setHome(e.target.value.toUpperCase().slice(0, 6))}
            className={inputCls(isValidGrid(home))}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="mono-feats font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            DX grid
          </span>
          <input
            value={dx}
            onChange={(e) => setDx(e.target.value.toUpperCase().slice(0, 6))}
            className={inputCls(isValidGrid(dx))}
          />
        </label>
      </div>
      {result ? (
        <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
          {[
            [`${result.km.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'km'],
            [`${result.shortPathDeg.toFixed(0)}° ${result.compass}`, 'short path'],
            [`${result.longPathDeg.toFixed(0)}°`, 'long path'],
          ].map(([v, l]) => (
            <div key={l} className="bg-background p-2.5 text-center">
              <div className="mono-feats font-mono text-[14px] text-foreground">{v}</div>
              <div className="mono-feats mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-foreground">
                {l}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Enter two grid squares (e.g. FN30, PM84, GF05).
        </p>
      )}
    </WidgetCard>
  );
}

const ANTENNAS: { id: string; label: string; fraction: number; k: number; parts: (total: number) => [string, number][] }[] = [
  {
    id: 'dipole',
    label: 'Half-wave dipole',
    fraction: 0.5,
    k: 0.95,
    parts: (t) => [
      ['total', t],
      ['each leg', t / 2],
    ],
  },
  {
    id: 'vertical',
    label: 'Quarter-wave vertical',
    fraction: 0.25,
    k: 0.95,
    parts: (t) => [['element', t]],
  },
  {
    id: 'loop',
    label: 'Full-wave loop',
    fraction: 1,
    k: 1.02,
    parts: (t) => [
      ['total', t],
      ['each side', t / 4],
    ],
  },
];

/** Resonant antenna lengths with the end-effect K factor. */
export function AntennaCalc() {
  const [mhz, setMhz] = useState(14.1);
  const [type, setType] = useState('dipole');
  const a = ANTENNAS.find((x) => x.id === type)!;
  const lambdaFt = (299_792_458 / (mhz * 1e6)) * 3.28084;
  const totalFt = lambdaFt * a.fraction * a.k;
  const totalM = totalFt * 0.3048;

  return (
    <WidgetCard
      title="Antenna lengths"
      blurb="Resonant length = λ × fraction × K. The end effect makes wire act electrically longer, so dipoles and verticals cut 5% short — but a loop goes 2% long."
    >
      <div className="flex gap-1.5">
        {ANTENNAS.map((x) => (
          <button
            key={x.id}
            onClick={() => setType(x.id)}
            className={cn(
              'mono-feats rounded-md border px-2.5 py-1 font-mono text-[10px] transition-colors',
              type === x.id
                ? 'border-foreground bg-secondary text-foreground'
                : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground',
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
        {a.parts(totalM).map(([label, v]) => (
          <div key={label} className="bg-background p-2.5 text-center">
            <div className="mono-feats font-mono text-[14px] text-foreground">
              {v.toFixed(2)} m
            </div>
            <div className="mono-feats mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-foreground">
              {label} · {(v / 0.3048).toFixed(1)} ft
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2.5">
        <Fader
          name="Frequency"
          value={mhz}
          min={1.8}
          max={54}
          step={0.1}
          fmt={(v) => `${v.toFixed(1)} MHz`}
          onChange={setMhz}
        />
      </div>
    </WidgetCard>
  );
}
