/**
 * Single source of truth for canvas-rendered colors.
 *
 * Canvas can't read CSS custom properties cheaply per frame, so the palette
 * lives here in both light and dark variants. Ember stays the one data accent
 * in both — it reads on paper and on ink.
 */
import type { SignalFamily } from '../sim/signal-kinds';

export interface CanvasTheme {
  /** Spectrum plot background */
  plotBg: string;
  /** Waterfall background before data arrives */
  waterfallBg: string;
  /** Tuner scale band background */
  rulerBg: string;
  /** dB grid lines */
  grid: string;
  /** Scale ticks, minor / major */
  tick: string;
  tickMajor: string;
  /** Axis + scale labels */
  label: string;
  labelDim: string;
  /** Spectrum trace */
  trace: string;
  traceFill: string;
  traceFillTop: string;
  traceFillBottom: string;
  /** Decaying peak-hold line */
  peak: string;
  /** The one data accent — ember (waterfall LUT + VFO) */
  accent: string;
  accentHi: string;
  accentSoft: string;
  /** Text drawn on top of the accent pill */
  onAccent: string;
  /** Signal-family marks: carets, leaders, dots. Mirrors --sig-* in index.css. */
  sig: Record<SignalFamily, string>;
  /** Scope backgrounds */
  scopeBg: string;
  /** Translucent wash that fades the previous scope frame (phosphor trail) */
  scopeFade: string;
  scopeGrid: string;
  scopeTrace: string;
  /** Canvas font */
  mono: string;
}

const MONO = '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

const DARK: CanvasTheme = {
  plotBg: '#09090b',
  waterfallBg: '#060607',
  rulerBg: '#101013',
  grid: 'rgba(255,255,255,0.05)',
  tick: 'rgba(255,255,255,0.13)',
  tickMajor: 'rgba(255,255,255,0.3)',
  label: '#8e8e96',
  labelDim: '#5f5f66',
  trace: 'rgba(250,250,250,0.94)',
  traceFill: 'rgba(250,250,250,0.05)',
  traceFillTop: 'rgba(246,245,243,0.13)',
  traceFillBottom: 'rgba(246,245,243,0.01)',
  peak: 'rgba(250,250,250,0.28)',
  accent: '#f5622f',
  accentHi: '#ff8a5c',
  accentSoft: 'rgba(245,98,47,0.55)',
  onAccent: '#2a1006',
  sig: { voice: '#3987e5', data: '#d55181', spread: '#008300' },
  scopeBg: '#09090b',
  scopeFade: 'rgba(9,9,11,0.3)',
  scopeGrid: 'rgba(255,255,255,0.07)',
  scopeTrace: 'rgba(250,250,250,0.85)',
  mono: MONO,
};

const LIGHT: CanvasTheme = {
  plotBg: '#fcfcfb',
  waterfallBg: '#ffffff',
  rulerBg: '#f4f4f2',
  grid: 'rgba(9,9,11,0.07)',
  tick: 'rgba(9,9,11,0.16)',
  tickMajor: 'rgba(9,9,11,0.34)',
  label: '#6b6b73',
  labelDim: '#9b9ba3',
  trace: 'rgba(24,24,27,0.88)',
  traceFill: 'rgba(24,24,27,0.06)',
  traceFillTop: 'rgba(24,24,27,0.11)',
  traceFillBottom: 'rgba(24,24,27,0.01)',
  peak: 'rgba(24,24,27,0.24)',
  accent: '#e2551f',
  accentHi: '#c2410c',
  accentSoft: 'rgba(226,85,31,0.5)',
  onAccent: '#ffffff',
  sig: { voice: '#2a78d6', data: '#e87ba4', spread: '#008300' },
  scopeBg: '#fcfcfb',
  scopeFade: 'rgba(252,252,251,0.32)',
  scopeGrid: 'rgba(9,9,11,0.08)',
  scopeTrace: 'rgba(24,24,27,0.82)',
  mono: MONO,
};

export const canvasTheme = (isDark: boolean): CanvasTheme => (isDark ? DARK : LIGHT);

/**
 * The live palette every canvas reads at draw time. It is mutated in place on
 * theme change so the drawing code needs no plumbing — the next frame simply
 * paints in the new colors.
 */
export const THEME: CanvasTheme = { ...DARK };

let currentIsDark = true;

export function setCanvasTheme(isDark: boolean): void {
  currentIsDark = isDark;
  Object.assign(THEME, isDark ? DARK : LIGHT);
}

/** Whether the canvases are currently painting the dark palette. */
export const isCanvasDark = (): boolean => currentIsDark;

/** The always-dark palette, for surfaces that stay dark in both themes
 *  (the shareable operator card). */
export const DARK_THEME = DARK;
