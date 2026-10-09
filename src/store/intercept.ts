/**
 * The intercept log's rule, kept pure so tests can apply it without starting
 * the engine (store.ts creates the worker and audio graph on import).
 *
 * A transmission is logged only if it started inside the receiver's passband:
 * within half the filter width of the VFO, with a 1.5 kHz floor so a narrow
 * CW filter still counts a carrier you are sitting on. Net Traffic is graded
 * on this — the flag reaches the log only if you found the net and stayed.
 */
export function inPassband(tunedHz: number, bandwidthHz: number, freqHz: number): boolean {
  return Math.abs(tunedHz - freqHz) <= Math.max(1500, bandwidthHz / 2);
}
