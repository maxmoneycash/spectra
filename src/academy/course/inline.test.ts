import { describe, it, expect } from 'vitest';
import { parseInline } from './inline';

const KEYS = new Set(['voltage', 'swr', 'ac', 'impedance']);

describe('parseInline', () => {
  it('passes plain text through, coalesced', () => {
    expect(parseInline('hello world', KEYS)).toEqual([{ t: 'text', text: 'hello world' }]);
  });

  it('parses strong / em / var / nowrap styles', () => {
    expect(parseInline('a <strong>bold</strong> b', KEYS)).toEqual([
      { t: 'text', text: 'a ' },
      { t: 'strong', text: 'bold' },
      { t: 'text', text: ' b' },
    ]);
    expect(parseInline('<em>x</em>', KEYS)).toEqual([{ t: 'em', text: 'x' }]);
    expect(parseInline('<var>V</var>', KEYS)).toEqual([{ t: 'var', text: 'V' }]);
    expect(parseInline('<nowrap>2.5 div</nowrap>', KEYS)).toEqual([{ t: 'nowrap', text: '2.5 div' }]);
  });

  it('parses glossary tags using the key set', () => {
    expect(parseInline('the <voltage>voltage</voltage> drop', KEYS)).toEqual([
      { t: 'text', text: 'the ' },
      { t: 'gloss', text: 'voltage', key: 'voltage' },
      { t: 'text', text: ' drop' },
    ]);
    expect(parseInline('<swr>SWR</swr> meter', KEYS)).toEqual([
      { t: 'gloss', text: 'SWR', key: 'swr' },
      { t: 'text', text: ' meter' },
    ]);
  });

  it('parses self-closing G refs', () => {
    expect(parseInline('see <G k="impedance" /> here', KEYS)).toEqual([
      { t: 'text', text: 'see ' },
      { t: 'gloss', text: 'impedance', key: 'impedance' },
      { t: 'text', text: ' here' },
    ]);
  });

  it('unwraps unknown tags but keeps their content', () => {
    expect(parseInline('<bw><strong>Bandwidth</strong></bw>', KEYS)).toEqual([
      { t: 'strong', text: 'Bandwidth' },
    ]);
  });

  it('treats a stray < as literal text', () => {
    expect(parseInline('gain < 10 dB', KEYS)).toEqual([{ t: 'text', text: 'gain < 10 dB' }]);
  });
});
