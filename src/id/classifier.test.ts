import { describe, it, expect } from 'vitest';
import { classify, bestGuess } from './classifier';

describe('classifier', () => {
  it('identifies wide continuous no-carrier as broadcast FM', () => {
    const g = bestGuess({ bandwidthHz: 180_000, snrDb: 40, duty: 0.95, crestDb: 4 });
    expect(g.kind).toBe('wfm');
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

  it('identifies ~8 kHz continuous strong-carrier as AM', () => {
    const g = bestGuess({ bandwidthHz: 8000, snrDb: 30, duty: 0.95, crestDb: 16 });
    expect(g.kind).toBe('am');
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
