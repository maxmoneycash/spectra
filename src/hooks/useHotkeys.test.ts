import { beforeEach, describe, expect, it, vi } from 'vitest';

const { state, getState } = vi.hoisted(() => {
  const state = {
    view: 'console', running: true, tuningOffsetHz: 0, mode: 'nfm',
    start: vi.fn(), stop: vi.fn(), setTuning: vi.fn(), tuneStep: vi.fn(),
    setMode: vi.fn(), toggleRecording: vi.fn(),
  };
  return { state, getState: vi.fn(() => state) };
});
vi.mock('../store/store', () => ({
  useStore: { getState }, DEMOD_MODES: ['wfm', 'nfm', 'am', 'usb', 'lsb', 'cw', 'raw'],
}));
import { handleHotkey } from './useHotkeys';

// Model closest() for a focused element or an ancestor owning its keys. The
// regression concerns whether the global handler consumes that element's event.
function keyEvent(key: string, owner?: string, flags: Record<string, unknown> = {}) {
  const target = {
    isContentEditable: false,
    closest: (selector: string) => owner && selector.split(',').includes(owner) ? {} : null,
  };
  const preventDefault = vi.fn();
  const event = { key, target, preventDefault, ...flags } as unknown as KeyboardEvent;
  return { event, preventDefault };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(state, { view: 'console', running: true, tuningOffsetHz: 0, mode: 'nfm' });
});

describe('receiver keyboard shortcuts', () => {
  it.each(['button', '[role="button"]', 'a[href]', 'input', 'select', '[role="radio"]'])
    ('leaves Space activation to a focused %s', (owner) => {
      const { event, preventDefault } = keyEvent(' ', owner);
      handleHotkey(event, vi.fn());
      expect(preventDefault).not.toHaveBeenCalled();
      expect(getState).not.toHaveBeenCalled();
      expect(state.stop).not.toHaveBeenCalled();
    });

  it.each(['[role="slider"]', '[role="spinbutton"]', '[role="tab"]', '[role="listbox"]'])
    ('leaves arrow navigation to %s', (owner) => {
      const { event, preventDefault } = keyEvent('ArrowRight', owner);
      handleHotkey(event, vi.fn());
      expect(preventDefault).not.toHaveBeenCalled();
      expect(state.setTuning).not.toHaveBeenCalled();
    });

  it.each(['dialog', '[role="dialog"]', '[role="alertdialog"]'])
    ('does not change the receiver from inside %s', (owner) => {
      for (const key of [' ', 'm', 'r', 'ArrowUp']) handleHotkey(keyEvent(key, owner).event, vi.fn());
      expect(getState).not.toHaveBeenCalled();
    });

  it.each(['defaultPrevented', 'metaKey', 'ctrlKey', 'altKey', 'isComposing'])
    ('respects %s before handling shortcuts', (flag) => {
      const { event, preventDefault } = keyEvent('r', undefined, { [flag]: true });
      handleHotkey(event, vi.fn());
      expect(preventDefault).not.toHaveBeenCalled();
      expect(state.toggleRecording).not.toHaveBeenCalled();
    });

  it('leaves editable content alone', () => {
    handleHotkey(keyEvent('m', undefined, { target: { isContentEditable: true } }).event, vi.fn());
    expect(state.setMode).not.toHaveBeenCalled();
  });

  it('still controls power, tuning, modes and recording from the console background', () => {
    const power = keyEvent(' ');
    handleHotkey(power.event, vi.fn());
    expect(power.preventDefault).toHaveBeenCalledOnce();
    expect(state.stop).toHaveBeenCalledOnce();
    state.running = false;
    handleHotkey(keyEvent(' ').event, vi.fn());
    expect(state.start).toHaveBeenCalledOnce();
    handleHotkey(keyEvent('ArrowRight').event, vi.fn());
    expect(state.setTuning).toHaveBeenLastCalledWith(2500);
    handleHotkey(keyEvent('ArrowLeft', undefined, { shiftKey: true }).event, vi.fn());
    expect(state.setTuning).toHaveBeenLastCalledWith(-25000);
    handleHotkey(keyEvent('m').event, vi.fn());
    expect(state.setMode).toHaveBeenCalledWith('am');
    state.running = true;
    handleHotkey(keyEvent('r').event, vi.fn());
    expect(state.toggleRecording).toHaveBeenCalledOnce();
  });

  it('does not retune from other sections, but keeps the help shortcut', () => {
    state.view = 'academy';
    const help = vi.fn();
    handleHotkey(keyEvent('ArrowRight').event, help);
    expect(state.setTuning).not.toHaveBeenCalled();
    handleHotkey(keyEvent('?').event, help);
    expect(help).toHaveBeenCalledOnce();
  });
});
