import { useStore } from '../store/store';
import { RailTabs, PanelView } from './RailTabs';
import { BottomSheet } from './BottomSheet';

/**
 * Console panels on small screens (the rail is hidden below lg), in the same
 * bottom sheet the reels use.
 */
export function PanelSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panel = useStore((s) => s.panel);

  return (
    <BottomSheet open={open} onClose={onClose} title="Panels">
      <div className="sticky top-0 z-10 border-b border-line bg-card px-3 pb-1 pt-1">
        <RailTabs lineId="sheet-line" />
      </div>
      <div className="p-3">
        <PanelView panel={panel} />
      </div>
    </BottomSheet>
  );
}
