/**
 * One shared haptics engine for every control in the kit, so a knob detent,
 * a segmented tick, and a correct answer all feel like the same instrument.
 * web-haptics uses the Vibration API where it exists and the iOS Safari
 * switch-input trick where it doesn't; it no-ops on desktop.
 */
import { WebHaptics } from 'web-haptics';

let engine: WebHaptics | null = null;
function haptics(): WebHaptics | null {
  if (typeof window === 'undefined') return null;
  if (!engine) {
    try {
      engine = new WebHaptics();
    } catch {
      engine = null;
    }
  }
  return engine;
}

function fire(preset: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') {
  void haptics()?.trigger(preset).catch(() => undefined);
}

/** A selection changed — segmented controls, wheel stops, chips. */
export const tick = () => fire('light');
/** A knob or dial crossed a detent. */
export const detent = () => fire('medium');
/** Something locked in: a target acquired, a step completed. */
export const lock = () => fire('heavy');
export const ok = () => fire('success');
export const warn = () => fire('warning');
export const bad = () => fire('error');
