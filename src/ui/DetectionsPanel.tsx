import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../store/store';
import { getEngine } from '../engine/engine';
import { nearestGroundTruth } from '../scenarios/scoring';
import type { TrackMsg } from '../engine/protocol';
import { KIND_INFO } from '../sim/signal-kinds';
import { SnrHistory } from './SnrHistory';

function kindColor(track: TrackMsg): string {
  return KIND_INFO[track.guessKind]?.color ?? '#8a8680';
}

function DetItem({ track }: { track: TrackMsg }) {
  const selectedId = useStore((s) => s.selectedId);
  const tuneToTrack = useStore((s) => s.tuneToTrack);
  const identify = useStore((s) => s.identify);
  const revealTruth = useStore((s) => s.revealTruth);
  const selected = selectedId === track.id;
  const truth = revealTruth
    ? nearestGroundTruth(track.centerFreqHz, track.bandwidthHz, getEngine().groundTruth())
    : null;
  const color = kindColor(track);
  const conf = Math.round(track.guessConfidence * 100);

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.38 }}
      className={`det-item ${selected ? 'selected' : ''}`}
      onClick={() => tuneToTrack(track)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') tuneToTrack(track);
      }}
    >
      <div className="det-head">
        <span className="det-dot" style={{ background: color }} />
        <span className="det-kind">{track.guessLabel}</span>
        <span className="det-freq">
          {(track.centerFreqHz / 1e6).toFixed(4)}
          <span className="mhz">MHz</span>
        </span>
      </div>
      <div className="det-meta">
        <span>SNR {track.snrDb.toFixed(0)} dB</span>
        <span>BW {(track.bandwidthHz / 1000).toFixed(1)} kHz</span>
        <span>{track.duty > 0.7 ? 'continuous' : 'bursty'}</span>
        <span style={{ marginLeft: 'auto' }}>{conf}%</span>
      </div>
      <div className="conf-bar">
        <div className="fill" style={{ width: `${conf}%`, background: color }} />
      </div>
      {truth && <div className="det-truth">truth: {truth.label}</div>}
      <AnimatePresence initial={false}>
        {selected && (
          <motion.div
            className="det-expand"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="det-expand-label">Identify as</div>
            <div className="id-actions">
              {track.candidates.map((c) => (
                <button
                  key={c.kind}
                  className="id-chip"
                  title={c.reason}
                  onClick={() => identify(track.id, c.kind)}
                >
                  {c.label} {Math.round(c.confidence * 100)}%
                </button>
              ))}
            </div>
            <SnrHistory trackId={track.id} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function DetectionsPanel() {
  const detections = useStore((s) => s.detections);
  const idFeedback = useStore((s) => s.idFeedback);
  const running = useStore((s) => s.running);
  const sorted = [...detections].sort((a, b) => b.snrDb - a.snrDb);

  return (
    <div>
      <div className="panel-head">
        <span className="panel-title">Detected emissions</span>
        <span className="panel-sub">{detections.length} tracked</span>
      </div>
      <AnimatePresence>
        {idFeedback && Date.now() - idFeedback.at < 6000 && (
          <motion.div
            key={idFeedback.at}
            className={`feedback ${idFeedback.correct ? 'ok' : 'no'}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {idFeedback.message}
          </motion.div>
        )}
      </AnimatePresence>
      {sorted.length === 0 ? (
        <div className="empty">
          <b>No emissions detected</b>
          <br />
          {running
            ? 'The detector is scanning the averaged spectrum. Emissions will appear here as they are found.'
            : 'Start the simulation and the detector will find and classify signals across the band.'}
        </div>
      ) : (
        <div className="det-list">
          {sorted.map((t) => (
            <DetItem key={t.id} track={t} />
          ))}
        </div>
      )}
      <div className="hint">
        Click a signal to tune it. The classifier grades its guess from bandwidth, duty cycle and
        carrier shape. Select a tuned card to grade your own identification.
      </div>
    </div>
  );
}
