import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import technician from './pools/technician.gen';
import general from './pools/general.gen';
import extra from './pools/extra.gen';
import type { PoolQuestion } from './types';

/**
 * Every question in every pool has both narration clips committed and listed,
 * in the voice we ship. Two things once went wrong silently: the renderer
 * truncated a manifest to the slice a `--limit` run covered, and a stray `say`
 * render wrote 257 clips in the old voice into a pool folder. Either would
 * have deployed without a test noticing. This is the feature Max studies with.
 */
const ROOT = join(process.cwd(), 'public', 'exam', 'audio');
const POOLS: Record<string, PoolQuestion[]> = { technician, general, extra };

interface Entry {
  hash: string;
  bytes: number;
  dur: number;
}
interface Manifest {
  version: number;
  engine: string;
  voice: string;
  items: Record<string, { q?: Entry; a?: Entry }>;
}

describe.each(Object.keys(POOLS))('narration: %s', (pool) => {
  const m: Manifest = JSON.parse(readFileSync(join(ROOT, pool, 'manifest.json'), 'utf8'));
  const ids = POOLS[pool].map((q) => q.id);

  it('is the Kokoro voice, not a stray render', () => {
    expect(m.engine).toBe('kokoro');
    expect(m.voice).toBe('af_heart');
  });

  it("lists exactly the pool's questions — nothing missing, nothing stale", () => {
    expect(Object.keys(m.items).sort()).toEqual([...ids].sort());
  });

  it('has a question clip and an answer clip on disk for every question, at the listed size', () => {
    const bad: string[] = [];
    for (const id of ids) {
      const v = m.items[id];
      for (const part of ['q', 'a'] as const) {
        const e = v?.[part];
        const file = join(ROOT, pool, `${id}.${part}.m4a`);
        let ok = false;
        try {
          ok = !!e && e.dur > 0 && statSync(file).size === e.bytes;
        } catch {
          ok = false;
        }
        if (!ok) bad.push(`${id}.${part}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
