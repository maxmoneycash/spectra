import type { RefObject } from 'react';
import { useStore } from '../store/store';
import { COLORMAPS } from './colormaps';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

function CtlBtn({
  label,
  onClick,
  title,
  active,
}: {
  label: string;
  onClick?: () => void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        'mono-feats rounded-md px-2 py-1 font-mono text-[10px] text-stage-muted transition-colors hover:bg-white/10 hover:text-stage-foreground',
        active && 'bg-white/10 text-stage-foreground',
      )}
    >
      {label}
    </button>
  );
}

/** Floating display controls on the stage: zoom, colormap, auto-level, dB range. */
export function WaterfallControls({
  onAuto,
  zoomLabelRef,
}: {
  onAuto: () => void;
  zoomLabelRef: RefObject<HTMLDivElement>;
}) {
  const cmapIndex = useStore((s) => s.cmapIndex);
  const setCmap = useStore((s) => s.setCmap);
  const floorDb = useStore((s) => s.floorDb);
  const ceilDb = useStore((s) => s.ceilDb);
  const setDbRange = useStore((s) => s.setDbRange);

  return (
    <div
      className="absolute bottom-3 right-3 z-[10] flex items-center gap-0.5 rounded-lg border border-stage-border bg-stage/85 p-1 shadow-lg backdrop-blur-md"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        ref={zoomLabelRef}
        className="mono-feats min-w-6 text-center font-mono text-[9.5px] text-stage-foreground"
      />
      <CtlBtn
        label={COLORMAPS[cmapIndex].name}
        title="Cycle colormap"
        onClick={() => setCmap((cmapIndex + 1) % COLORMAPS.length)}
      />
      <CtlBtn label="Auto" title="Auto-level the dB range" onClick={onAuto} />
      <Popover>
        <PopoverTrigger asChild>
          <button
            title="Waterfall dB floor / ceiling"
            className="mono-feats rounded-md px-2 py-1 font-mono text-[10px] text-stage-muted transition-colors hover:bg-white/10 hover:text-stage-foreground"
          >
            Levels
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" side="top" className="w-56 p-3.5">
          <div className="space-y-3.5">
            <div>
              <div className="mono-feats mb-1.5 flex justify-between font-mono text-[10px]">
                <span className="text-muted-foreground">Floor</span>
                <span>{floorDb} dB</span>
              </div>
              <Slider
                value={[floorDb]}
                min={-120}
                max={ceilDb - 5}
                step={1}
                onValueChange={([v]) => setDbRange(v, ceilDb)}
              />
            </div>
            <div>
              <div className="mono-feats mb-1.5 flex justify-between font-mono text-[10px]">
                <span className="text-muted-foreground">Ceiling</span>
                <span>{ceilDb} dB</span>
              </div>
              <Slider
                value={[ceilDb]}
                min={floorDb + 5}
                max={0}
                step={1}
                onValueChange={([v]) => setDbRange(floorDb, v)}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
