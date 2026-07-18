import { useEffect } from 'react';
import { useStore, DEMOD_MODES } from '../store/store';
import { SAMPLE_RATE } from '../engine/protocol';

const TUNE_LIMIT = SAMPLE_RATE / 2 - 1000;

/**
 * Global keyboard shortcuts:
 *   Space  start / stop        ←/→  nudge tuning (Shift = coarse)
 *   ↑/↓    hop detections      M    cycle demod mode
 *   R      record I/Q          ?    shortcuts panel
 * Ignored while typing in an input.
 */
export function useHotkeys(onToggleKeys: () => void) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
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
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [onToggleKeys]);
}
