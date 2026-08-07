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

/** Micro caption used above control groups and inside sheets. */
export function GroupLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'mono-feats font-mono text-[10px] uppercase tracking-wider text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}
