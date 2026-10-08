import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useStore, nearestLabel } from '@/store/store';
import { getEngine } from '@/engine/engine';
import { SAMPLE_RATE } from '@/engine/protocol';
import type { DemodMode } from '@/sim/signal-kinds';
import { Odometer } from './Odometer';
import { TuneSheet } from './TuneSheet';
import { Meter } from '../Meter';
import { ScanPanel } from '../ScanPanel';
import { fmtMHz, fmtBw } from '../format';
import { TuningRuler } from '../kit/TuningRuler';
import { Knob, logTo01, logFrom01 } from '../kit/Knob';
import { Segmented } from '../kit/Segmented';
import { lock, tick } from '../kit/haptics';
import { BarVisualizer } from '@/components/ui/bar-visualizer';
import { cn } from '@/lib/utils';

/** One detent of the tuning dial per mode — each mode's natural channel step. */
const TUNE_STEP: Record<DemodMode, number> = {
  wfm: 25_000,
  nfm: 2_500,
  am: 1_000,
  usb: 100,
  lsb: 100,
  cw: 50,
  raw: 5_000,
};

const BW_RANGE: Record<DemodMode, [number, number, number]> = {
  wfm: [100_000, 240_000, 5_000],
  nfm: [6_000, 25_000, 500],
  am: [3_000, 16_000, 500],
  usb: [1_200, 4_000, 100],
  lsb: [1_200, 4_000, 100],
  cw: [200, 2_000, 50],
  raw: [5_000, 300_000, 5_000],
};

const MODE_TILES: { mode: DemodMode; hint: string }[] = [
  { mode: 'nfm', hint: 'Two-way voice · repeaters' },
  { mode: 'am', hint: 'Aircraft · AM broadcast' },
  { mode: 'wfm', hint: 'FM broadcast stations' },
  { mode: 'usb', hint: 'HF voice above 10 MHz' },
  { mode: 'lsb', hint: 'HF voice below 10 MHz' },
  { mode: 'cw', hint: 'Morse code' },
];

type Page = 'mode' | 'filter' | 'audio' | 'scan';
const PAGES: Page[] = ['mode', 'filter', 'audio', 'scan'];

/**
 * The receiver on a phone. The frequency sits between two seek buttons
 * (each seek hops to the next signal and locks on), the tuning dial runs
 * underneath, and the rest of the controls live on swipeable pages so the
 * waterfall keeps the screen.
 */
export function MobileDeck() {
  const centerFreqHz = useStore((s) => s.centerFreqHz);
  const tuningOffsetHz = useStore((s) => s.tuningOffsetHz);
  const setTuning = useStore((s) => s.setTuning);
  const tuneStep = useStore((s) => s.tuneStep);
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

  const [tuneOpen, setTuneOpen] = useState(false);
  const [page, setPage] = useState<Page>('mode');
  const [emblaRef, embla] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps', skipSnaps: false });

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => {
      const p = PAGES[embla.selectedScrollSnap()];
      setPage((prev) => {
        if (prev !== p) tick();
        return p;
      });
    };
    embla.on('select', onSelect);
    return () => {
      embla.off('select', onSelect);
    };
  }, [embla]);

  const goPage = useCallback(
    (p: Page) => {
      setPage(p);
      embla?.scrollTo(PAGES.indexOf(p));
    },
    [embla],
  );

  const tuned = centerFreqHz + tuningOffsetHz;
  const station = nearestLabel(detections, tuningOffsetHz);
  const [bwMin, bwMax, bwStep] = BW_RANGE[mode];
  const canSeek = running && detections.length > 0;

  return (
    <section aria-label="Receiver controls" className="border-t border-line bg-background">
      {/* VFO: seek · frequency · seek */}
      <div className="flex items-center gap-1 px-2 pt-2">
        <SeekButton dir={-1} disabled={!canSeek} onSeek={() => tuneStep(-1)} />
        <button
          onClick={() => setTuneOpen(true)}
          aria-label={`Tuned to ${fmtMHz(tuned)} megahertz. Open the tuner.`}
          className="flex min-w-0 flex-1 flex-col items-center rounded-xl py-1 transition-colors active:bg-accent"
        >
          <span className="mono-feats flex items-baseline font-mono text-[30px] font-medium leading-none tracking-tight text-foreground">
            <Odometer text={fmtMHz(tuned)} />
            <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">MHz</span>
          </span>
          <span className="mono-feats mt-1 flex max-w-full items-center gap-1.5 truncate font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            <span className={cn('size-1.5 shrink-0 rounded-full', station ? 'bg-emerald-500' : 'bg-border')} />
            <span className={cn('truncate', station && 'text-foreground')}>{station ?? 'No signal'}</span>
            <span>· {mode}</span>
            <span>· {fmtBw(bandwidthHz)}</span>
          </span>
        </button>
        <SeekButton dir={1} disabled={!canSeek} onSeek={() => tuneStep(1)} />
      </div>

      <TuningRuler
        className="mx-1 mt-1"
        value={tuningOffsetHz}
        centerHz={centerFreqHz}
        stepHz={TUNE_STEP[mode]}
        min={-SAMPLE_RATE / 2}
        max={SAMPLE_RATE / 2}
        onChange={setTuning}
      />

      <div className="px-3 pt-1.5">
        <Segmented
          size="sm"
          label="Receiver control page"
          value={page}
          onChange={goPage}
          options={[
            { value: 'mode', label: 'Mode' },
            { value: 'filter', label: 'Filter' },
            { value: 'audio', label: 'Audio' },
            { value: 'scan', label: 'Scan' },
          ]}
        />
      </div>

      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex touch-pan-y">
          {/* MODE */}
          <div className="min-w-0 shrink-0 grow-0 basis-full px-3 py-2.5">
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Demodulation mode">
              {MODE_TILES.map(({ mode: m, hint }) => {
                const active = m === mode;
                return (
                  <button
                    key={m}
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      if (!active) tick();
                      setMode(m);
                    }}
                    className={cn(
                      'flex min-h-[54px] flex-col items-start justify-center rounded-xl border px-2.5 py-1.5 text-left transition-[background-color,border-color,transform] active:scale-[0.97]',
                      active
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-line bg-card text-foreground hover:border-foreground/30',
                    )}
                  >
                    <span className="mono-feats font-mono text-[13px] font-semibold uppercase tracking-wide">{m}</span>
                    <span
                      className={cn(
                        'mt-0.5 line-clamp-1 text-[10px] leading-tight',
                        active ? 'text-background/70' : 'text-muted-foreground',
                      )}
                    >
                      {hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* FILTER */}
          <div className="min-w-0 shrink-0 grow-0 basis-full px-3 py-2">
            <div className="flex items-center justify-around gap-2">
              <Knob
                label="Bandwidth"
                value={bandwidthHz}
                min={bwMin}
                max={bwMax}
                step={bwStep}
                onChange={setBandwidth}
                format={fmtBw}
                mapTo01={logTo01}
                mapFrom01={logFrom01}
                size={68}
              />
              <Knob
                label="Squelch"
                value={squelchDb}
                min={-120}
                max={-20}
                step={1}
                detentEvery={5}
                onChange={setSquelch}
                format={(v) => `${v} dB`}
                size={68}
              />
              <div className="w-[118px] shrink-0">
                <Meter />
              </div>
            </div>
          </div>

          {/* AUDIO */}
          <div className="min-w-0 shrink-0 grow-0 basis-full px-3 py-2">
            <div className="flex items-center justify-around gap-2">
              <Knob
                label="Volume"
                value={volume}
                min={0}
                max={1}
                step={0.01}
                detentEvery={10}
                onChange={setVolume}
                format={(v) => `${Math.round(v * 100)}%`}
                size={68}
              />
              <Knob
                label="Noise"
                value={noiseSigma}
                min={0.005}
                max={0.12}
                step={0.005}
                onChange={setNoise}
                format={(v) => `σ ${v.toFixed(3)}`}
                size={68}
              />
              <AudioBars />
            </div>
          </div>

          {/* SCAN */}
          <div className="min-w-0 shrink-0 grow-0 basis-full px-3 py-2">
            <ScanPanel compact />
          </div>
        </div>
      </div>

      <TuneSheet open={tuneOpen} onOpenChange={setTuneOpen} />
    </section>
  );
}

function SeekButton({ dir, disabled, onSeek }: { dir: 1 | -1; disabled: boolean; onSeek: () => void }) {
  const Icon = dir < 0 ? ChevronsLeft : ChevronsRight;
  return (
    <button
      onClick={() => {
        lock();
        onSeek();
      }}
      disabled={disabled}
      aria-label={dir < 0 ? 'Seek to the previous signal' : 'Seek to the next signal'}
      className="flex h-14 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl text-foreground transition-[transform,opacity] active:scale-90 disabled:opacity-25"
    >
      <Icon className="size-5" strokeWidth={2} />
      <span className="mono-feats font-mono text-[8.5px] uppercase tracking-[0.14em] text-muted-foreground">Seek</span>
    </button>
  );
}

function AudioBars() {
  const running = useStore((s) => s.running);
  const [stream, setStream] = useState<MediaStream | null>(null);
  useEffect(() => {
    setStream(running ? getEngine().getAudioStream() : null);
  }, [running]);
  return (
    <div className="w-[104px] shrink-0 overflow-hidden rounded-xl border border-stage-border bg-stage p-1.5">
      <BarVisualizer
        mediaStream={stream}
        barCount={14}
        minHeight={8}
        maxHeight={100}
        demo={!stream}
        className="h-[64px] w-full bg-transparent p-0"
      />
    </div>
  );
}
