/**
 * Placement for the signal labels drawn along the top of the spectrum plot.
 *
 * Labels are placed in priority order — the selected signal first, then the
 * strongest — and any label that would overlap one already placed is dropped.
 * A label that would run off the right edge flips to the left of its marker.
 *
 * Priority matters because detections arrive strongest-first, not left to
 * right. Placing them by position alone silently dropped every label that sat
 * to the left of a louder signal.
 */
export interface LabelCandidate {
  /** Marker x position on the canvas, in CSS pixels. */
  x: number;
  label: string;
  selected: boolean;
  snrDb: number;
}

export interface PlacedLabel<T extends LabelCandidate = LabelCandidate> {
  item: T;
  /** Left edge of the label text. */
  left: number;
}

/** Gap from the marker to the label text, either side. */
const OFFSET = 5;
/** Minimum horizontal clearance between two labels. */
const GAP = 8;
/** Margin kept clear at each edge of the canvas. */
const EDGE = 3;

export function placeLabels<T extends LabelCandidate>(
  items: readonly T[],
  width: number,
  measure: (text: string) => number,
): PlacedLabel<T>[] {
  const order = [...items].sort(
    (a, b) => Number(b.selected) - Number(a.selected) || b.snrDb - a.snrDb,
  );
  const taken: [number, number][] = [];
  const out: PlacedLabel<T>[] = [];
  for (const item of order) {
    const w = measure(item.label);
    let left = item.x + OFFSET;
    if (left + w > width - EDGE) left = item.x - OFFSET - w;
    const right = left + w;
    if (left < EDGE) continue;
    if (taken.some(([l, r]) => left < r + GAP && right > l - GAP)) continue;
    taken.push([left, right]);
    out.push({ item, left });
  }
  return out;
}
