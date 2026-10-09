import { useEffect, useMemo, useState } from 'react';
import { WheelPicker, WheelPickerWrapper, type WheelPickerOption } from '@ncdai/react-wheel-picker';
import '@ncdai/react-wheel-picker/style.css';
import { Crosshair, Radio } from 'lucide-react';
import { useStore } from '@/store/store';
import { SAMPLE_RATE } from '@/engine/protocol';
import { Drawer, DrawerContent } from '../kit/Drawer';
import { lock, tick } from '../kit/haptics';
import { cn } from '@/lib/utils';

const DIGITS: WheelPickerOption<number>[] = Array.from({ length: 10 }, (_, i) => ({ value: i, label: String(i) }));
const PLACES = [100_000, 10_000, 1_000, 100] as const;

const wheelClass = {
  optionItem: 'text-muted-foreground/70 font-mono tabular-nums',
  highlightWrapper: 'bg-secondary text-foreground font-mono tabular-nums font-semibold rounded-lg',
};

function split(hz: number) {
  const mhz = Math.floor(hz / 1e6);
  let rest = Math.round((hz - mhz * 1e6) / 100) * 100;
  const d = PLACES.map((p) => {
    const v = Math.floor(rest / p);
    rest -= v * p;
    return v;
  });
  return { mhz, d };
}

/**
 * Direct frequency entry without a keyboard: a combination lock of digit
 * wheels (MHz, then 100 kHz down to 100 Hz), each one spinning like a
 * mechanical counter. Entry is clamped to the band the simulator is
 * synthesizing, so you can't dial into dead air. Below it, every signal on
 * the band, one tap to lock onto.
 */
export function TuneSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const centerFreqHz = useStore((s) => s.centerFreqHz);
  const tuningOffsetHz = useStore((s) => s.tuningOffsetHz);
  const setTuning = useStore((s) => s.setTuning);
  const detections = useStore((s) => s.detections);
  const lockOn = useStore((s) => s.lockOn);

  const lo = centerFreqHz - SAMPLE_RATE / 2;
  const hi = centerFreqHz + SAMPLE_RATE / 2;
  const tuned = centerFreqHz + tuningOffsetHz;

  const [mhz, setMhz] = useState(() => split(tuned).mhz);
  const [d, setD] = useState<number[]>(() => split(tuned).d);

  // Re-seed the wheels from the live VFO each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    const s = split(centerFreqHz + useStore.getState().tuningOffsetHz);
    setMhz(s.mhz);
    setD(s.d);
  }, [open, centerFreqHz]);

  const mhzOptions = useMemo<WheelPickerOption<number>[]>(() => {
    const out: WheelPickerOption<number>[] = [];
    for (let m = Math.floor(lo / 1e6); m <= Math.floor(hi / 1e6); m++) out.push({ value: m, label: String(m) });
    return out;
  }, [lo, hi]);

  const dialed = mhz * 1e6 + d.reduce((s, v, i) => s + v * PLACES[i], 0);
  const inBand = dialed >= lo && dialed <= hi;
  const signals = useMemo(() => [...detections].sort((a, b) => a.offsetHz - b.offsetHz), [detections]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        title="Tune"
        description={`This band runs ${(lo / 1e6).toFixed(3)}–${(hi / 1e6).toFixed(3)} MHz.`}
        footer={
          <button
            disabled={!inBand}
            onClick={() => {
              lock();
              setTuning(Math.round(dialed - centerFreqHz));
              onOpenChange(false);
            }}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-[14px] font-semibold text-background transition-[transform,opacity] active:scale-[0.98] disabled:opacity-40"
          >
            <Radio className="size-4" />
            {inBand ? `Tune to ${(dialed / 1e6).toFixed(4)} MHz` : 'Outside this band'}
          </button>
        }
      >
        <div className="px-5">
          <WheelPickerWrapper className="rounded-2xl border border-line bg-card px-1.5">
            <WheelPicker
              options={mhzOptions}
              value={mhz}
              onValueChange={(v) => {
                tick();
                setMhz(v);
              }}
              optionItemHeight={38}
              visibleCount={16}
              classNames={wheelClass}
            />
            <span className="self-center px-0.5 font-mono text-xl font-semibold text-muted-foreground">.</span>
            {PLACES.map((place, i) => (
              <WheelPicker
                key={place}
                options={DIGITS}
                value={d[i]}
                infinite
                onValueChange={(v) => {
                  tick();
                  setD((prev) => prev.map((x, j) => (j === i ? v : x)));
                }}
                optionItemHeight={38}
                visibleCount={16}
                classNames={wheelClass}
              />
            ))}
          </WheelPickerWrapper>
          <div className="mono-feats mt-1.5 flex justify-between px-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            <span className="normal-case">MHz</span>
            <span className="pr-1">100k · 10k · 1k · 100</span>
          </div>
          {!inBand && (
            <p className="mt-2 text-[12px] text-amber-600 dark:text-amber-400">
              Nothing transmits out there in this mission — dial back into {(lo / 1e6).toFixed(3)}–{(hi / 1e6).toFixed(3)} MHz.
            </p>
          )}
        </div>

        <div className="mt-5 border-t border-line">
          <p className="mono-feats px-5 pb-1.5 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            On this band · {signals.length}
          </p>
          {signals.length === 0 ? (
            <p className="px-5 pb-4 text-[12.5px] text-muted-foreground">
              Power on the receiver to start hearing signals here.
            </p>
          ) : (
            signals.map((t) => {
              const here = Math.abs(t.offsetHz - tuningOffsetHz) < Math.max(1500, t.bandwidthHz / 2);
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    lock();
                    lockOn(t);
                    onOpenChange(false);
                  }}
                  className={cn(
                    'flex min-h-12 w-full items-center gap-3 border-t border-line px-5 py-2.5 text-left transition-colors first:border-t-0',
                    here ? 'bg-accent' : 'hover:bg-accent/60',
                  )}
                >
                  <Crosshair className={cn('size-4 shrink-0', here ? 'text-tuned' : 'text-muted-foreground')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-foreground">{t.guessLabel}</span>
                    <span className="mono-feats block font-mono text-[10.5px] text-muted-foreground">
                      {((centerFreqHz + t.offsetHz) / 1e6).toFixed(4)} MHz · {Math.round(t.snrDb)} dB SNR
                    </span>
                  </span>
                  {/* signal strength, as bars */}
                  <span className="flex items-end gap-[2px]" aria-label={`${Math.round(t.snrDb)} dB`}>
                    {[6, 12, 20, 30].map((th, i) => (
                      <span
                        key={th}
                        className={cn('w-[3px] rounded-sm', t.snrDb >= th ? 'bg-foreground' : 'bg-border')}
                        style={{ height: 5 + i * 3 }}
                      />
                    ))}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
