import { useEffect, useRef } from 'react';
import { useStore } from '../store/store';
import { SAMPLE_RATE } from '../engine/protocol';
import { getEngine } from '../engine/engine';

const mmss = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/** Playback position, written straight to the DOM — it ticks at 8 Hz and nothing else needs it. */
function CapturePos({ totalSec }: { totalSec: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(
    () =>
      getEngine().on('capture', (s) => {
        if (ref.current) ref.current.textContent = `${mmss(s.posSec)} / ${mmss(totalSec)}`;
      }),
    [totalSec],
  );
  return <span ref={ref}>{`00:00 / ${mmss(totalSec)}`}</span>;
}

export function StatusBar() {
  const mode = useStore((s) => s.mode);
  const bandwidthHz = useStore((s) => s.bandwidthHz);
  const centerFreqHz = useStore((s) => s.centerFreqHz);
  const tuningOffsetHz = useStore((s) => s.tuningOffsetHz);
  const running = useStore((s) => s.running);
  const morseText = useStore((s) => s.morseText);
  const capture = useStore((s) => s.capture);

  return (
    <div className="mono-feats flex h-[26px] items-center gap-4 overflow-hidden whitespace-nowrap border-t border-line bg-background px-3 font-mono text-[10px] text-muted-foreground">
      {capture ? (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-tuned" />
          PLAYBACK
          <span className="max-sm:hidden"> · {capture.name}</span> · <CapturePos totalSec={capture.totalSec} /> · LOOP
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-foreground" />
          SIMULATED RF<span className="max-sm:hidden"> · NO HARDWARE</span>
        </span>
      )}
      <span className="max-md:hidden">
        {capture ? `${(capture.sampleRate / 1e6).toFixed(3)} → ` : ''}
        {(SAMPLE_RATE / 1e6).toFixed(3)} MSPS
      </span>
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
