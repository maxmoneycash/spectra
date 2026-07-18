/**
 * Single source of truth for canvas-rendered colors.
 * Mirrors the CSS tokens in index.css — keep the two in sync.
 */
export const THEME = {
  /** Spectrum plot background */
  plotBg: '#0c0b0d',
  /** Waterfall background before data arrives */
  waterfallBg: '#070708',
  /** Tuner scale band background */
  rulerBg: '#111013',
  /** dB grid lines */
  grid: 'rgba(255,255,255,0.05)',
  /** Scale ticks, minor / major */
  tick: 'rgba(255,255,255,0.13)',
  tickMajor: 'rgba(255,255,255,0.3)',
  /** Axis + scale labels */
  label: '#8a8680',
  labelDim: '#5c5955',
  /** Spectrum trace */
  trace: 'rgba(246,245,243,0.94)',
  traceFill: 'rgba(246,245,243,0.05)',
  /** Decaying peak-hold line */
  peak: 'rgba(246,245,243,0.28)',
  /** The one accent (matches --accent oklch(66% 0.19 38)) */
  accent: '#f5622f',
  accentHi: '#ff8a5c',
  accentSoft: 'rgba(245,98,47,0.55)',
  /** Scope backgrounds */
  scopeBg: '#0c0b0d',
  scopeGrid: 'rgba(255,255,255,0.07)',
  scopeTrace: 'rgba(246,245,243,0.85)',
  /** Canvas font */
  mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;
