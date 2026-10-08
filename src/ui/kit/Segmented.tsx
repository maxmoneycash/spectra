import { useId, useRef, type ReactNode, type KeyboardEvent } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { tick } from './haptics';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: ReactNode;
  /** Accessible name when the label is an icon or a short glyph. */
  aria?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

/**
 * An iOS-grade segmented control: a raised thumb springs between options,
 * each change ticks the haptics, arrow keys move the selection. Built as a
 * radiogroup so screen readers announce it as a single choice.
 */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  size = 'md',
  className,
  label,
  stretch = true,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Accessible name for the whole group. */
  label: string;
  /** Equal-width segments filling the container. */
  stretch?: boolean;
}) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (v: T) => {
    if (v === value) return;
    tick();
    onChange(v);
  };

  const onKey = (e: KeyboardEvent, i: number) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    for (let step = 1; step <= options.length; step++) {
      const j = (i + dir * step + options.length) % options.length;
      if (!options[j].disabled) {
        select(options[j].value);
        refs.current[j]?.focus();
        return;
      }
    }
  };

  const h = size === 'sm' ? 'h-8' : size === 'lg' ? 'h-11' : 'h-10';
  const text = size === 'sm' ? 'text-[11.5px]' : 'text-[12.5px]';

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'relative isolate flex rounded-[11px] border border-line bg-secondary/70 p-[3px]',
        !stretch && 'inline-flex',
        className,
      )}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.aria}
            tabIndex={active ? 0 : -1}
            disabled={o.disabled}
            onClick={() => select(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'relative flex select-none items-center justify-center gap-1.5 rounded-[8px] px-3 font-medium outline-none transition-colors duration-200',
              'focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-40',
              stretch && 'flex-1',
              h,
              text,
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-thumb-${id}`}
                aria-hidden
                transition={{ type: 'spring', stiffness: 520, damping: 40, mass: 0.7 }}
                className="absolute inset-0 -z-10 rounded-[8px] bg-background shadow-[0_1px_2px_rgba(0,0,0,0.08),0_2px_8px_-2px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.04] dark:bg-zinc-800 dark:ring-white/[0.06]"
              />
            )}
            {o.icon}
            <span className="whitespace-nowrap">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
