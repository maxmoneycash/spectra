import { useState } from 'react';
import type { InlineMark, GlossaryMap } from './types';
import { cn } from '@/lib/utils';

function GlossLink({
  mark,
  glossary,
  onOpen,
}: {
  mark: Extract<InlineMark, { t: 'gloss' }>;
  glossary: GlossaryMap | null;
  onOpen?: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const entry = glossary?.[mark.key];

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => (onOpen ? onOpen(mark.key) : setOpen((o) => !o))}
        onMouseEnter={() => !onOpen && setOpen(true)}
        onMouseLeave={() => !onOpen && setOpen(false)}
        className={cn(
          'cursor-help border-b border-dashed border-muted-foreground/60 text-foreground',
          'transition-colors hover:border-foreground',
        )}
      >
        {mark.text}
      </button>
      {open && entry && !onOpen && (
        <span className="absolute bottom-full left-0 z-40 mb-1.5 w-64 rounded-lg border border-border bg-popover p-3 text-left shadow-xl">
          <span className="block text-[11px] font-medium text-foreground">{mark.key}</span>
          <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
            {entry.tip}
          </span>
        </span>
      )}
    </span>
  );
}

/** Renders converted inline marks: bold, italic, math vars, glossary links. */
export function RichText({
  marks,
  glossary,
  onOpenGlossary,
  className,
}: {
  marks: InlineMark[] | null;
  glossary?: GlossaryMap | null;
  onOpenGlossary?: (key: string) => void;
  className?: string;
}) {
  if (!marks) return null;
  return (
    <span className={className}>
      {marks.map((m, i) => {
        switch (m.t) {
          case 'text':
            return <span key={i}>{m.text}</span>;
          case 'strong':
            return (
              <strong key={i} className="font-semibold text-foreground">
                {m.text}
              </strong>
            );
          case 'em':
            return <em key={i}>{m.text}</em>;
          case 'var':
            return (
              <code key={i} className="mono-feats font-mono text-[0.92em] italic">
                {m.text}
              </code>
            );
          case 'nowrap':
            return (
              <span key={i} className="whitespace-nowrap">
                {m.text}
              </span>
            );
          case 'gloss':
            return (
              <GlossLink key={i} mark={m} glossary={glossary ?? null} onOpen={onOpenGlossary} />
            );
        }
      })}
    </span>
  );
}
