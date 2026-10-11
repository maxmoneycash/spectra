import { afterEach, expect, it, vi } from 'vitest';

// Keep the actual stores and scene transitions; only the worker/audio boundary
// is unavailable in the Node test environment.
const engine = vi.hoisted(() => ({
  on: () => () => {},
  closeCapture: vi.fn(),
  loadScene: vi.fn(),
  setTuning: vi.fn(),
  setMode: vi.fn(),
  setBandwidth: vi.fn(),
  setSquelch: vi.fn(),
}));
vi.mock('../engine/engine', () => ({ getEngine: () => engine }));

import { useStore } from '../store/store';
import { useCtf } from '../ctf/store';
import { LESSONS } from './lessons';
import { useGuide } from './store';

afterEach(() => {
  useStore.setState(useStore.getInitialState(), true);
  useCtf.setState(useCtf.getInitialState(), true);
  useGuide.setState(useGuide.getInitialState(), true);
  vi.clearAllMocks();
});

it('leaves capture playback before loading the guided training band', () => {
  const lesson = LESSONS[0];
  useStore.setState({
    running: true,
    view: 'ctf',
    centerFreqHz: 462_675_000,
    tuningOffsetHz: 25_000,
    capture: {
      name: 'cold-case.capture',
      sampleRate: 1_152_000,
      datatype: 'ci16_le',
      centerFreqHz: 462_675_000,
      totalSec: 15,
    },
    sceneLabel: { name: 'cold-case.capture', tag: 'capture', from: 'console' },
  });
  useCtf.getState().setActive('cold-case');

  useGuide.getState().start(lesson.id);

  expect(useStore.getState()).toMatchObject({
    capture: null,
    view: 'console',
    centerFreqHz: lesson.scene.centerFreqHz,
    tuningOffsetHz: 0,
    sceneLabel: { name: lesson.title, tag: 'training', from: 'academy' },
  });
  expect(useGuide.getState()).toMatchObject({ lessonId: lesson.id, step: 0, finishedId: null });
  expect(useCtf.getState().activeId).toBeNull();
  expect(engine.closeCapture).toHaveBeenCalledOnce();
  // stopCapture restores the sandbox, so it must happen BEFORE the lesson
  // loads. Checking the final engine scene catches either a missing or late stop.
  expect(engine.loadScene).toHaveBeenLastCalledWith(lesson.scene);
});
