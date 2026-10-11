import { Star } from 'lucide-react';

/** Opening GitHub leaves the choice to star with the visitor. */
export function StarLink() {
  return (
    <a
      href="https://github.com/maxmoneycash/spectra"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      <Star className="size-3.5" />
      Star on GitHub
    </a>
  );
}
