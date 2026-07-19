import { useStore } from '../store/store';
import { RailTabs, PanelView } from './RailTabs';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

/**
 * Panels on small screens (rail hidden < lg) as a shadcn bottom sheet:
 * Radix focus trap, scrim, animated slide — replacing the hand-rolled one.
 */
export function PanelSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panel = useStore((s) => s.panel);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="flex h-[76dvh] flex-col gap-0 rounded-t-2xl border-line p-0"
        aria-label="Panels"
      >
        <SheetTitle className="sr-only">Panels</SheetTitle>
        <div className="border-b border-line px-3 pt-1">
          <RailTabs lineId="sheet-line" />
        </div>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-3">
          <PanelView panel={panel} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
