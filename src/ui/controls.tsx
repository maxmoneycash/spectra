import type { ReactNode, MouseEvent } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

/**
 * The app's icon button, in the two shapes the UI actually needs.
 *
 * - `ghost` — dense toolbars (the top bar), no chrome until hover.
 * - `outline` — floating over content (reel header, stage controls): a bordered
 *   pill with a translucent, blurred backing so it stays legible on any pixels.
 *
 * Both keep a 44px touch target on phones and tighten under a cursor.
 */
export function IconButton({
  label,
  onClick,
  children,
  variant = 'ghost',
  active,
  disabled,
  className,
}: {
  label: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
  variant?: 'ghost' | 'outline';
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.94 }}
      className={cn(
        'relative grid shrink-0 place-items-center transition-colors',
        'focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40',
        '[&_svg]:size-4',
        variant === 'ghost' && [
          'size-11 rounded-lg text-muted-foreground sm:size-8',
          'hover:bg-accent hover:text-foreground',
          active && 'bg-accent text-foreground',
        ],
        variant === 'outline' && [
          'size-10 rounded-full border backdrop-blur',
          active
            ? 'border-foreground bg-foreground text-background'
            : 'border-line bg-background/65 text-foreground/85 hover:text-foreground',
        ],
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Small count rendered as a superscript, e.g. detected stations. */
  badge?: number;
}

/**
 * The app's tab strip: a sliding underline shared by the top bar, the console
 * rail and the Academy. `layoutId` must be unique per mounted strip, otherwise
 * two strips animate into each other.
 */
export function UnderlineTabs<T extends string>({
  items,
  value,
  onChange,
  layoutId,
  ariaLabel,
  className,
  /** Phones need a 44px row; dense desktop chrome doesn't. */
  touch = false,
}: {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  layoutId: string;
  ariaLabel: string;
  className?: string;
  touch?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-4', className)} role="tablist" aria-label={ariaLabel}>
      {items.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              'relative flex shrink-0 items-center text-[12.5px] transition-colors',
              touch ? 'min-h-11 sm:min-h-0 sm:py-2' : 'py-2',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <sup className="mono-feats ml-1 font-mono text-[9px] text-muted-foreground">
                {t.badge}
              </sup>
            )}
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-x-0 -bottom-[1px] h-px bg-foreground"
                transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Micro caption used above control groups and inside sheets. */
export function GroupLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'mono-feats font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}
