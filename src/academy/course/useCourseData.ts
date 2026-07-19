import { useEffect, useState } from 'react';
import type { Chapter, GlossaryMap } from './types';

interface CourseData {
  PARTS: Record<number, string>;
  CHAPTERS: Chapter[];
  GLOSSARY: GlossaryMap;
}

let cache: CourseData | null = null;
let inflight: Promise<CourseData> | null = null;

/**
 * Loads the generated course + glossary data on demand (code-split chunk,
 * ~1.3 MB — kept out of the initial bundle).
 */
export function useCourseData(): CourseData | null {
  const [data, setData] = useState<CourseData | null>(cache);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    inflight ??= Promise.all([import('./course.gen'), import('./glossary.gen')]).then(
      ([c, g]) => {
        cache = { PARTS: c.PARTS, CHAPTERS: c.CHAPTERS, GLOSSARY: g.GLOSSARY };
        return cache;
      },
    );
    void inflight.then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, []);

  return data;
}
