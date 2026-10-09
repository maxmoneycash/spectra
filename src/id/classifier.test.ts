import { describe, it, expect } from 'vitest';
import { classify, bestGuess } from './classifier';

describe('classifier', () => {
  it('identifies wide continuous no-carrier as broadcast FM', () => {
    const g = bestGuess({ bandwidthHz: 180_000, snrDb: 40, duty: 0.95, crestDb: 4 });
    expect(g.kind).toBe('wfm');
  });

  it('reads a narrow steady talk station as FM, not PSK', () => {
    // Speech fills less of the channel than music: a talk station measures
    // ~110 kHz. It used to lose to PSK and flip-flop on the waterfall.
    expect(classify({ bandwidthHz: 112_000, snrDb: 40, duty: 0.95, crestDb: 4 })[0].kind).toBe('wfm');
  });

  it('keeps a very wide steady signal as radar, not FM', () => {
    expect(classify({ bandwidthHz: 330_000, snrDb: 40, duty: 0.95, crestDb: 4 })[0].kind).toBe('radar');
  });

  it('identifies a very wide bursty signal as radar over FM', () => {
    const g = bestGuess({ bandwidthHz: 300_000, snrDb: 45, duty: 0.9, crestDb: 4 });
    expect(g.kind).toBe('radar');
  });

  it('identifies narrow strong-carrier bursts as CW', () => {
    const g = bestGuess({ bandwidthHz: 250, snrDb: 25, duty: 0.3, crestDb: 20 });
    expect(g.kind).toBe('cw');
  });

  it('identifies ~2.7 kHz continuous no-carrier as SSB', () => {
    const g = bestGuess({ bandwidthHz: 2700, snrDb: 20, duty: 0.9, crestDb: 3 });
    expect(['usb', 'lsb']).toContain(g.kind);
  });

  // The next three cases are feature vectors measured on the identify lesson's
  // scene through the real detector (2026-10-09), not guessed. The AM case
  // used to assume a 16 dB crest; a simulated AM station measures ~34 dB,
  // and an FM voice station's residual carrier in its pauses ~20 dB — which
  // is why NFM used to read as AM whenever it talked.
  it('identifies ~8 kHz continuous with an AM-strength carrier as AM', () => {
    const g = bestGuess({ bandwidthHz: 5000, snrDb: 30, duty: 1, crestDb: 34 });
    expect(g.kind).toBe('am');
  });

  it('identifies a talking NFM station (~8.5 kHz, residual carrier) as NFM, with AM second', () => {
    const r = classify({ bandwidthHz: 8500, snrDb: 30, duty: 1, crestDb: 20 });
    expect(r[0].kind).toBe('nfm');
    expect(r[1].kind).toBe('am');
  });

  it('identifies a keyed carrier the detector sees ~1 kHz wide as CW, not SSB', () => {
    // Crest is meaningless for an emission a few bins wide (peak ≈ mean).
    const g = bestGuess({ bandwidthHz: 975, snrDb: 25, duty: 0.93, crestDb: 5.3 });
    expect(g.kind).toBe('cw');
  });

  it('identifies ~12 kHz continuous no-carrier as NFM', () => {
    const g = bestGuess({ bandwidthHz: 12_000, snrDb: 25, duty: 0.9, crestDb: 4 });
    expect(g.kind).toBe('nfm');
  });

  it('returns ranked candidates as probabilities over all kinds', () => {
    const results = classify({ bandwidthHz: 125_000, snrDb: 20, duty: 0.2, crestDb: 4 });
    expect(results.length).toBe(3);
    // Confidences are normalised across all 12 kinds, so the top 3 sum to <= 1.
    const sum = results.reduce((s, r) => s + r.confidence, 0);
    expect(sum).toBeGreaterThan(0);
    expect(sum).toBeLessThanOrEqual(1.0001);
    // Ranked descending.
    expect(results[0].confidence).toBeGreaterThanOrEqual(results[1].confidence);
    expect(results[1].confidence).toBeGreaterThanOrEqual(results[2].confidence);
    // LoRa should be among the candidates for a 125 kHz bursty signal.
    expect(results.some((r) => r.kind === 'lora')).toBe(true);
  });
});
