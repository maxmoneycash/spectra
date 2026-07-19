import type { InlineMark } from './types';

const STYLES = new Set(['strong', 'em', 'var', 'nowrap']);

/**
 * Parses The Radio Bench's inline markup into render marks:
 * <strong>, <em>, <var>, <nowrap>, <glossary-key>…</glossary-key>, <G k="key" />.
 */
export function parseInline(text: string, glossKeys: Set<string>): InlineMark[] {
  const out: InlineMark[] = [];
  let i = 0;
  const push = (t: InlineMark['t'], s: string, key?: string) => {
    if (!s) return;
    const last = out[out.length - 1];
    if (t === 'text' && last && last.t === 'text') {
      (last as { text: string }).text += s;
    } else {
      out.push(key ? ({ t: 'gloss', text: s, key } as InlineMark) : ({ t, text: s } as InlineMark));
    }
  };

  while (i < text.length) {
    const lt = text.indexOf('<', i);
    if (lt === -1) {
      push('text', text.slice(i));
      break;
    }
    push('text', text.slice(i, lt));

    const gSelf = text.slice(lt).match(/^<G k="([^"]+)"\s*\/>/);
    if (gSelf) {
      push('gloss', gSelf[1], gSelf[1]);
      i = lt + gSelf[0].length;
      continue;
    }

    const open = text.slice(lt).match(/^<([a-z][a-zA-Z0-9-]*)>/);
    if (open) {
      const tag = open[1];
      const close = `</${tag}>`;
      const end = text.indexOf(close, lt);
      if (end !== -1) {
        const inner = text.slice(lt + open[0].length, end);
        if (STYLES.has(tag)) {
          for (const p of parseInline(inner, glossKeys)) {
            if (p.t === 'text') push(tag as InlineMark['t'], p.text);
            else out.push(p);
          }
        } else if (glossKeys.has(tag)) {
          push('gloss', inner.replace(/<[^>]+>/g, ''), tag);
        } else {
          out.push(...parseInline(inner, glossKeys));
        }
        i = end + close.length;
        continue;
      }
    }
    push('text', '<');
    i = lt + 1;
  }
  return out;
}
