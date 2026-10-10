import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { FolderOpen, Play, Square } from 'lucide-react';
import { useStore } from '../store/store';
import {
  CAPTURE_MAX_SEC,
  CAPTURE_RATE_MAX,
  CAPTURE_RATE_MIN,
  DATATYPES,
  bytesPerSample,
  datatypeFromName,
  parseSigMFMeta,
  type CaptureDatatype,
  type CaptureMeta,
} from '../capture/decode';
import { BottomSheet } from '@/ui/BottomSheet';
import { GroupLabel } from '@/ui/controls';
import { tick } from '@/ui/kit/haptics';
import { cn } from '@/lib/utils';

const FIELD =
  'mono-feats min-h-11 w-full rounded-lg border border-border bg-background px-3 font-mono text-[13px] text-foreground outline-none focus:border-ring';
const PRIMARY =
  'inline-flex min-h-11 items-center gap-2 rounded-lg border border-foreground bg-foreground px-3.5 text-[12px] font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-40 sm:min-h-10';
const SECONDARY =
  'inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground sm:min-h-10';

const isMeta = (f: File) => /\.sigmf-meta$/i.test(f.name) || /\.json$/i.test(f.name);

/**
 * Load a capture: a `.sigmf-data` + `.sigmf-meta` pair fills the fields
 * itself; a bare cf32 / cs16 / cu8 file asks for the three facts playback
 * needs. Files never leave the browser.
 */
export function CaptureSheet() {
  const open = useStore((s) => s.captureSheetOpen);
  const setOpen = useStore((s) => s.setCaptureSheetOpen);
  const dropped = useStore((s) => s.captureDrop);
  const setDropped = useStore((s) => s.setCaptureDrop);
  const capture = useStore((s) => s.capture);
  const loadCapture = useStore((s) => s.loadCapture);
  const stopCapture = useStore((s) => s.stopCapture);
  const setView = useStore((s) => s.setView);

  const [data, setData] = useState<File | null>(null);
  const [metaFile, setMetaFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<CaptureMeta | null>(null);
  const [rateMsps, setRateMsps] = useState('2.400');
  const [centerMhz, setCenterMhz] = useState('98.500');
  const [datatype, setDatatype] = useState<CaptureDatatype>('cf32_le');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Sort whatever arrived (picker or drop) into data + meta. */
  const take = (files: File[]) => {
    setError(null);
    const m = files.find(isMeta) ?? null;
    const d = files.find((f) => !isMeta(f)) ?? null;
    if (m) setMetaFile(m);
    if (d) {
      setData(d);
      const dt = datatypeFromName(d.name);
      if (dt) setDatatype(dt);
    }
  };

  useEffect(() => {
    if (dropped?.length) {
      take(dropped);
      setDropped(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropped]);

  // A meta file, when present, is the source of truth for the fields.
  useEffect(() => {
    if (!metaFile) {
      setMeta(null);
      return;
    }
    let live = true;
    void metaFile.text().then((t) => {
      if (!live) return;
      const m = parseSigMFMeta(t);
      if (!m) {
        setError('That meta file has no usable core:sample_rate / core:datatype.');
        setMeta(null);
        return;
      }
      setMeta(m);
      setRateMsps((m.sampleRate / 1e6).toFixed(3));
      setDatatype(m.datatype);
      if (m.centerFreqHz) setCenterMhz((m.centerFreqHz / 1e6).toFixed(3));
    });
    return () => {
      live = false;
    };
  }, [metaFile]);

  const rate = Math.round(parseFloat(rateMsps) * 1e6);
  const center = Math.round(parseFloat(centerMhz) * 1e6);
  const rateOk = Number.isFinite(rate) && rate >= CAPTURE_RATE_MIN && rate <= CAPTURE_RATE_MAX;
  const centerOk = Number.isFinite(center) && center > 0;

  const lengthSec = useMemo(() => {
    if (!data || !Number.isFinite(rate) || rate <= 0) return null;
    return data.size / bytesPerSample(datatype) / rate;
  }, [data, rate, datatype]);

  const play = async () => {
    if (!data || !rateOk || !centerOk) return;
    tick();
    setBusy(true);
    setError(null);
    try {
      await loadCapture(data, { sampleRate: rate, datatype, centerFreqHz: center, description: meta?.description });
      // A file you chose yourself belongs on the receiver; a mission's capture stays with its brief.
      setView('console');
      setData(null);
      setMetaFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open that file.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={() => setOpen(false)} title="Load capture">
      <div className="space-y-4 px-4 pb-4">
        {capture && (
          <div className="rounded-lg border border-line bg-card p-3">
            <GroupLabel>Playing</GroupLabel>
            <p className="mono-feats mt-1 truncate font-mono text-[12px] text-foreground">{capture.name}</p>
            <p className="mono-feats mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {(capture.sampleRate / 1e6).toFixed(3)} MSPS · {(capture.centerFreqHz / 1e6).toFixed(3)} MHz ·{' '}
              {Math.round(capture.totalSec)} s loop
            </p>
            <button className={cn(SECONDARY, 'mt-3')} onClick={() => { tick(); stopCapture(); setOpen(false); }}>
              <Square className="size-4" /> Stop capture, back to the simulator
            </button>
          </div>
        )}

        <div>
          <GroupLabel>File</GroupLabel>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".sigmf-data,.sigmf-meta,.cf32,.fc32,.cs16,.ci16,.cu8,.iq,.raw,.json"
            className="hidden"
            onChange={(e) => take([...(e.target.files ?? [])])}
          />
          <button className={cn(SECONDARY, 'mt-2 w-full justify-center')} onClick={() => inputRef.current?.click()}>
            <FolderOpen className="size-4" /> Choose .sigmf-data + .sigmf-meta, or a raw I/Q file
          </button>
          <p className="mono-feats mt-2 font-mono text-[10px] text-muted-foreground">
            {data ? `${data.name} · ${(data.size / 1e6).toFixed(1)} MB` : 'No data file yet'}
            {metaFile ? ` · ${metaFile.name}` : ''}
          </p>
          {lengthSec !== null && (
            <p className="mono-feats mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {lengthSec.toFixed(1)} s at this rate
              {lengthSec > CAPTURE_MAX_SEC ? ` · first ${CAPTURE_MAX_SEC} s will loop` : ''}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <GroupLabel>Centre, MHz</GroupLabel>
            <input
              className={cn(FIELD, 'mt-1.5', !centerOk && 'border-destructive/60')}
              inputMode="decimal"
              value={centerMhz}
              onChange={(e) => setCenterMhz(e.target.value)}
              disabled={!!meta?.centerFreqHz}
            />
          </label>
          <label className="block">
            <GroupLabel>Rate, MSPS</GroupLabel>
            <input
              className={cn(FIELD, 'mt-1.5', !rateOk && 'border-destructive/60')}
              inputMode="decimal"
              value={rateMsps}
              onChange={(e) => setRateMsps(e.target.value)}
              disabled={!!meta}
            />
          </label>
        </div>
        {!rateOk && (
          <p className="text-[12px] text-muted-foreground">
            Rates from {CAPTURE_RATE_MIN / 1e6} to {CAPTURE_RATE_MAX / 1e6} MSPS are resampled to the receiver&rsquo;s{' '}
            1.152. Faster captures need decimating first.
          </p>
        )}

        <div>
          <GroupLabel>Sample format</GroupLabel>
          <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg border border-line p-1">
            {DATATYPES.map((d) => (
              <button
                key={d.id}
                disabled={!!meta}
                onClick={() => setDatatype(d.id)}
                className={cn(
                  'min-h-10 rounded-md text-[12px] font-medium transition-colors disabled:opacity-60',
                  datatype === d.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {d.label}
                <span className="mono-feats block font-mono text-[9px] font-normal uppercase tracking-wider opacity-70">
                  {d.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-[12px] text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <button className={PRIMARY} disabled={!data || !rateOk || !centerOk || busy} onClick={() => void play()}>
            <Play className="size-4" /> {busy ? 'Opening…' : 'Play capture'}
          </button>
        </div>
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          Everything the receiver does to the simulator — waterfall, detection, classification, decoding, scanning — runs
          on the file. There is no answer key for a capture, so the signal card reports what it sees and nothing is
          graded. The file stays in your browser.
        </p>
      </div>
    </BottomSheet>
  );
}

/** Wraps the stage so a file dropped on the waterfall opens the sheet, prefilled. */
export function CaptureDropZone({ className, children }: { className?: string; children: ReactNode }) {
  const setDropped = useStore((s) => s.setCaptureDrop);
  const setOpen = useStore((s) => s.setCaptureSheetOpen);
  const [over, setOver] = useState(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const files = [...e.dataTransfer.files];
    if (!files.length) return;
    setDropped(files);
    setOpen(true);
  };
  return (
    <div
      className={className}
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes('Files')) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      {children}
      {over && (
        <div className="pointer-events-none absolute inset-0 z-50 grid place-items-center bg-background/60 backdrop-blur-sm">
          <p className="mono-feats rounded-lg border border-foreground px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground">
            Drop capture to play it
          </p>
        </div>
      )}
    </div>
  );
}
