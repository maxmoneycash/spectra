import { useStore } from '../store/store';
import { DEFAULT_SQUELCH_DB } from '../store/modes';
import { useCtf } from './store';
import { challengeById, toSceneSpec } from './challenges';

/**
 * Open a mission from anywhere: load its RF scene into the live engine, set
 * the squelch the mission is designed around (open for most, raised above
 * the beacon for Below the Gate), and make it the active tasking. The view
 * switch is the caller's — Tasking stays put, Station jumps.
 */
export function openMission(id: string): boolean {
  const c = challengeById(id);
  if (!c) return false;
  const st = useStore.getState();
  st.loadSpec(toSceneSpec(c), { name: c.name, tag: 'tasking', from: 'ctf' });
  st.setSquelch(c.startSquelchDb ?? DEFAULT_SQUELCH_DB);
  useCtf.getState().setActive(id);
  return true;
}
