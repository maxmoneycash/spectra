import { KIND_INFO, type SignalKind } from '../sim/signal-kinds';

export interface ClassFeatures {
  bandwidthHz: number;
  snrDb: number;
  /** 0 (bursty) .. 1 (continuous). */
  duty: number;
  /** Peak-to-mean level within the emission (dB). */
  crestDb: number;
}

export interface ClassResult {
  kind: SignalKind;
  confidence: number; // 0..1
  reason: string;
}

interface Prior {
  kind: SignalKind;
  logBw: number;
  sigma: number;
  continuous: boolean;
  carrier: 'yes' | 'no' | 'any';
}

const PRIORS: Prior[] = [
  { kind: 'cw', logBw: Math.log10(200), sigma: 0.35, continuous: false, carrier: 'yes' },
  { kind: 'usb', logBw: Math.log10(2700), sigma: 0.18, continuous: true, carrier: 'no' },
  { kind: 'lsb', logBw: Math.log10(2700), sigma: 0.18, continuous: true, carrier: 'no' },
  { kind: 'am', logBw: Math.log10(8000), sigma: 0.2, continuous: true, carrier: 'yes' },
  { kind: 'ook', logBw: Math.log10(6000), sigma: 0.3, continuous: false, carrier: 'any' },
  { kind: 'nfm', logBw: Math.log10(12000), sigma: 0.2, continuous: true, carrier: 'no' },
  { kind: 'fsk2', logBw: Math.log10(12000), sigma: 0.25, continuous: false, carrier: 'any' },
  { kind: 'fhss', logBw: Math.log10(20000), sigma: 0.4, continuous: false, carrier: 'any' },
  { kind: 'psk', logBw: Math.log10(100000), sigma: 0.25, continuous: false, carrier: 'no' },
  { kind: 'lora', logBw: Math.log10(125000), sigma: 0.2, continuous: false, carrier: 'no' },
  { kind: 'wfm', logBw: Math.log10(180000), sigma: 0.13, continuous: true, carrier: 'no' },
  { kind: 'radar', logBw: Math.log10(300000), sigma: 0.32, continuous: false, carrier: 'no' },
];

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

function reasonFor(p: Prior, f: ClassFeatures): string {
  const bwk = (f.bandwidthHz / 1000).toFixed(f.bandwidthHz < 10000 ? 1 : 0);
  const parts: string[] = [`~${bwk} kHz wide`];
  parts.push(f.duty > 0.7 ? 'continuous' : 'bursty');
  if (p.carrier === 'yes' && f.crestDb > 10) parts.push('strong carrier');
  if (p.carrier === 'no' && f.crestDb < 8) parts.push('no carrier');
  return parts.join(', ');
}

/** Rank signal types by how well they match the observed features. */
export function classify(f: ClassFeatures): ClassResult[] {
  const logBw = Math.log10(Math.max(1, f.bandwidthHz));
  const scored = PRIORS.map((p) => {
    const bwScore = Math.exp(-0.5 * Math.pow((logBw - p.logBw) / p.sigma, 2));
    const dutyScore = p.continuous ? 0.35 + 0.65 * f.duty : 0.35 + 0.65 * (1 - f.duty);
    let carrierScore = 0.7;
    if (p.carrier === 'yes') carrierScore = clamp(f.crestDb / 18, 0.12, 1);
    else if (p.carrier === 'no') carrierScore = clamp(1 - f.crestDb / 28, 0.12, 1);
    const score = bwScore * dutyScore * carrierScore + 1e-6;
    return { kind: p.kind, score, reason: reasonFor(p, f), prior: p };
  });

  const total = scored.reduce((s, x) => s + x.score, 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((x) => ({
    kind: x.kind,
    confidence: x.score / total,
    reason: x.reason,
  }));
}

export function bestGuess(f: ClassFeatures): ClassResult {
  return classify(f)[0];
}

export function kindLabel(kind: SignalKind): string {
  return KIND_INFO[kind].label;
}
