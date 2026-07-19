import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Fader } from '../ui/deck/Fader';
import { THEME } from '../ui/theme';

type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void;

/** rAF-driven demo canvas: DPR-scaled, pauses offscreen, static when reduced motion. */
function Demo({ draw, ariaLabel }: { draw: DrawFn; ariaLabel: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = true;
    const t0 = performance.now();

    const resize = () => {
      w = canvas.clientWidth || 280;
      h = canvas.clientHeight || 84;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const frame = (now: number) => {
      raf = 0;
      const t = (now - t0) / 1000;
      ctx.fillStyle = THEME.scopeBg;
      ctx.fillRect(0, 0, w, h);
      drawRef.current(ctx, w, h, reduced ? 0 : t);
      if (!reduced && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf && !reduced) raf = requestAnimationFrame(frame);
    });
    io.observe(canvas);

    if (reduced) frame(t0);
    else raf = requestAnimationFrame(frame);

    return () => {
      io.disconnect();
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-label={ariaLabel}
      role="img"
      className="block h-[84px] w-full rounded-lg border border-border"
      style={{ background: THEME.scopeBg }}
    />
  );
}

/* ---------------- Individual demo drawings ---------------- */

function useWavelengthDemo() {
  const [cycles, setCycles] = useState(3);
  return {
    controls: (
      <Fader name="Frequency" value={cycles} min={1} max={8} step={0.5} fmt={(v) => `${v.toFixed(1)}×`} onChange={setCycles} />
    ),
    draw: ((ctx, w, h, t) => {
      const mid = h / 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(w, mid);
      ctx.stroke();
      ctx.strokeStyle = THEME.trace;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const y = mid - Math.sin((x / w) * cycles * Math.PI * 2 - t * 3) * (h / 2 - 12);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // one-wavelength bracket
      const lambda = w / cycles;
      ctx.strokeStyle = THEME.accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(1, h - 8);
      ctx.lineTo(lambda, h - 8);
      ctx.moveTo(1, h - 12);
      ctx.lineTo(1, h - 4);
      ctx.moveTo(lambda, h - 12);
      ctx.lineTo(lambda, h - 4);
      ctx.stroke();
      ctx.font = `9px ${THEME.mono}`;
      ctx.fillStyle = THEME.accentHi;
      ctx.fillText('one wavelength', Math.min(w - 80, lambda + 6), h - 5);
    }) as DrawFn,
  };
}

function modulationDraw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const rows = [
    { label: 'message', y: 0.2 },
    { label: 'AM', y: 0.55 },
    { label: 'FM', y: 0.88 },
  ];
  ctx.font = `8.5px ${THEME.mono}`;
  for (const r of rows) {
    const cy = h * r.y;
    ctx.fillStyle = THEME.labelDim;
    ctx.fillText(r.label, 4, cy - 8);
    ctx.strokeStyle = r.label === 'message' ? 'rgba(255,255,255,0.5)' : THEME.trace;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const m = Math.sin(u * Math.PI * 4 - t * 2.2);
      let y: number;
      if (r.label === 'message') y = cy - m * 9;
      else if (r.label === 'AM') y = cy - (1 + 0.75 * m) * Math.sin(u * 90 - t * 14) * 9;
      else y = cy - Math.sin(u * 90 - t * 14 - 3.2 * Math.cos(u * Math.PI * 4 - t * 2.2)) * 9;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function bandwidthDraw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const base = h - 16;
  const bump = (cx: number, sigma: number, amp: number, color: string, label: string) => {
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const g = Math.exp(-((x - cx) ** 2) / (2 * sigma * sigma));
      const y = base - g * amp * (1 + 0.14 * Math.sin(t * 5 + x * 0.05));
      if (x === 0) ctx.moveTo(x, base);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, base);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.font = `8.5px ${THEME.mono}`;
    ctx.fillStyle = THEME.label;
    ctx.fillText(label, cx - ctx.measureText(label).width / 2, base + 11);
  };
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(0, base + 0.5);
  ctx.lineTo(w, base + 0.5);
  ctx.stroke();
  bump(w * 0.28, w * 0.045, h * 0.5, 'rgba(120,200,255,0.35)', 'NFM voice · 12 kHz');
  bump(w * 0.68, w * 0.17, h * 0.62, 'rgba(245,98,47,0.32)', 'WFM music · 180 kHz');
}

function useNoiseDemo() {
  const [sigma, setSigma] = useState(0.35);
  return {
    controls: (
      <Fader name="Noise" value={sigma} min={0.05} max={1.4} step={0.05} fmt={(v) => `σ ${v.toFixed(2)}`} onChange={setSigma} />
    ),
    draw: ((ctx, w, h, t) => {
      const base = h - 12;
      let seed = 7;
      const rand = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed / 2147483647) * 2 - 1;
      };
      ctx.strokeStyle = THEME.trace;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const peak = Math.exp(-((x - w * 0.5) ** 2) / (2 * (w * 0.03) ** 2)) * (h * 0.62);
        const noise = rand() * sigma * h * 0.28 * (0.7 + 0.3 * Math.sin(t * 3 + x));
        const y = base - peak - Math.abs(noise);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      const snr = 20 * Math.log10(0.62 / (sigma * 0.28 + 0.01));
      ctx.font = `9px ${THEME.mono}`;
      ctx.fillStyle = snr > 6 ? THEME.accentHi : 'rgba(255,110,90,0.9)';
      ctx.fillText(`SNR ≈ ${snr.toFixed(0)} dB`, 6, 12);
    }) as DrawFn,
  };
}

function propagationDraw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const hillX = w * 0.5;
  // terrain
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.moveTo(hillX - w * 0.16, h);
  ctx.quadraticCurveTo(hillX, h * 0.18, hillX + w * 0.16, h);
  ctx.closePath();
  ctx.fill();
  // transmitter
  const tx = 14;
  ctx.fillStyle = THEME.accent;
  ctx.fillRect(tx - 2, h * 0.42, 4, h - h * 0.42);
  const ray = (bend: number, color: string, dashOffset: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = -dashOffset * 22;
    ctx.beginPath();
    ctx.moveTo(tx, h * 0.42);
    ctx.quadraticCurveTo(hillX, h * (0.42 - bend), w - 12, h * 0.42);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  // LF bends over the hill; UHF is blocked
  ray(0.55, 'rgba(120,220,140,0.85)', t);
  ctx.font = `8.5px ${THEME.mono}`;
  ctx.fillStyle = 'rgba(120,220,140,0.9)';
  ctx.fillText('LF / HF bends around terrain', tx + 8, h * 0.2);
  // blocked straight ray
  ctx.strokeStyle = 'rgba(255,110,90,0.8)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([5, 5]);
  ctx.lineDashOffset = -t * 22;
  ctx.beginPath();
  ctx.moveTo(tx, h * 0.42);
  ctx.lineTo(hillX - w * 0.055, h * 0.38);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,110,90,0.9)';
  ctx.fillText('UHF is line-of-sight', w * 0.62, h * 0.55);
}

/* ---------------- Lessons rail ---------------- */

interface Lesson {
  id: string;
  title: string;
  blurb: string;
  scenarioId: string;
  demo: () => React.ReactNode;
}

function LessonCard({ lesson, index, onTune }: { lesson: Lesson; index: number; onTune: (id: string) => void }) {
  return (
    <motion.div
      className="flex flex-col gap-2.5 bg-background p-4"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4, delay: 0.08 + index * 0.06 }}
    >
      <div className="text-[13px] font-medium text-foreground">{lesson.title}</div>
      <p className="text-[11.5px] leading-relaxed text-muted-foreground">{lesson.blurb}</p>
      {lesson.demo()}
      <button
        onClick={() => onTune(lesson.scenarioId)}
        className="mono-feats mt-auto self-start rounded-md border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
      >
        ▶ Hear it in the simulator
      </button>
    </motion.div>
  );
}

export function Lessons({ onTune }: { onTune: (scenarioId: string) => void }) {
  const wl = useWavelengthDemo();
  const nz = useNoiseDemo();

  const lessons: Lesson[] = [
    {
      id: 'wavelength',
      title: 'Every signal has a size',
      blurb:
        'Wavelength is frequency made physical: λ = c/f. A 7 MHz wave is 40 m long; WiFi is 12 cm. Antennas are built to match the wave they catch.',
      scenarioId: 'first-contact',
      demo: () => (
        <>
          <Demo draw={wl.draw} ariaLabel="Animated sine wave with a one-wavelength bracket" />
          {wl.controls}
        </>
      ),
    },
    {
      id: 'modulation',
      title: 'Modulation hides sound in a carrier',
      blurb:
        'A plain carrier carries nothing. AM varies its height with the message; FM varies its speed. Demodulation is undoing that trick.',
      scenarioId: 'air-band',
      demo: () => <Demo draw={modulationDraw} ariaLabel="Message, AM and FM waveforms compared" />,
    },
    {
      id: 'bandwidth',
      title: 'Bandwidth is the price of fidelity',
      blurb:
        'A voice channel needs 12 kHz. A music station needs 180 kHz. Spectrum is real estate, and richer sound costs more of it.',
      scenarioId: 'first-contact',
      demo: () => <Demo draw={bandwidthDraw} ariaLabel="Narrow NFM hump versus wide WFM hump" />,
    },
    {
      id: 'noise',
      title: 'Noise decides what you can hear',
      blurb:
        'Every receiver fights a noise floor. When signal-to-noise ratio collapses, the signal is still there — you just cannot find it. Weak-signal work is a skill.',
      scenarioId: 'fox-hunt',
      demo: () => (
        <>
          <Demo draw={nz.draw} ariaLabel="A signal peak sinking into rising noise" />
          {nz.controls}
        </>
      ),
    },
    {
      id: 'propagation',
      title: 'Waves bend, or they don’t',
      blurb:
        'Long waves wrap around hills and skip off the sky. Short waves fly straight and stop at walls. Frequency chooses the game before power does.',
      scenarioId: 'ism-sweep',
      demo: () => <Demo draw={propagationDraw} ariaLabel="LF ray bending over a hill while UHF is blocked" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
      {lessons.map((l, i) => (
        <LessonCard key={l.id} lesson={l} index={i} onTune={onTune} />
      ))}
    </div>
  );
}
