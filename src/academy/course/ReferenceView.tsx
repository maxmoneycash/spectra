import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useCourseData } from './useCourseData';
import { WIDGETS, PLAYGROUND } from '../widgets/registry';
import { cn } from '@/lib/utils';

export function ReferenceView() {
  const data = useCourseData();
  const [query, setQuery] = useState('');

  const terms = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return Object.entries(data.GLOSSARY)
      .filter(([key, e]) => {
        if (!q) return true;
        return (
          key.toLowerCase().includes(q) ||
          e.tip.toLowerCase().includes(q) ||
          e.detail.toLowerCase().includes(q)
        );
      })
      .sort(([a], [b]) => a.localeCompare(b));
  }, [data, query]);

  if (!data) {
    return (
      <div className="grid place-items-center py-24 text-[12px] text-muted-foreground">
        Loading the reference…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      {/* Glossary */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium tracking-tight text-foreground">Glossary</h2>
        <span className="mono-feats font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
          {terms.length} terms
        </span>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search terms, e.g. swr, impedance, decibel…"
          className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-[12.5px] text-foreground placeholder:text-muted-foreground focus:outline-2 focus:outline-ring"
          aria-label="Search glossary"
        />
      </div>
      {terms.length === 0 ? (
        <p className="py-10 text-center text-[12px] text-muted-foreground">
          Nothing matches “{query}”.
        </p>
      ) : (
        <div className="divide-y divide-border border-y border-line">
          {terms.map(([key, e]) => (
            <details key={key} className="group py-2.5">
              <summary className="flex cursor-pointer list-none items-baseline gap-2.5 [&::-webkit-details-marker]:hidden">
                <span className="mono-feats shrink-0 font-mono text-[11.5px] font-medium text-foreground">
                  {key}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted-foreground">
                  {e.tip}
                </span>
                <span className="mono-feats shrink-0 font-mono text-[9px] text-muted-foreground transition-transform group-open:rotate-90">
                  ›
                </span>
              </summary>
              <div className="mt-2 rounded-lg border border-line bg-card p-3 text-[12px] leading-relaxed text-muted-foreground">
                {e.detail}
                {(e.unit || e.formula) && (
                  <div className="mono-feats mt-2 flex flex-wrap gap-x-4 font-mono text-[10.5px] text-foreground">
                    {e.unit && <span>unit: {e.unit}</span>}
                    {e.formula && <span>{e.formula}</span>}
                  </div>
                )}
                {e.see && e.see.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {e.see.map((s) => (
                      <button
                        key={s}
                        onClick={() => setQuery(s)}
                        className={cn(
                          'mono-feats rounded border border-border px-1.5 py-0.5 font-mono text-[9.5px] text-muted-foreground',
                          'transition-colors hover:border-foreground hover:text-foreground',
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      )}

      {/* Playground */}
      <div className="mb-4 mt-10 flex items-center justify-between">
        <h2 className="text-lg font-medium tracking-tight text-foreground">Playground</h2>
        <span className="mono-feats font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
          {PLAYGROUND.length} interactives
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PLAYGROUND.map((id) => {
          const W = WIDGETS[id];
          return W ? <W key={id} /> : null;
        })}
      </div>
    </div>
  );
}
