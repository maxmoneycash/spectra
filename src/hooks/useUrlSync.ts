import { useEffect, useRef } from 'react';
import { useStore } from '../store/store';
import { useExam } from '../exam/store';
import { useCtf } from '../ctf/store';
import { challengeById, toSceneSpec } from '../ctf/challenges';
import { scenarioById } from '../scenarios/scenarios';
import { POOLS, type ElementId } from '../exam/types';
import { getEngine } from '../engine/engine';
import { readUrl, writeUrl } from '../lib/urlState';

/**
 * Two-way binding between the address bar and app state: apply an incoming
 * link once on mount, then keep the URL current as the user navigates.
 */
export function useUrlSync(): void {
  const applied = useRef(false);

  // ---- inbound: apply the link we arrived on -----------------------------
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    const url = readUrl();

    if (url.scenario && scenarioById(url.scenario)) {
      useStore.getState().loadScenario(url.scenario);
    }

    if (url.c) {
      const c = challengeById(url.c);
      if (c) {
        getEngine().loadScene(toSceneSpec(c));
        useStore.setState({
          centerFreqHz: c.centerFreqHz,
          tuningOffsetHz: 0,
          detections: [],
        });
        getEngine().setTuning(0);
        useCtf.getState().setActive(c.id);
      }
    }

    if (url.pool && POOLS.some((p) => p.id === url.pool)) {
      // The topic filter can only be applied once that pool's questions exist.
      void useExam
        .getState()
        .loadPool(url.pool as ElementId)
        .then(() => {
          if (!url.topic) return;
          const known = useExam.getState().questions.some((q) => q.id.startsWith(url.topic!));
          if (known) useExam.getState().setSubFilter(url.topic!.toUpperCase());
        });
    }

    // View last, so it wins over any default a loader above may have set.
    if (url.view) useStore.getState().setView(url.view);
  }, []);

  // ---- outbound: reflect state back into the address bar -----------------
  const view = useStore((s) => s.view);
  const scenarioId = useStore((s) => s.scenarioId);
  const pool = useExam((s) => s.pool);
  const topic = useExam((s) => s.subFilter);
  const activeC = useCtf((s) => s.activeId);

  useEffect(() => {
    if (!applied.current) return;
    writeUrl({
      view,
      // Only carry the param that belongs to the view being shown, so a shared
      // link is about one thing.
      scenario: view === 'console' ? scenarioId : undefined,
      pool: view === 'exam' ? pool : undefined,
      topic: view === 'exam' && topic ? topic : undefined,
      c: view === 'ctf' && activeC ? activeC : undefined,
    });
  }, [view, scenarioId, pool, topic, activeC]);
}
