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
    <div className="mono-feats flex h-[26px] items-center gap-4 overflow-hidden whitespace-nowrap border-t border-line bg-background px-3 font-mono text-[10px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-foreground" />
        SIMULATED RF<span className="max-sm:hidden"> · NO HARDWARE</span>
      </span>
      <span className="max-md:hidden">{(SAMPLE_RATE / 1e6).toFixed(3)} MSPS</span>
      <span className="max-md:hidden">
        MODE <b className="font-medium text-foreground">{mode.toUpperCase()}</b>
      </span>
      <span className="max-md:hidden">BW {(bandwidthHz / 1000).toFixed(1)} kHz</span>
      <span>
        VFO {((centerFreqHz + tuningOffsetHz) / 1e6).toFixed(4)} MHz
        <span className="max-sm:hidden">
          {' '}
          ({tuningOffsetHz >= 0 ? '+' : ''}
          {(tuningOffsetHz / 1000).toFixed(0)} kHz)
        </span>
      </span>
      {mode === 'cw' && morseText && (
        <span className="text-foreground">CW: {morseText.slice(-32)}</span>
      )}
      <span className="flex-1" />
      <span className="flex items-center gap-1.5">
        <span
          className={
            running
              ? 'size-1.5 animate-pulse rounded-full bg-foreground'
              : 'size-1.5 rounded-full bg-muted-foreground/50'
          }
        />
        {running ? 'RUNNING' : 'IDLE'}
      </span>
    </div>
  );
}
