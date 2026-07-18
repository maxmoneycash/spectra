import { useStore } from '../store/store';
import { SAMPLE_RATE } from '../engine/protocol';

export function StatusBar() {
  const mode = useStore((s) => s.mode);
  const bandwidthHz = useStore((s) => s.bandwidthHz);
  const centerFreqHz = useStore((s) => s.centerFreqHz);
  const tuningOffsetHz = useStore((s) => s.tuningOffsetHz);
  const running = useStore((s) => s.running);
  const morseText = useStore((s) => s.morseText);

  return (
    <div className="statusbar">
      <span>
        <span className="sim-dot">●</span> SIMULATED RF<span className="sb-opt"> · NO HARDWARE</span>
      </span>
      <span className="sb-opt">{(SAMPLE_RATE / 1e6).toFixed(3)} MSPS</span>
      <span className="sb-opt">
        MODE <b>{mode.toUpperCase()}</b>
      </span>
      <span className="sb-opt">BW {(bandwidthHz / 1000).toFixed(1)} kHz</span>
      <span>
        VFO {((centerFreqHz + tuningOffsetHz) / 1e6).toFixed(4)} MHz
        <span className="sb-opt">
          {' '}
          ({tuningOffsetHz >= 0 ? '+' : ''}
          {(tuningOffsetHz / 1000).toFixed(0)} kHz)
        </span>
      </span>
      {mode === 'cw' && morseText && <span className="morse">CW: {morseText.slice(-32)}</span>}
      <span className="grow" />
      <span className={`status-run ${running ? 'live' : ''}`}>
        <span className="run-dot" />
        {running ? 'RUNNING' : 'IDLE'}
      </span>
    </div>
  );
}
