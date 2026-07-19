/**
 * Single source of truth for canvas-rendered colors.
 * The stage is always dark (zinc) in both UI themes; ember is the one
 * data accent, reserved for the waterfall LUT and the VFO marker.
 */
export const THEME = {
  /** Spectrum plot background (zinc-950) */
  plotBg: '#09090b',
  /** Waterfall background before data arrives */
  waterfallBg: '#060607',
  /** Tuner scale band background */
  rulerBg: '#101013',
  /** dB grid lines */
  grid: 'rgba(255,255,255,0.05)',
  /** Scale ticks, minor / major */
  tick: 'rgba(255,255,255,0.13)',
  tickMajor: 'rgba(255,255,255,0.3)',
  /** Axis + scale labels */
  label: '#8e8e96',
  labelDim: '#5f5f66',
  /** Spectrum trace */
  trace: 'rgba(250,250,250,0.94)',
  traceFill: 'rgba(250,250,250,0.05)',
  /** Decaying peak-hold line */
  peak: 'rgba(250,250,250,0.28)',
  /** The one data accent — ember (waterfall LUT + VFO) */
  accent: '#f5622f',
  accentHi: '#ff8a5c',
  accentSoft: 'rgba(245,98,47,0.55)',
  /** Scope backgrounds */
  scopeBg: '#09090b',
  scopeGrid: 'rgba(255,255,255,0.07)',
  scopeTrace: 'rgba(250,250,250,0.85)',
  /** Canvas font */
  mono: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;
