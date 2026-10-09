import { describe, expect, it } from 'vitest';
import { placeLabels, type LabelCandidate } from './labelPlacement';

/** Every character is 6 px wide, close to 8.5 px Geist Mono. */
const measure = (t: string) => t.length * 6;

const sig = (x: number, label: string, snrDb: number, selected = false): LabelCandidate => ({
  x,
  label,
  snrDb,
  selected,
});

describe('placeLabels', () => {
  it('puts a label to the right of its marker when it fits', () => {
    const [p] = placeLabels([sig(100, 'Broadcast FM', 40)], 400, measure);
    expect(p.left).toBe(105);
  });

  it('flips a label left of its marker instead of running off the right edge', () => {
    // 'CW / Morse' is 60 px; at x = 380 it would end at 445 on a 400 px canvas.
    const [p] = placeLabels([sig(380, 'CW / Morse', 30)], 400, measure);
    expect(p.left + measure('CW / Morse')).toBeLessThanOrEqual(380);
    expect(p.left).toBe(380 - 5 - 60);
  });

  it('never places a label past either edge', () => {
    const items = [sig(2, 'Broadcast FM', 40), sig(398, 'SSB (Upper)', 20), sig(200, 'AM Voice', 10)];
    for (const p of placeLabels(items, 400, measure)) {
      expect(p.left).toBeGreaterThanOrEqual(3);
      expect(p.left + measure(p.item.label)).toBeLessThanOrEqual(397);
    }
  });

  it('keeps the label left of a louder signal (the old left-to-right bug)', () => {
    // Detections arrive strongest-first. The old code only drew a label if its
    // marker was right of the last one drawn, so the weak station at x = 40
    // lost its label to the strong one at x = 300.
    const placed = placeLabels([sig(300, 'Broadcast FM', 45), sig(40, 'NFM Voice', 12)], 400, measure);
    expect(placed.map((p) => p.item.label).sort()).toEqual(['Broadcast FM', 'NFM Voice']);
  });

  it('drops the weaker of two overlapping labels', () => {
    const placed = placeLabels([sig(100, 'Weak', 10), sig(110, 'Strong', 40)], 400, measure);
    expect(placed.map((p) => p.item.label)).toEqual(['Strong']);
  });

  it('keeps the selected signal even when a stronger one would overlap it', () => {
    const placed = placeLabels([sig(100, 'Loud', 50), sig(110, 'Tuned', 5, true)], 400, measure);
    expect(placed.map((p) => p.item.label)).toEqual(['Tuned']);
  });

  it('drops a label that cannot fit on either side', () => {
    expect(placeLabels([sig(30, 'Frequency hopper', 20)], 60, measure)).toEqual([]);
  });
});
