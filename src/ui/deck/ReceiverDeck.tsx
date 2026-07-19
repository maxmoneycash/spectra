import { useEffect, useState } from 'react';
import { useStore, nearestLabel, DEMOD_MODES } from '../../store/store';
import { getEngine } from '../../engine/engine';
import type { DemodMode } from '../../sim/signal-kinds';
import { Odometer } from './Odometer';
import { Fader } from './Fader';
import { Meter } from '../Meter';
import { IQScope } from '../Scopes';
import { fmtMHz, fmtElapsed, fmtBw, parseFreqInput } from '../format';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { BarVisualizer } from '@/components/ui/bar-visualizer';
import { cn } from '@/lib/utils';

const BW_RANGE: Record<DemodMode, [number, number, number]> = {
  wfm: [100_000, 240_000, 5_000],
  nfm: [6_000, 25_000, 500],
  am: [3_000, 16_000, 500],
  usb: [1_200, 4_000, 100],
  lsb: [1_200, 4_000, 100],
  cw: [200, 2_000, 50],
  raw: [5_000, 300_000, 5_000],
};

const GroupLabel = ({ children }: { children: string }) => (
  <span className="mono-feats font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted-foreground">
    {children}
  </span>
);

function AudioBars() {
  const running = useStore((s) => s.running);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (running) {
      setStream(getEngine().getAudioStream());
    } else {
      setStream(null);
    }
  }, [running]);

  return (
    <div className="dark flex min-w-0 flex-1 flex-col gap-1.5">
      <GroupLabel>Audio</GroupLabel>
      <div className="overflow-hidden rounded-lg border border-stage-border bg-stage p-2">
        <BarVisualizer
          mediaStream={stream}
          barCount={24}
          minHeight={8}
          maxHeight={100}
          demo={!stream}
          className="h-[76px] w-full bg-transparent p-0"
        />
      </div>
    </div>
  );
}

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
    <footer
      aria-label="Receiver"
      className="flex flex-wrap items-stretch border-t border-border bg-background"
    >
      {/* VFO */}
      <div className="flex min-w-[216px] flex-col justify-center gap-1.5 px-4 py-3">
        <GroupLabel>VFO</GroupLabel>
        {editing ? (
          <input
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
            className="mono-feats w-[11ch] rounded-lg border border-ring bg-secondary px-2 py-1 font-mono text-xl text-foreground caret-foreground outline-none"
          />
        ) : (
          <button
            onClick={() => {
              setDraft(fmtMHz(tuned));
              setEditing(true);
            }}
            title="Click to type a frequency"
            aria-label="Tuned frequency, click to edit"
            className="-mx-1 rounded-lg px-1 text-left transition-colors hover:bg-accent"
          >
            <span className="mono-feats font-mono text-[32px] leading-none tracking-tight text-foreground">
              <Odometer text={fmtMHz(tuned)} />
            </span>
            <span className="mono-feats ml-1.5 font-mono text-[11px] text-muted-foreground">
              MHz
            </span>
          </button>
        )}
        <div className="mono-feats flex items-center gap-2 truncate font-mono text-[10px] text-muted-foreground">
          <span className="truncate font-medium text-foreground">{station ?? 'No signal'}</span>
          <span className="text-muted-foreground">{mode.toUpperCase()}</span>
          <span>{running ? fmtElapsed(playingSince) : 'idle'}</span>
        </div>
      </div>

      {/* Demod */}
      <div className="flex flex-col justify-center gap-1.5 border-l border-border px-4 py-3 max-sm:basis-full max-sm:border-l-0 max-sm:border-t">
        <GroupLabel>Demod</GroupLabel>
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => v && setMode(v as DemodMode)}
          className="justify-start"
          aria-label="Demodulation mode"
        >
          {DEMOD_MODES.map((m) => (
            <ToggleGroupItem
              key={m}
              value={m}
              aria-label={m.toUpperCase()}
              className="mono-feats h-7 px-2.5 font-mono text-[10px]"
            >
              {m.toUpperCase()}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Faders */}
      <div
        className={cn(
          'grid flex-1 grid-cols-[repeat(auto-fit,minmax(118px,1fr))] content-center gap-x-5 gap-y-1.5 border-l border-border px-4 py-3',
          'max-sm:flex max-sm:basis-full max-sm:flex-row max-sm:gap-5 max-sm:overflow-x-auto max-sm:border-l-0 max-sm:border-t',
        )}
      >
        <div className="max-sm:w-32 max-sm:flex-none">
          <Fader
            name="Bandwidth"
            value={bandwidthHz}
            min={bwMin}
            max={bwMax}
            step={bwStep}
            fmt={fmtBw}
            onChange={setBandwidth}
          />
        </div>
        <div className="max-sm:w-32 max-sm:flex-none">
          <Fader
            name="Squelch"
            value={squelchDb}
            min={-120}
            max={-20}
            step={1}
            fmt={(v) => `${v} dB`}
            onChange={setSquelch}
          />
        </div>
        <div className="max-sm:w-32 max-sm:flex-none">
          <Fader
            name="Volume"
            value={volume}
            min={0}
            max={1}
            step={0.01}
            fmt={(v) => `${Math.round(v * 100)}%`}
            onChange={setVolume}
          />
        </div>
        <div className="max-sm:w-32 max-sm:flex-none">
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
      </div>

      {/* S-meter */}
      <div className="flex w-[172px] flex-col justify-center border-l border-border px-4 py-3 max-sm:w-auto max-sm:min-w-[150px] max-sm:flex-1">
        <Meter />
      </div>

      {/* Scopes */}
      <div className="flex w-[330px] items-center gap-3 border-l border-border px-4 py-3 max-xl:hidden">
        <IQScope />
        <AudioBars />
      </div>
    </footer>
  );
}
