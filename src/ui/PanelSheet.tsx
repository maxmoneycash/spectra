import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../store/store';
import { RailTabs, PanelView } from './RailTabs';

/**
 * Bottom sheet hosting the panels on small screens (rail hidden < 1024px).
 * Spring entrance, drag-to-dismiss with velocity handoff, scrim + Esc close.
 */
export function PanelSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panel = useStore((s) => s.panel);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="sheet-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Panels"
            initial={{ y: '102%' }}
            animate={{ y: 0 }}
            exit={{ y: '102%' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 110 || info.velocity.y > 550) onClose();
            }}
          >
            <div className="sheet-grab">
              <div className="sheet-handle" />
            </div>
            <div className="sheet-tabs">
              <RailTabs pillId="sheet-pill" />
            </div>
            <div className="sheet-body">
              <PanelView panel={panel} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
