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
  /** Set when this track stands for a comb of hopping channels, not one carrier. */
  hopping?: { members: number; spanHz: number };
}

// Hopper aggregation. An FHSS emitter has no frequency for a tracker keyed on
// one: it shows up as a comb of narrow, briefly-present tracks on a regular
// grid — the 2.4 GHz hopper listed as ~20 "CW" entries. A comb of narrow,
// mostly-absent tracks collapses into one track spanning it. A pile-up of real
// CW stations is present most of the time and is left alone.
const HOP_MAX_BW_HZ = 4_000;
/**
 * Three grid steps of an 800 kHz / 24-channel hopper (~35 kHz apart). The
 * hop sequence is random, so at any moment a couple of channels have gone
 * unvisited long enough to be culled; a link shorter than two steps let every
 * such hole break the comb into fragments too short to qualify.
 */
export const HOP_LINK_HZ = 120_000;
const HOP_MIN_MEMBERS = 5;
/** Once formed, a comb survives a thin moment with fewer members. */
const HOP_KEEP_MEMBERS = 3;
/** Each channel of a 24-channel hopper is visited ~1/24 of the time. */
const HOP_MAX_DUTY = 0.35;
/** Qualifying chains this close are one hopper: a hole wider than the link does not make two emitters. */
const HOP_MERGE_HZ = 200_000;
/**
 * How fast a remembered span narrows toward this frame's dwells, per frame
 * (~3%/s at 70 frames/s). A hopper's range is a property of the emitter; the
 * random sequence leaves edge channels unvisited for seconds at a time, and a
 * span that chased each frame's extent lost its edges and its identity.
 */
const HOP_SPAN_NARROW = 0.0005;

/**
 * Frame-to-frame tracker giving emissions stable IDs. New detections are
 * matched to existing tracks by frequency proximity, smoothed, and aged out
 * when they disappear — so the UI list doesn't flicker.
 */
export class EmissionTracker {
  private tracks: Track[] = [];
  private counter = 0;
  private hopAggregates = new Map<string, Track>();
  /**
   * Each hopper's remembered span (offsets) and how many frames since a comb
   * last qualified for it. The span widens the moment a dwell lands outside it
   * and narrows slowly, so a thin frame cannot shrink an 800 kHz hopper to the
   * width of one fragment — which is what used to mint a fresh id every time
   * the comb re-formed around a different handful of live dwells.
   */
  private hopSpans = new Map<string, { lo: number; hi: number; unseen: number }>();
  private hopCounter = 0;

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
        // Occupied bandwidth is remembered: widen quickly, narrow slowly. A
        // repeater's carrier-only hang (~0.3 s) used to collapse a 9 kHz voice
        // track to the carrier's width, and the classifier then called it CW.
        t.bandwidthHz +=
          (d.bandwidthHz > t.bandwidthHz ? a : 0.005) * (d.bandwidthHz - t.bandwidthHz);
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
      // Inside a stronger track's occupied band means the same emitter. The
      // radius used to come from the candidate's width alone, so a 1 kHz
      // flicker at a 138 kHz FM station's skirt (50 kHz out) was never merged
      // and the band counted eight emitters for four.
      const merged = kept.some(
        (k) =>
          Math.abs(k.offsetHz - t.offsetHz) <
          Math.max(8000, k.bandwidthHz * 0.6, t.bandwidthHz * 0.6),
      );
      if (!merged) kept.push(t);
    }
    return this.aggregateHoppers(kept, maxMiss);
  }

  /**
   * Collapse combs of narrow, mostly-absent tracks into one hopper track each.
   *
   * This used to fragment a real hopper into a handful of short-lived ones: a
   * comb's span was whatever fragment matched it this frame, so a thin
   * 3-member fragment shrank the aggregate to its own width, the next fragment
   * elsewhere no longer overlapped it and minted a new id, and when two
   * fragments overlapped one aggregate only the first could claim it. The
   * 2.4 GHz hopper surfaced as nine "FHSS" entries over a 30 s run. Now every
   * fragment touching a hopper's remembered span folds into it, a hopper
   * survives frames with no qualifying fragment, and narrow tracks inside a
   * live hopper's span are its dwells whether or not they chained this frame.
   */
  private aggregateHoppers(kept: Track[], maxMiss: number): Track[] {
    const narrow = kept
      .filter((t) => t.bandwidthHz < HOP_MAX_BW_HZ)
      .sort((a, b) => a.offsetHz - b.offsetHz);
    // Chains of narrow tracks on a grid.
    const chains: Track[][] = [];
    for (const t of narrow) {
      const chain = chains[chains.length - 1];
      if (chain && t.offsetHz - chain[chain.length - 1].offsetHz <= HOP_LINK_HZ) chain.push(t);
      else chains.push([t]);
    }
    const lowDuty = (c: Track[]) => c.reduce((s, t) => s + t.duty, 0) / c.length <= HOP_MAX_DUTY;
    const pieces = chains.filter((c) => c.length >= HOP_KEEP_MEMBERS && lowDuty(c));
    const lo = (p: Track[]) => p[0].offsetHz;
    const hi = (p: Track[]) => p[p.length - 1].offsetHz;

    // Union-find over this frame's pieces and the remembered hoppers: pieces
    // within the merge distance of each other are one hopper, and a piece
    // touching a remembered span (within a link) belongs to that hopper.
    const parent = new Map<string, string>();
    const find = (k: string): string => {
      let r = k;
      while (parent.get(r) !== r) r = parent.get(r)!;
      let c = k;
      while (parent.get(c) !== r) {
        const next = parent.get(c)!;
        parent.set(c, r);
        c = next;
      }
      return r;
    };
    const union = (a: string, b: string) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };
    pieces.forEach((_, i) => parent.set(`p${i}`, `p${i}`));
    for (const id of this.hopSpans.keys()) parent.set(id, id);
    for (let i = 1; i < pieces.length; i++) {
      if (lo(pieces[i]) - hi(pieces[i - 1]) <= HOP_MERGE_HZ) union(`p${i - 1}`, `p${i}`);
    }
    for (let i = 0; i < pieces.length; i++) {
      for (const [id, s] of this.hopSpans) {
        if (Math.min(hi(pieces[i]), s.hi) - Math.max(lo(pieces[i]), s.lo) > -HOP_LINK_HZ) union(`p${i}`, id);
      }
    }
    const comps = new Map<string, { pieces: Track[][]; ids: string[] }>();
    const compOf = (root: string) => {
      let c = comps.get(root);
      if (!c) {
        c = { pieces: [], ids: [] };
        comps.set(root, c);
      }
      return c;
    };
    pieces.forEach((p, i) => compOf(find(`p${i}`)).pieces.push(p));
    for (const id of this.hopSpans.keys()) compOf(find(id)).ids.push(id);

    const live: Track[] = [];
    for (const c of comps.values()) {
      const tracks = c.pieces.flat();
      // Identity: the oldest remembered id, else a new one if there is a quorum.
      c.ids.sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)));
      let id = c.ids[0];
      if (!id) {
        if (tracks.length < HOP_MIN_MEMBERS) continue;
        id = `hop-${++this.hopCounter}`;
      }
      for (const dup of c.ids.slice(1)) {
        this.hopAggregates.delete(dup); // two grew into one
        this.hopSpans.delete(dup);
      }
      const span = this.hopSpans.get(id);
      const agg = this.hopAggregates.get(id);
      if (tracks.length === 0) {
        // No qualifying fragment this frame: the hopper is still there, its
        // dwells just fell between the link and the quorum. Keep it, aging.
        if (!span || !agg) continue;
        span.unseen++;
        if (span.unseen > maxMiss) {
          this.hopAggregates.delete(id);
          this.hopSpans.delete(id);
          continue;
        }
        agg.missed = span.unseen;
        agg.duty *= 0.85;
        live.push(agg);
        continue;
      }
      const loNow = Math.min(...tracks.map((t) => t.offsetHz));
      const hiNow = Math.max(...tracks.map((t) => t.offsetHz));
      // Widen immediately, narrow slowly.
      const sLo = !span || loNow < span.lo ? loNow : span.lo + HOP_SPAN_NARROW * (loNow - span.lo);
      const sHi = !span || hiNow > span.hi ? hiNow : span.hi + HOP_SPAN_NARROW * (hiNow - span.hi);
      this.hopSpans.set(id, { lo: sLo, hi: sHi, unseen: 0 });
      const spanHz = sHi - sLo + HOP_MAX_BW_HZ;
      const center = (sLo + sHi) / 2;
      const present = tracks.some((t) => t.missed === 0);
      const ref = tracks[0];
      const next: Track = agg ?? { ...ref, id };
      Object.assign(next, {
        offsetHz: center,
        centerFreqHz: ref.centerFreqHz + (center - ref.offsetHz),
        bandwidthHz: spanHz,
        peakDb: Math.max(...tracks.map((t) => t.peakDb)),
        snrDb: Math.max(...tracks.map((t) => t.snrDb)),
        crestDb: tracks.reduce((s, t) => s + t.crestDb, 0) / tracks.length,
        hits: Math.max(...tracks.map((t) => t.hits)),
        missed: Math.min(...tracks.map((t) => t.missed)),
        ageFrames: Math.max(...tracks.map((t) => t.ageFrames)),
        duty: present ? next.duty + 0.15 * (1 - next.duty) : next.duty * 0.85,
        hopping: { members: tracks.length, spanHz },
      });
      this.hopAggregates.set(id, next);
      live.push(next);
    }
    // Every narrow track within a link of a live hopper's span is one of its
    // dwells — including the ones that did not chain this frame, which used to
    // be absorbed without widening the span, so a hopper's listed range ended
    // short of dwells it was swallowing. Each absorbed dwell extends the span,
    // which may absorb more; repeat until it stops growing.
    const within = (t: Track, s: { lo: number; hi: number }) =>
      t.offsetHz >= s.lo - HOP_LINK_HZ && t.offsetHz <= s.hi + HOP_LINK_HZ;
    for (const h of live) {
      const s = this.hopSpans.get(h.id)!;
      for (let pass = 0; pass < 8; pass++) {
        let grew = false;
        for (const t of narrow) {
          if (!within(t, s)) continue;
          if (t.offsetHz < s.lo) {
            s.lo = t.offsetHz;
            grew = true;
          }
          if (t.offsetHz > s.hi) {
            s.hi = t.offsetHz;
            grew = true;
          }
        }
        if (!grew) break;
      }
      const dwells = narrow.filter((t) => within(t, s));
      const spanHz = s.hi - s.lo + HOP_MAX_BW_HZ;
      const center = (s.lo + s.hi) / 2;
      Object.assign(h, {
        centerFreqHz: h.centerFreqHz + (center - h.offsetHz),
        offsetHz: center,
        bandwidthHz: spanHz,
        hopping: { members: Math.max(dwells.length, h.hopping?.members ?? 0), spanHz },
      });
    }
    const inLive = (t: Track) =>
      t.bandwidthHz < HOP_MAX_BW_HZ && live.some((h) => within(t, this.hopSpans.get(h.id)!));
    return [...kept.filter((t) => !inLive(t)), ...live];
  }

  reset(): void {
    this.hopAggregates.clear();
    this.hopSpans.clear();
    this.tracks = [];
  }
}
