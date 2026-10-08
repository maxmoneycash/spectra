import { motion } from 'motion/react';
import { useStore } from '@/store/store';
import { cn } from '@/lib/utils';
import { tick } from '../kit/haptics';
import { NAV } from './nav';

/**
 * Phone navigation, where the thumb already is. Each tab is a full-height
 * target; the active one gets a raised pill that springs between tabs, and
 * switching ticks the haptics. Hidden at lg+, where the header carries tabs.
 */
export function BottomNav() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const running = useStore((s) => s.running);
  const detections = useStore((s) => s.detections.length);

  return (
    <nav
      aria-label="Sections"
      className="relative z-40 border-t border-line bg-background/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 lg:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-4 px-2" role="tablist">
        {NAV.map((n) => {
          const active = view === n.id;
          const Icon = n.icon;
          const badge = n.id === 'console' && running && detections > 0 ? detections : 0;
          return (
            <button
              key={n.id}
              role="tab"
              aria-selected={active}
              aria-label={n.label}
              onClick={() => {
                if (!active) tick();
                setView(n.id);
              }}
              className="relative flex h-[58px] flex-col items-center justify-center gap-1 outline-none focus-visible:bg-accent/60"
            >
              <span className="relative grid h-7 w-14 place-items-center">
                {active && (
                  <motion.span
                    layoutId="bottomnav-pill"
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-secondary ring-1 ring-line"
                    transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                  />
                )}
                <Icon
                  className={cn(
                    'relative size-[19px] transition-colors duration-200',
                    active ? 'text-foreground' : 'text-muted-foreground',
                  )}
                  strokeWidth={active ? 2.1 : 1.75}
                />
                {badge > 0 && (
                  <span className="mono-feats absolute -right-0.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-foreground px-1 font-mono text-[9px] font-semibold text-background">
                    {badge}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  'text-[10.5px] font-medium tracking-tight transition-colors duration-200',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {n.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
