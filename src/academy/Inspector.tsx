import { motion, AnimatePresence } from 'framer-motion';
import { BANDS, fmtAxisFreq, fmtWavelength, type AcademyBand } from './data';

const SIM_BANDS = BANDS.filter((b) => b.scenarioId);

export function Inspector({
  band,
  onPick,
  onTune,
}: {
  band: AcademyBand | null;
  onPick: (id: string) => void;
  onTune: (scenarioId: string) => void;
}) {
  return (
    <div className="acad-inspector">
      <AnimatePresence mode="wait" initial={false}>
        {band ? (
          <motion.div
            key={band.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
          >
            <div className="acad-insp-head">
              <span className="acad-insp-name">{band.name}</span>
              <span className="acad-insp-freq">
                {fmtAxisFreq(band.fStartHz)} – {fmtAxisFreq(band.fEndHz)}
              </span>
            </div>
            <div className="acad-insp-lambda">λ {fmtWavelength((band.fStartHz + band.fEndHz) / 2)}</div>
            <p className="acad-insp-summary">{band.summary}</p>
            <div className="acad-insp-row">
              <span className="acad-insp-label">Who is here</span>
              <span>{band.services}</span>
            </div>
            <div className="acad-insp-row">
              <span className="acad-insp-label">Propagation</span>
              <span>{band.propagation}</span>
            </div>
            {band.scenarioId && (
              <motion.button
                className="acad-tune-btn"
                onClick={() => onTune(band.scenarioId!)}
                whileTap={{ scale: 0.97 }}
              >
                ▶ Tune the simulator here
              </motion.button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <div className="acad-insp-head">
              <span className="acad-insp-name">Pick a band</span>
            </div>
            <p className="acad-insp-summary">
              Every frequency has an owner and a job. Click any block above to see who lives there
              and how the waves behave. These bands exist inside SPECTRA's simulator:
            </p>
            <div className="acad-sim-chips">
              {SIM_BANDS.map((b) => (
                <button key={b.id} className="acad-chip" onClick={() => onPick(b.id)}>
                  ▶ {b.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
