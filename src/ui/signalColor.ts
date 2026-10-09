import { familyOf, type SignalKind } from '../sim/signal-kinds';
import { THEME } from './theme';

/**
 * A signal's family color. Color carries the family (voice & broadcast,
 * keyed & data, spread & radar); the kind's name is always shown beside it,
 * so color never has to identify a signal on its own.
 */

/** For HTML: a CSS variable that follows the theme. */
export function familyColor(kind: SignalKind): string {
  return `var(--sig-${familyOf(kind)})`;
}

/** For canvas: the hex for the current theme. */
export function familyHex(kind: SignalKind): string {
  return THEME.sig[familyOf(kind)];
}
