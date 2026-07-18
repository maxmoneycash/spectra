import { motion } from 'framer-motion';
import { useStore } from '../store/store';
import { ALL_KINDS, KIND_INFO } from '../sim/signal-kinds';
import { fmtMHz } from './format';

export function SignalLibrary() {
  const injectSignal = useStore((s) => s.injectSignal);
  const running = useStore((s) => s.running);
  const recordings = useStore((s) => s.recordings);

  return (
    <div>
      {recordings.length > 0 && (
        <>
          <div className="panel-head">
            <span className="panel-title">Captures</span>
            <span className="panel-sub">{recordings.length} saved</span>
          </div>
          <div className="cap-list">
            {recordings.map((r) => (
              <div key={r.name} className="cap-item">
                <span className="cap-name">{r.name}</span>
                <span className="cap-when">
                  {fmtMHz(r.centerFreqHz)} MHz · {r.durationSec.toFixed(0)}s
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="panel-head">
        <span className="panel-title">Signal library</span>
        <span className="panel-sub">{ALL_KINDS.length} types</span>
      </div>
      <div className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
        An interactive field guide. Inject a signal into the live band to see its waterfall
        signature and hear it demodulated.
      </div>
      <div className="lib-list">
        {ALL_KINDS.map((kind, i) => {
          const info = KIND_INFO[kind];
          return (
            <motion.div
              key={kind}
              className="lib-item"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.35, delay: Math.min(i * 0.03, 0.24) }}
            >
              <div className="lib-head">
                <span className="lib-chip" style={{ background: info.color }} />
                <span className="lib-title">{info.label}</span>
                <span className="lib-bw">
                  {info.bandwidthHz >= 1000
                    ? `${(info.bandwidthHz / 1000).toFixed(0)} kHz`
                    : `${info.bandwidthHz} Hz`}
                </span>
              </div>
              <div className="lib-blurb">{info.blurb}</div>
              <div className="lib-detail">
                <b>Waterfall:</b> {info.waterfall}
                <br />
                <b>Real world:</b> {info.realWorld}
              </div>
              <button
                className="lib-inject"
                disabled={!running}
                onClick={() => injectSignal(kind)}
                title={running ? 'Add this signal to the current band' : 'Start the simulation first'}
              >
                + Inject into band
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
