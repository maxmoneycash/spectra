import { useEffect } from 'react';
import { useStore, DEMOD_MODES } from '../store/store';
import { SAMPLE_RATE } from '../engine/protocol';

const TUNE_LIMIT = SAMPLE_RATE / 2 - 1000;
const LOCAL_KEYS = [
  'button', 'a[href]', 'input', 'textarea', 'select', 'summary',
  '[role="button"]', '[role="link"]', '[role="slider"]', '[role="spinbutton"]',
  '[role="combobox"]', '[role="listbox"]', '[role="option"]', '[role="menuitem"]',
  '[role="radio"]', '[role="checkbox"]', '[role="switch"]', '[role="tab"]', '[role="textbox"]',
  'dialog', '[role="dialog"]', '[role="alertdialog"]',
].join(',');

/**
 * Global keyboard shortcuts:
 *   Space  start / stop        ←/→  nudge tuning (Shift = coarse)
 *   ↑/↓    hop detections      M    cycle demod mode
 *   R      record I/Q          ?    shortcuts panel
 * Focused controls and dialogs keep their own keyboard behavior.
 */
export function handleHotkey(e: KeyboardEvent, onToggleKeys: () => void) {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
  const t = e.target as HTMLElement | null;
  if (t?.isContentEditable || t?.closest?.(LOCAL_KEYS)) return;
  const s = useStore.getState();

  // In the Academy view only global keys apply (no receiver to drive).
  if (s.view !== 'console' && e.key !== ' ' && e.key !== '?') return;

  switch (e.key) {
    case ' ':
      e.preventDefault();
      if (s.running) s.stop();
      else void s.start();
      break;
    case 'ArrowLeft':
    case 'ArrowRight': {
      e.preventDefault();
      const dir = e.key === 'ArrowLeft' ? -1 : 1;
      const step = e.shiftKey ? 25_000 : 2_500;
      const next = Math.max(
        -TUNE_LIMIT,
        Math.min(TUNE_LIMIT, s.tuningOffsetHz + dir * step),
      );
      s.setTuning(next);
      break;
    }
    case 'ArrowUp':
      e.preventDefault();
      s.tuneStep(1);
      break;
    case 'ArrowDown':
      e.preventDefault();
      s.tuneStep(-1);
      break;
    case 'm':
    case 'M': {
      const i = DEMOD_MODES.indexOf(s.mode);
      s.setMode(DEMOD_MODES[(i + 1) % DEMOD_MODES.length]);
      break;
    }
    case 'r':
    case 'R':
      if (s.running) s.toggleRecording();
      break;
    case '?':
      onToggleKeys();
      break;
  }
}

export function useHotkeys(onToggleKeys: () => void) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => handleHotkey(e, onToggleKeys);
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [onToggleKeys]);
}
