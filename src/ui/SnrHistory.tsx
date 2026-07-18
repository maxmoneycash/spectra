import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import { getEngine } from '../engine/engine';

const LEN = 150;

/** Live SNR-over-time strip chart for one tracked signal (uPlot). */
export function SnrHistory({ trackId }: { trackId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const xs = Array.from({ length: LEN }, (_, i) => i);
    const ys = new Array<number | null>(LEN).fill(null);

    const opts: uPlot.Options = {
      width: el.clientWidth || 300,
      height: 70,
      cursor: { show: false },
      legend: { show: false },
      scales: { x: { time: false }, y: { range: [0, 60] } },
      axes: [
        { show: false },
        {
          stroke: '#6a6a70',
          grid: { stroke: 'rgba(255,255,255,0.05)' },
          font: '9px "SF Mono", ui-monospace, monospace',
          size: 26,
          values: (_u, vals) => vals.map((v) => `${v}`),
        },
      ],
      series: [
        {},
        { stroke: '#f5622f', width: 1.5, fill: 'rgba(245,98,47,0.14)', points: { show: false } },
      ],
    };
    const u = new uPlot(opts, [xs, ys.slice() as number[]], el);
    const ro = new ResizeObserver(() => u.setSize({ width: el.clientWidth || 300, height: 70 }));
    ro.observe(el);

    const unsub = getEngine().on('detections', (tracks) => {
      const t = tracks.find((x) => x.id === trackId);
      ys.push(t ? t.snrDb : null);
      ys.shift();
      u.setData([xs, ys.slice() as number[]]);
    });
    return () => {
      unsub();
      ro.disconnect();
      u.destroy();
    };
  }, [trackId]);

  return (
    <div style={{ marginTop: 8 }}>
      <div className="scope-title">SNR history (dB)</div>
      <div ref={ref} className="uplot-host" />
    </div>
  );
}
