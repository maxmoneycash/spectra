import { useEffect, useState } from 'react';
import { TextMorph } from 'torph/react';

/**
 * A number that rolls by place value when it changes (Torph, MIT).
 * `from` lets a value count up on mount — e.g. a score revealing itself —
 * instead of appearing already settled. Reduced-motion users get the plain
 * value with no roll.
 */
export function Roll({
  value,
  from,
  className,
  delayMs = 140,
}: {
  value: number;
  from?: number;
  className?: string;
  delayMs?: number;
}) {
  const [shown, setShown] = useState(from ?? value);
  useEffect(() => {
    if (from === undefined) {
      setShown(value);
      return;
    }
    const t = window.setTimeout(() => setShown(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, from, delayMs]);
  return (
    <TextMorph
      as="span"
      numbers
      respectReducedMotion
      ease={{ stiffness: 190, damping: 24 }}
      className={className}
    >
      {String(shown)}
    </TextMorph>
  );
}
