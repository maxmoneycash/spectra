import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

/**
 * The app's one bottom sheet: spring entry, grabber, drag-to-dismiss.
 * Used by both the reels filter and the console panels so the two read as the
 * same surface rather than two lookalikes.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  /** Sheet height as a share of the viewport. */
  height = '78dvh',
  /** `fixed` covers the viewport; `absolute` scopes it to a positioned parent. */
  position = 'fixed',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  height?: string;
  position?: 'fixed' | 'absolute';
}) {
  // Escape closes; the page behind must not scroll while it's up.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const layer = position === 'fixed' ? 'fixed' : 'absolute';

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            aria-label={`Close ${title}`}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={`${layer} inset-0 z-40 bg-background/70 backdrop-blur-sm`}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 620) onClose();
            }}
            style={{ height }}
            className={`${layer} inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl border-t border-line bg-card shadow-2xl`}
          >
            {/* grabber */}
            <div className="flex shrink-0 cursor-grab justify-center pt-2.5 active:cursor-grabbing">
              <span className="h-1 w-9 rounded-full bg-border" aria-hidden />
            </div>

            <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-2.5">
              <p className="mono-feats font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {title}
              </p>
              <button
                onClick={onClose}
                aria-label="Close"
                className="grid size-9 place-items-center rounded-full border border-line text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>

            {footer && (
              <div
                className="shrink-0 border-t border-line px-3 pt-3"
                style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
