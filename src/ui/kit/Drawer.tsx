import type { ComponentProps, ReactNode } from 'react';
import { Drawer as V } from 'vaul';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Bottom sheet on Vaul: velocity-aware flick-to-close, rubber-banding,
 * background scaling, and snap points when asked. This is the sheet the app
 * uses for anything that slides up over the instrument.
 */
export function Drawer(props: ComponentProps<typeof V.Root>) {
  return <V.Root shouldScaleBackground={false} {...props} />;
}

export function DrawerContent({
  title,
  description,
  children,
  className,
  footer,
  hideTitle,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  /** Keep the title for screen readers but don't draw the header row. */
  hideTitle?: boolean;
}) {
  return (
    <V.Portal>
      <V.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] dark:bg-black/60" />
      <V.Content
        aria-describedby={description ? undefined : undefined}
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-[22px] border-t border-line bg-background outline-none',
          'shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.45)]',
          className,
        )}
      >
        <V.Handle className="!mt-2.5 !h-[5px] !w-10 !rounded-full !bg-border" />
        <div className={cn('flex items-start gap-3 px-5 pb-2 pt-3', hideTitle && 'sr-only')}>
          <div className="min-w-0 flex-1">
            <V.Title className="text-[16px] font-semibold tracking-tight text-foreground">{title}</V.Title>
            {description ? (
              <V.Description className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{description}</V.Description>
            ) : (
              <V.Description className="sr-only">{title}</V.Description>
            )}
          </div>
          <V.Close
            aria-label="Close"
            className="-mr-1.5 grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-[18px]" />
          </V.Close>
        </div>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="border-t border-line px-5 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">{footer}</div>}
        {!footer && <div className="h-[env(safe-area-inset-bottom)]" />}
      </V.Content>
    </V.Portal>
  );
}
