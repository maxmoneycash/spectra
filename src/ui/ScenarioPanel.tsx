import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../store/store';
import { SCENARIOS, scenarioById } from '../scenarios/scenarios';
import { evaluateObjectives } from '../scenarios/scoring';
import { IconCheck } from './icons';

export function ScenarioPanel() {
  const scenarioId = useStore((s) => s.scenarioId);
  const loadScenario = useStore((s) => s.loadScenario);
  const detections = useStore((s) => s.detections);
  const tuningOffsetHz = useStore((s) => s.tuningOffsetHz);
  const mode = useStore((s) => s.mode);
  const morseText = useStore((s) => s.morseText);
  const correctlyIdentified = useStore((s) => s.correctlyIdentified);

  const active = scenarioById(scenarioId)!;
  const done = evaluateObjectives(active, {
    tracks: detections,
    tuningOffsetHz,
    mode,
    morseText,
    correctlyIdentified: new Set(correctlyIdentified),
  });
  const total = active.objectives.length;
  const doneCount = done.filter(Boolean).length;
  const complete = total > 0 && done.every(Boolean);

  return (
    <div>
      <div className="panel-head">
        <span className="panel-title">Mission</span>
        <span className="panel-sub">{active.band}</span>
      </div>
      <div className="mission-name">{active.name}</div>
      <div className="mission-tag">{active.tagline}</div>
      <div className="brief">{active.brief}</div>

      {total > 0 && (
        <>
          <div className="obj-progress">
            <div className="obj-track">
              <div
                className="obj-fill"
                style={{
                  width: `${(doneCount / total) * 100}%`,
                  transition: 'width 0.4s cubic-bezier(0.22,1,0.36,1)',
                }}
              />
            </div>
            <span className="obj-count">
              {doneCount}/{total}
            </span>
          </div>
          {active.objectives.map((o, i) => (
            <div key={i} className={`objective ${done[i] ? 'done' : ''}`}>
              <span className="obj-box">
                <AnimatePresence>
                  {done[i] && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', bounce: 0.45, duration: 0.4 }}
                      style={{ display: 'grid', placeItems: 'center' }}
                    >
                      <IconCheck width={11} height={11} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span className="obj-label">{o.label}</span>
            </div>
          ))}
          <AnimatePresence>
            {complete && (
              <motion.div
                className="mission-complete"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', bounce: 0.25, duration: 0.5 }}
              >
                <div className="big">MISSION COMPLETE</div>
                <div className="sub">All objectives met. Try a harder scenario.</div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <div className="panel-head" style={{ marginTop: 20 }}>
        <span className="panel-title">All missions</span>
      </div>
      <div className="scen-list">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            className={`scenario-card ${s.id === scenarioId ? 'active' : ''}`}
            onClick={() => loadScenario(s.id)}
          >
            <div className="scenario-name">{s.name}</div>
            <div className="scenario-tag">{s.tagline}</div>
            <span className={`diff ${s.difficulty}`}>{s.difficulty}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
