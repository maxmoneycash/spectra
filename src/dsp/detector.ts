/** A raw emission found in a single spectrum frame. */
export interface Detection {
  offsetHz: number;
  centerFreqHz: number;
  bandwidthHz: number;
  peakDb: number;
  snrDb: number;
  /** Peak-to-mean level within the emission (dB): high for a strong carrier. */
  crestDb: number;
}

export interface DetectOptions {
  binHz: number;
  centerFreqHz: number;
  /** dB above the estimated noise floor to call an emission. */
  thresholdDb?: number;
  minBandwidthHz?: number;
}

/** Estimate the noise floor as a low percentile of the spectrum (robust to signals). */
export function estimateNoiseFloor(spec: Float32Array): number {
  const copy = Float32Array.from(spec);
  copy.sort();
  return copy[Math.floor(copy.length * 0.4)];
}

/**
 * Energy detector: find contiguous runs of bins above a noise-relative
 * threshold and describe each as an emission (centroid frequency, occupied
 * bandwidth, SNR). Small gaps are bridged so a carrier + sidebands read as one.
 */
export function detectEmissions(spec: Float32Array, opts: DetectOptions): Detection[] {
  const N = spec.length;
  const binHz = opts.binHz;
  const margin = opts.thresholdDb ?? 8;
  const minBw = opts.minBandwidthHz ?? binHz * 2;
  const noise = estimateNoiseFloor(spec);
  const thr = noise + margin;
  // Bridge wider sub-threshold gaps so a swept LoRa chirp or a carrier + its
  // sidebands read as one emission rather than fragmenting.
  const gapBins = Math.max(1, Math.round(7000 / binHz));

  const dets: Detection[] = [];
  let i = 0;
  while (i < N) {
    if (spec[i] <= thr) {
      i++;
      continue;
    }
    // Extend the run, bridging short sub-threshold gaps.
    let end = i;
    let gap = 0;
    let k = i;
    while (k < N) {
      if (spec[k] > thr) {
        end = k;
        gap = 0;
      } else if (++gap > gapBins) {
        break;
      }
      k++;
    }

    let peakDb = -Infinity;
    let meanDb = 0;
    let wSum = 0;
    let wfSum = 0;
    for (let b = i; b <= end; b++) {
      if (spec[b] > peakDb) peakDb = spec[b];
      meanDb += spec[b];
      const lin = Math.pow(10, spec[b] / 10);
      wSum += lin;
      wfSum += lin * b;
    }
    meanDb /= end - i + 1;
    const centroidBin = wSum > 0 ? wfSum / wSum : (i + end) / 2;
    const offsetHz = (centroidBin - N / 2) * binHz;
    const bandwidthHz = (end - i + 1) * binHz;
    const snrDb = peakDb - noise;

    if (bandwidthHz >= minBw || snrDb >= 12) {
      dets.push({
        offsetHz,
        centerFreqHz: opts.centerFreqHz + offsetHz,
        bandwidthHz,
        peakDb,
        snrDb,
        crestDb: peakDb - meanDb,
      });
    }
    i = end + 1;
  }

  dets.sort((a, b) => b.snrDb - a.snrDb);
  return dets.slice(0, 48);
}

export interface Track extends Detection {
  id: string;
  hits: number;
  missed: number;
  ageFrames: number;
  /** Fraction of recent frames the emission was present (EMA): 1=continuous. */
  duty: number;
}

/**
 * Frame-to-frame tracker giving emissions stable IDs. New detections are
 * matched to existing tracks by frequency proximity, smoothed, and aged out
 * when they disappear — so the UI list doesn't flicker.
 */
export class EmissionTracker {
  private tracks: Track[] = [];
  private counter = 0;

  update(dets: Detection[], opts: { minHits?: number; maxMiss?: number } = {}): Track[] {
    const minHits = opts.minHits ?? 2;
    const maxMiss = opts.maxMiss ?? 10;
    const used = new Set<number>();

    for (const t of this.tracks) {
      t.missed++;
      // Find nearest unmatched detection within tolerance.
      const tol = Math.max(t.bandwidthHz, 10_000);
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let d = 0; d < dets.length; d++) {
        if (used.has(d)) continue;
        const dist = Math.abs(dets[d].offsetHz - t.offsetHz);
        if (dist < tol && dist < bestDist) {
          bestDist = dist;
          bestIdx = d;
        }
      }
      if (bestIdx >= 0) {
        used.add(bestIdx);
        const d = dets[bestIdx];
        const a = 0.35;
        t.offsetHz += a * (d.offsetHz - t.offsetHz);
        t.centerFreqHz += a * (d.centerFreqHz - t.centerFreqHz);
        t.bandwidthHz += a * (d.bandwidthHz - t.bandwidthHz);
        t.peakDb += a * (d.peakDb - t.peakDb);
        t.snrDb += a * (d.snrDb - t.snrDb);
        t.crestDb += a * (d.crestDb - t.crestDb);
        t.hits++;
        t.missed = 0;
        t.duty += 0.15 * (1 - t.duty);
      } else {
        t.duty += 0.15 * (0 - t.duty);
      }
      t.ageFrames++;
    }

    // Spawn tracks for unmatched detections.
    for (let d = 0; d < dets.length; d++) {
      if (used.has(d)) continue;
      this.tracks.push({
        ...dets[d],
        id: `sig-${++this.counter}`,
        hits: 1,
        missed: 0,
        ageFrames: 0,
        duty: 1,
      });
    }

    this.tracks = this.tracks.filter((t) => t.missed <= maxMiss);
    // Keep confirmed emissions listed while they are still alive, so bursty
    // signals persist in the catalog between transmissions instead of flickering.
    // Dedup overlapping tracks (keep the strongest) so one emitter reads as one.
    const active = this.tracks
      .filter((t) => t.hits >= minHits)
      .sort((a, b) => b.snrDb - a.snrDb);
    const kept: Track[] = [];
    for (const t of active) {
      const merged = kept.some(
        (k) => Math.abs(k.offsetHz - t.offsetHz) < Math.max(8000, t.bandwidthHz * 0.6),
      );
      if (!merged) kept.push(t);
    }
    return kept;
  }

  reset(): void {
    this.tracks = [];
  }
}
