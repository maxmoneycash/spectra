import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useStore, nearestLabel, DEMOD_MODES } from '../../store/store';
import type { DemodMode } from '../../sim/signal-kinds';
import { Odometer } from './Odometer';
import { Fader } from './Fader';
import { Meter } from '../Meter';
import { DeckScopes } from '../Scopes';
import { fmtMHz, fmtElapsed, fmtBw, parseFreqInput } from '../format';

const BW_RANGE: Record<DemodMode, [number, number, number]> = {
  wfm: [100_000, 240_000, 5_000],
  nfm: [6_000, 25_000, 500],
  am: [3_000, 16_000, 500],
  usb: [1_200, 4_000, 100],
  lsb: [1_200, 4_000, 100],
  cw: [200, 2_000, 50],
  raw: [5_000, 300_000, 5_000],
};

/**
 * The receiver console: VFO readout (click to type), demod modes,
 * bandwidth / squelch / volume / noise faders, S-meter, live scopes.
 */
export function ReceiverDeck() {
  const centerFreqHz = useStore((s) => s.centerFreqHz);
  const tuningOffsetHz = useStore((s) => s.tuningOffsetHz);
  const tuneTo = useStore((s) => s.tuneTo);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const bandwidthHz = useStore((s) => s.bandwidthHz);
  const setBandwidth = useStore((s) => s.setBandwidth);
  const squelchDb = useStore((s) => s.squelchDb);
  const setSquelch = useStore((s) => s.setSquelch);
  const volume = useStore((s) => s.volume);
  const setVolume = useStore((s) => s.setVolume);
  const noiseSigma = useStore((s) => s.noiseSigma);
  const setNoise = useStore((s) => s.setNoise);
  const detections = useStore((s) => s.detections);
  const running = useStore((s) => s.running);
  const playingSince = useStore((s) => s.playingSince);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  // Elapsed-time ticker (1 Hz, only while running).
  const [, force] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const tuned = centerFreqHz + tuningOffsetHz;
  const station = nearestLabel(detections, tuningOffsetHz);
  const [bwMin, bwMax, bwStep] = BW_RANGE[mode];

  const commit = () => {
    const hz = parseFreqInput(draft);
    if (hz !== null) tuneTo(hz);
    setEditing(false);
  };

  return (
    <footer className="deck" aria-label="Receiver">
      <div className="deck-group deck-vfo">
        <div className="deck-label">VFO</div>
        {editing ? (
          <input
            className="vfo-edit"
            autoFocus
            value={draft}
            spellCheck={false}
            aria-label="Enter frequency in MHz"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <button
            className="vfo-readout"
            onClick={() => {
              setDraft(fmtMHz(tuned));
              setEditing(true);
            }}
            title="Click to type a frequency"
            aria-label="Tuned frequency, click to edit"
          >
            <Odometer text={fmtMHz(tuned)} />
            <span className="vfo-unit">MHz</span>
          </button>
        )}
        <div className="vfo-meta">
          <span className="vfo-station">{station ?? 'No signal'}</span>
          <span className="vfo-mode">{mode.toUpperCase()}</span>
          <span>{running ? fmtElapsed(playingSince) : 'idle'}</span>
        </div>
      </div>

      <div className="deck-group deck-modes">
        <div className="deck-label">Demod</div>
        <div className="modeseg" role="radiogroup" aria-label="Demodulation mode">
          {DEMOD_MODES.map((m) => (
            <button
              key={m}
              className={`modechip ${mode === m ? 'active' : ''}`}
              onClick={() => setMode(m)}
              role="radio"
              aria-checked={mode === m}
            >
              {mode === m && (
                <motion.span
                  layoutId="mode-pill"
                  className="mode-pill"
                  transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                />
              )}
              <span style={{ position: 'relative' }}>{m.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="deck-group deck-faders">
        <Fader
          name="Bandwidth"
          value={bandwidthHz}
          min={bwMin}
          max={bwMax}
          step={bwStep}
          fmt={fmtBw}
          onChange={setBandwidth}
        />
        <Fader
          name="Squelch"
          value={squelchDb}
          min={-120}
          max={-20}
          step={1}
          fmt={(v) => `${v} dB`}
          onChange={setSquelch}
        />
        <Fader
          name="Volume"
          value={volume}
          min={0}
          max={1}
          step={0.01}
          fmt={(v) => `${Math.round(v * 100)}%`}
          onChange={setVolume}
        />
        <Fader
          name="Noise"
          value={noiseSigma}
          min={0.005}
          max={0.12}
          step={0.005}
          fmt={(v) => `σ ${v.toFixed(3)}`}
          onChange={setNoise}
        />
      </div>

      <div className="deck-group deck-meter">
        <Meter />
      </div>

      <div className="deck-group deck-scopes">
        <DeckScopes />
      </div>
    </footer>
  );
}
