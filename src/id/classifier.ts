import { KIND_INFO, type SignalKind } from '../sim/signal-kinds';

export interface ClassFeatures {
  bandwidthHz: number;
  snrDb: number;
  /** 0 (bursty) .. 1 (continuous). */
  duty: number;
  /** Peak-to-mean level within the emission (dB). */
  crestDb: number;
  /** Set by the tracker when the track stands for a comb of hopping channels. */
  hopping?: { members: number; spanHz: number };
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
  /**
   * What the emission's crest (peak-to-mean level) should look like.
   * 'yes': a dominant carrier, AM-strength (measured sim AM: ~34 dB).
   * 'weak': a residual carrier that comes and goes — voice FM shows one in
   *   every pause (measured sim NFM while talking: ~20 dB) but never AM's.
   * 'no': no carrier. 'any': crest says nothing.
   */
  carrier: 'yes' | 'weak' | 'no' | 'any';
}

const PRIORS: Prior[] = [
  // A keyed carrier is a bandwidth call: the detector merges its keying
  // sidebands into ~0.7–1 kHz, and crest (peak-to-mean) says nothing about an
  // emission only a few bins wide. Requiring a 'yes' carrier let SSB outscore
  // the identify lesson's CW station.
  { kind: 'cw', logBw: Math.log10(500), sigma: 0.35, continuous: false, carrier: 'any' },
  { kind: 'usb', logBw: Math.log10(2700), sigma: 0.18, continuous: true, carrier: 'no' },
  { kind: 'lsb', logBw: Math.log10(2700), sigma: 0.18, continuous: true, carrier: 'no' },
  { kind: 'am', logBw: Math.log10(8000), sigma: 0.2, continuous: true, carrier: 'yes' },
  { kind: 'ook', logBw: Math.log10(6000), sigma: 0.3, continuous: false, carrier: 'any' },
  // Voice-modulated NFM in this simulator occupies ~8–9 kHz (measured on the
  // identify lesson's repeater); it was centred at 12 kHz with 'no' carrier
  // and lost every time to AM, which the residual carrier looked like.
  { kind: 'nfm', logBw: Math.log10(10000), sigma: 0.2, continuous: true, carrier: 'weak' },
  { kind: 'fsk2', logBw: Math.log10(12000), sigma: 0.25, continuous: false, carrier: 'any' },
  { kind: 'fhss', logBw: Math.log10(20000), sigma: 0.4, continuous: false, carrier: 'any' },
  { kind: 'psk', logBw: Math.log10(100000), sigma: 0.25, continuous: false, carrier: 'no' },
  { kind: 'lora', logBw: Math.log10(125000), sigma: 0.2, continuous: false, carrier: 'no' },
  { kind: 'wfm', logBw: Math.log10(150000), sigma: 0.18, continuous: true, carrier: 'no' },
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
  if (p.carrier === 'weak' && f.crestDb >= 10 && f.crestDb < 28) parts.push('carrier in the pauses');
  return parts.join(', ');
}

/** Rank signal types by how well they match the observed features. */
export function classify(f: ClassFeatures): ClassResult[] {
  // A comb of hopping channels is a frequency hopper outright; its span
  // (hundreds of kHz) would otherwise match nothing in the priors, and its
  // members' width (a carrier) would read as CW. Rank the rest by shape for
  // the runner-up slots, scaled so the three still sum to at most 1.
  if (f.hopping && f.hopping.members >= 5) {
    const rest = classify({ ...f, hopping: undefined })
      .filter((r) => r.kind !== 'fhss')
      .slice(0, 2)
      .map((r) => ({ ...r, confidence: r.confidence * 0.1 }));
    const span = Math.round(f.hopping.spanHz / 1000);
    return [
      { kind: 'fhss', confidence: 0.9, reason: `${f.hopping.members} channels across ~${span} kHz, short dwells` },
      ...rest,
    ];
  }
  const logBw = Math.log10(Math.max(1, f.bandwidthHz));
  const scored = PRIORS.map((p) => {
    const bwScore = Math.exp(-0.5 * Math.pow((logBw - p.logBw) / p.sigma, 2));
    const dutyScore = p.continuous ? 0.35 + 0.65 * f.duty : 0.35 + 0.65 * (1 - f.duty);
    let carrierScore = 0.7;
    // Full carrier credit used to saturate at 18 dB, so an FM voice station's
    // residual carrier in the pauses (~20 dB) scored exactly like AM's real
    // one (~34 dB) and the repeater read as AM whenever it talked.
    if (p.carrier === 'yes') carrierScore = clamp(f.crestDb / 30, 0.12, 1);
    else if (p.carrier === 'weak') carrierScore = clamp((34 - f.crestDb) / 12, 0.12, 1);
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
