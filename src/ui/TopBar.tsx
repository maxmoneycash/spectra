import { motion } from 'framer-motion';
import { useStore } from '../store/store';
import { scenarioById } from '../scenarios/scenarios';
import {
  IconPlay,
  IconPause,
  IconPrev,
  IconNext,
  IconRecord,
  IconEye,
  IconGrid,
} from './icons';

/**
 * Command bar: brand, active mission, transport, record / reveal / panels.
 */
export function TopBar({
  onOpenPanels,
  onToggleKeys,
}: {
  onOpenPanels: () => void;
  onToggleKeys: () => void;
}) {
  const running = useStore((s) => s.running);
  const start = useStore((s) => s.start);
  const stop = useStore((s) => s.stop);
  const tuneStep = useStore((s) => s.tuneStep);
  const recording = useStore((s) => s.recording);
  const toggleRecording = useStore((s) => s.toggleRecording);
  const revealTruth = useStore((s) => s.revealTruth);
  const toggleReveal = useStore((s) => s.toggleReveal);
  const scenarioId = useStore((s) => s.scenarioId);
  const setPanel = useStore((s) => s.setPanel);
  const detections = useStore((s) => s.detections);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);

  const sc = scenarioById(scenarioId);
  const isConsole = view === 'console';

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-dot" />
        <span className="brand-name">SPECTRA</span>
        <span className="brand-tag">SDR Lab</span>
      </div>

      <div className="segctl view-seg" role="tablist" aria-label="View">
        {(['console', 'academy'] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            className={`seg-item ${view === v ? 'active' : ''}`}
            onClick={() => setView(v)}
          >
            {view === v && (
              <motion.span
                layoutId="view-pill"
                className="seg-pill"
                transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              />
            )}
            <span>{v === 'console' ? 'Console' : 'Academy'}</span>
          </button>
        ))}
      </div>

      {isConsole && sc && (
        <button
          className="scen-chip"
          onClick={() => {
            setPanel('scenario');
            onOpenPanels();
          }}
          title="Open mission briefing"
        >
          <span className="scen-dot" />
          <span className="scen-name">{sc.name}</span>
          <span className="scen-diff">{sc.difficulty}</span>
        </button>
      )}

      <div className="tb-spacer" />

      <div className="transport">
        <motion.button
          className="tp-btn"
          onClick={() => tuneStep(-1)}
          disabled={!running || detections.length === 0}
          aria-label="Previous signal"
          title="Previous detected signal"
          whileTap={{ scale: 0.9 }}
        >
          <IconPrev />
        </motion.button>
        <motion.button
          className="tp-play"
          onClick={() => (running ? stop() : start())}
          aria-label={running ? 'Stop the simulation' : 'Start the simulation'}
          title={running ? 'Stop' : 'Start'}
          whileTap={{ scale: 0.92 }}
        >
          {running ? <IconPause /> : <IconPlay />}
        </motion.button>
        <motion.button
          className="tp-btn"
          onClick={() => tuneStep(1)}
          disabled={!running || detections.length === 0}
          aria-label="Next signal"
          title="Next detected signal"
          whileTap={{ scale: 0.9 }}
        >
          <IconNext />
        </motion.button>
      </div>

      <div className="tb-div" />

      <motion.button
        className={`iconbtn ${recording ? 'rec-on' : ''}`}
        onClick={toggleRecording}
        disabled={!running}
        title={recording ? 'Stop recording (exports SigMF)' : 'Record I/Q to SigMF'}
        aria-label="Record I/Q"
        whileTap={{ scale: 0.9 }}
      >
        <IconRecord />
      </motion.button>
      {isConsole && (
        <motion.button
          className={`iconbtn ${revealTruth ? 'on' : ''}`}
          onClick={toggleReveal}
          title="Reveal ground truth"
          aria-label="Reveal ground truth"
          whileTap={{ scale: 0.9 }}
        >
          <IconEye />
        </motion.button>
      )}
      <motion.button
        className="iconbtn"
        onClick={onToggleKeys}
        title="Keyboard shortcuts"
        aria-label="Keyboard shortcuts"
        whileTap={{ scale: 0.9 }}
      >
        <span className="keys-glyph">?</span>
      </motion.button>

      {isConsole && (
        <motion.button
          className="iconbtn panels-btn"
          onClick={onOpenPanels}
          title="Open panels"
          aria-label="Open panels"
          whileTap={{ scale: 0.9 }}
        >
          <IconGrid />
          {detections.length > 0 && <span className="panels-badge">{detections.length}</span>}
        </motion.button>
      )}
    </header>
  );
}
