import { useStore } from '../store/store';
import { DEFAULT_SQUELCH_DB } from '../store/modes';
import { getEngine } from '../engine/engine';
import { useCtf } from './store';
import { challengeById, toSceneSpec } from './challenges';

/**
 * Open a mission from anywhere: put its RF in the live engine, set the
 * squelch the mission is designed around (open for most, raised above the
 * beacon for Below the Gate), and make it the active tasking. The view
 * switch is the caller's — Tasking stays put, Station jumps.
 *
 * A live mission loads its scene. A forensics mission is a recording: the
 * simulator renders the scene once, with a fixed seed so every copy is the
 * same file, and the receiver plays that back — no ground truth, no reveal,
 * and it loops, exactly like a capture you loaded yourself.
 */
export async function openMission(id: string): Promise<boolean> {
  const c = challengeById(id);
  if (!c) return false;
  const st = useStore.getState();
  useCtf.getState().setActive(id);
  if (c.capture) {
    if (st.capture?.name === `${c.id}.capture`) return true; // already playing this one
    st.setCaptureRendering({ id: c.id, pct: 0 });
    const off = getEngine().on('captureProgress', (p) => {
      if (p.id === c.id) useStore.getState().setCaptureRendering({ id: c.id, pct: p.pct });
    });
    try {
      const { blob, meta } = await getEngine().renderCapture(c.id, toSceneSpec(c), c.capture.seconds, c.capture.datatype, c.capture.seed);
      await useStore.getState().loadCapture(blob, meta, `${c.id}.capture`);
      useStore.getState().setSquelch(c.startSquelchDb ?? DEFAULT_SQUELCH_DB);
    } finally {
      off();
      useStore.getState().setCaptureRendering(null);
    }
    return true;
  }
  if (st.capture) st.stopCapture();
  st.loadSpec(toSceneSpec(c), { name: c.name, tag: 'tasking', from: 'ctf' });
  st.setSquelch(c.startSquelchDb ?? DEFAULT_SQUELCH_DB);
  return true;
}
