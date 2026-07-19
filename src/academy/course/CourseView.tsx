import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronLeft, ChevronRight, FlaskConical, Play, RotateCcw } from 'lucide-react';
import { useStore } from '../../store/store';
import { useCourseData } from './useCourseData';
import { RichText } from './RichText';
import { WIDGETS, CHAPTER_WIDGETS } from '../widgets/registry';
import type { Chapter, GlossaryMap } from './types';
import { cn } from '@/lib/utils';

/* ---------------- progress ---------------- */

type Progress = Record<string, { best: number; total: number; done: boolean }>;
const PKEY = 'spectra.course.v1';

function loadProgress(): Progress {
  try {
    return JSON.parse(localStorage.getItem(PKEY) || '{}');
  } catch {
    return {};
  }
}

function useCourseProgress() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const save = (next: Progress) => {
    setProgress(next);
    try {
      localStorage.setItem(PKEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  return {
    progress,
    record: (id: string, best: number, total: number) =>
      save({ ...progress, [id]: { best, total, done: true } }),
    markRead: (id: string) => save({ ...progress, [id]: { best: 0, total: 0, done: true } }),
  };
}

/* ---------------- try-it links ---------------- */

const TRY_LINKS: Record<string, { label: string; scenarioId: string }[]> = {
  '2-1': [{ label: 'Hear live signals', scenarioId: 'first-contact' }],
  '2-2': [
    { label: 'FM broadcast band', scenarioId: 'first-contact' },
    { label: 'AM airband', scenarioId: 'air-band' },
    { label: 'Morse beacon', scenarioId: 'morse-intercept' },
    { label: 'Digital ISM', scenarioId: 'ism-sweep' },
  ],
  '3-1': [{ label: 'Drive the receiver', scenarioId: 'first-contact' }],
  '3-2': [{ label: 'Every signal type at once', scenarioId: 'wideband' }],
  '3-3': [{ label: 'Fox hunt a beacon', scenarioId: 'fox-hunt' }],
  '3-4': [{ label: 'Read the S-meter', scenarioId: 'first-contact' }],
  '4-1': [
    { label: 'Dig a weak beacon out of noise', scenarioId: 'fox-hunt' },
    { label: 'HF morse at 7 MHz', scenarioId: 'morse-intercept' },
  ],
  '4-2': [{ label: 'Crowded ISM band', scenarioId: 'ism-sweep' }],
};

/* ---------------- quiz ---------------- */

function Quiz({
  chapter,
  glossary,
  onFinish,
}: {
  chapter: Chapter;
  glossary: GlossaryMap;
  onFinish: (score: number, total: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const total = chapter.quiz.length;
  const q = chapter.quiz[index];

  const reset = () => {
    setIndex(0);
    setChosen(null);
    setScore(0);
    setFinished(false);
  };

  const choose = (i: number) => {
    if (chosen !== null) return;
    setChosen(i);
    if (i === q.correct) setScore((s) => s + 1);
  };

  const next = () => {
    if (index + 1 >= total) {
      const finalScore = score;
      setFinished(true);
      onFinish(finalScore, total);
    } else {
      setIndex((i) => i + 1);
      setChosen(null);
    }
  };

  if (finished) {
    const pct = Math.round((score / total) * 100);
    return (
      <div className="rounded-lg border border-foreground bg-secondary p-5 text-center">
        <div className="mono-feats font-mono text-2xl text-foreground">
          {score}/{total}
        </div>
        <p className="mt-1.5 text-[12px] text-muted-foreground">
          {pct >= 80
            ? 'Excellent — this chapter is yours. Pick the next one.'
            : pct >= 60
              ? 'Solid pass. Skim the chapter once more and try the misses.'
              : 'Worth another read — the explanations show where it slipped.'}
        </p>
        <button
          onClick={reset}
          className="mono-feats mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-mono text-[10.5px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3" /> Retake
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="mono-feats font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
          Question {index + 1} / {total}
        </span>
        <span className="mono-feats font-mono text-[9.5px] text-muted-foreground">
          score {score}
        </span>
      </div>
      <div className="text-[13px] font-medium leading-relaxed text-foreground">
        <RichText marks={q.q} glossary={glossary} />
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        {q.options.map((opt, i) => {
          const isCorrect = i === q.correct;
          const isChosen = i === chosen;
          return (
            <button
              key={i}
              onClick={() => choose(i)}
              disabled={chosen !== null}
              className={cn(
                'rounded-lg border px-3 py-2 text-left text-[12px] leading-relaxed transition-colors',
                chosen === null && 'border-border hover:border-foreground',
                chosen !== null && isCorrect && 'border-foreground bg-secondary text-foreground',
                chosen !== null && isChosen && !isCorrect && 'border-border opacity-50',
                chosen !== null && !isChosen && !isCorrect && 'border-border opacity-40',
              )}
            >
              <RichText marks={opt} glossary={glossary} />
            </button>
          );
        })}
      </div>
      <AnimatePresence>
        {chosen !== null && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-3"
          >
            <div
              className={cn(
                'rounded-lg border p-3 text-[11.5px] leading-relaxed',
                chosen === q.correct
                  ? 'border-foreground bg-secondary text-foreground'
                  : 'border-border text-muted-foreground',
              )}
            >
              <span className="font-medium">
                {chosen === q.correct ? 'Correct. ' : 'Not quite. '}
              </span>
              <RichText marks={q.explanation} glossary={glossary} />
            </div>
            <button
              onClick={next}
              className="mono-feats mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-foreground bg-foreground px-3 py-1.5 font-mono text-[10.5px] text-background transition-opacity hover:opacity-85"
            >
              {index + 1 >= total ? 'See score' : 'Next question'}
              <ChevronRight className="size-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- lab card ---------------- */

function LabCard({ chapter, glossary }: { chapter: Chapter; glossary: GlossaryMap }) {
  const lab = chapter.lab;
  if (!lab) return null;
  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
        <FlaskConical className="size-4" />
        Bench lab
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
        <RichText marks={lab.goal} glossary={glossary} />
      </p>
      {lab.steps.length > 0 && (
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[12px] leading-relaxed text-muted-foreground marker:font-mono marker:text-[10px]">
          {lab.steps.map((s, i) => (
            <li key={i}>
              <RichText marks={s} glossary={glossary} />
            </li>
          ))}
        </ol>
      )}
      {lab.expected && (
        <p className="mt-3 border-t border-line pt-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
          <span className="mono-feats font-mono text-[8.5px] uppercase tracking-[0.14em] text-muted-foreground">
            Expected result ·{' '}
          </span>
          <RichText marks={lab.expected} glossary={glossary} />
        </p>
      )}
    </div>
  );
}

/* ---------------- course view ---------------- */

export function CourseView({ onTune }: { onTune: (scenarioId: string) => void }) {
  const data = useCourseData();
  const { progress, record, markRead } = useCourseProgress();
  const [chapterId, setChapterId] = useState('0-1');

  const chapter = useMemo(
    () => data?.CHAPTERS.find((c) => c.id === chapterId) ?? null,
    [data, chapterId],
  );

  // Reset scroll on chapter change.
  useEffect(() => {
    document.getElementById('course-article')?.scrollTo({ top: 0 });
  }, [chapterId]);

  if (!data) {
    return (
      <div className="grid place-items-center py-24 text-[12px] text-muted-foreground">
        Loading the course…
      </div>
    );
  }

  const parts = [...new Set(data.CHAPTERS.map((c) => c.part))].sort();
  const doneCount = data.CHAPTERS.filter((c) => progress[c.id]?.done).length;
  const widgets = chapter ? (CHAPTER_WIDGETS[chapter.id] ?? []) : [];
  const links = chapter ? (TRY_LINKS[chapter.id] ?? []) : [];
  const idx = chapter ? data.CHAPTERS.indexOf(chapter) : 0;
  const prev = data.CHAPTERS[idx - 1];
  const next = data.CHAPTERS[idx + 1];

  return (
    <div className="grid min-h-0 md:grid-cols-[248px_minmax(0,1fr)]">
      {/* Chapter nav */}
      <nav className="border-b border-line md:border-b-0 md:border-r">
        <div className="mono-feats flex items-baseline justify-between px-4 pb-2 pt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground md:pt-5">
          <span>Course</span>
          <button
            onClick={() => useStore.getState().setCardOpen(true)}
            className="rounded border border-border px-1.5 py-0.5 transition-colors hover:border-foreground hover:text-foreground"
            title="Share your operator card"
          >
            {doneCount}/{data.CHAPTERS.length} · share card
          </button>
        </div>
        {/* Mobile select */}
        <div className="px-4 pb-3 md:hidden">
          <select
            value={chapterId}
            onChange={(e) => setChapterId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-[12px] text-foreground"
            aria-label="Choose chapter"
          >
            {data.CHAPTERS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} · {c.title}
                {progress[c.id]?.done ? ' ✓' : ''}
              </option>
            ))}
          </select>
        </div>
        {/* Desktop tree */}
        <div className="thin-scroll hidden max-h-[calc(100dvh-15rem)] overflow-y-auto px-2 pb-4 md:block">
          {parts.map((p) => (
            <div key={p} className="mt-3 first:mt-0">
              <div className="mono-feats px-2 pb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                {data.PARTS[p]}
              </div>
              {data.CHAPTERS.filter((c) => c.part === p).map((c) => {
                const active = c.id === chapterId;
                const done = progress[c.id]?.done;
                return (
                  <button
                    key={c.id}
                    onClick={() => setChapterId(c.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors',
                      active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-3.5 shrink-0 place-items-center rounded-full border',
                        done ? 'border-foreground bg-foreground text-background' : 'border-border',
                      )}
                    >
                      {done && <Check className="size-2.5" strokeWidth={3} />}
                    </span>
                    <span className="mono-feats shrink-0 font-mono text-[9.5px]">{c.id}</span>
                    <span className="truncate">{c.title}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </nav>

      {/* Chapter article */}
      <div id="course-article" className="thin-scroll min-h-0 overflow-y-auto">
        {chapter && (
          <article className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={chapter.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <div className="mono-feats font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
                  Chapter {chapter.id} · {data.PARTS[chapter.part]}
                </div>
                <h1 className="mt-1 text-xl font-medium tracking-tight text-foreground">
                  {chapter.title}
                </h1>

                {links.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {links.map((l) => (
                      <button
                        key={l.scenarioId}
                        onClick={() => onTune(l.scenarioId)}
                        className="mono-feats inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                      >
                        <Play className="size-3" />
                        {l.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-5 space-y-4">
                  {chapter.blocks.map((b, i) => {
                    if (b.t === 'h') {
                      return (
                        <h2
                          key={i}
                          className="pt-2 text-[15px] font-medium tracking-tight text-foreground"
                        >
                          {b.text}
                        </h2>
                      );
                    }
                    if (b.t === 'figure') {
                      return (
                        <div
                          key={i}
                          className="rounded-lg border border-dashed border-border px-4 py-3 text-[11px] italic leading-relaxed text-muted-foreground"
                        >
                          {b.caption}
                        </div>
                      );
                    }
                    if (b.t === 'takeaways') {
                      return (
                        <div key={i} className="rounded-lg border border-line bg-card p-4">
                          <div className="mono-feats font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                            Key takeaways
                          </div>
                          <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-muted-foreground">
                            {b.items.map((it, j) => (
                              <li key={j} className="flex gap-2">
                                <span className="mt-[7px] size-1 shrink-0 rounded-full bg-muted-foreground" />
                                <RichText marks={it} glossary={data.GLOSSARY} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    }
                    return (
                      <p key={i} className="text-[13px] leading-[1.7] text-muted-foreground">
                        <RichText marks={b.marks} glossary={data.GLOSSARY} />
                      </p>
                    );
                  })}
                </div>

                {widgets.length > 0 && (
                  <div className="mt-7 space-y-4">
                    <div className="mono-feats font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                      Play with it
                    </div>
                    {widgets.map((w) => {
                      const W = WIDGETS[w];
                      return W ? <W key={w} /> : null;
                    })}
                  </div>
                )}

                {chapter.lab && (
                  <div className="mt-7">
                    <LabCard chapter={chapter} glossary={data.GLOSSARY} />
                  </div>
                )}

                {chapter.quiz.length > 0 && (
                  <div className="mt-8 border-t border-line pt-6">
                    <h2 className="mb-4 text-[15px] font-medium tracking-tight text-foreground">
                      Check yourself
                    </h2>
                    <Quiz
                      chapter={chapter}
                      glossary={data.GLOSSARY}
                      onFinish={(score, total) => record(chapter.id, score, total)}
                    />
                  </div>
                )}
                {chapter.quiz.length === 0 && !progress[chapter.id]?.done && (
                  <button
                    onClick={() => markRead(chapter.id)}
                    className="mono-feats mt-8 rounded-md border border-border px-3 py-1.5 font-mono text-[10.5px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                  >
                    Mark as read
                  </button>
                )}

                <div className="mt-10 flex items-center justify-between border-t border-line pt-4">
                  {prev ? (
                    <button
                      onClick={() => setChapterId(prev.id)}
                      className="mono-feats inline-flex items-center gap-1 font-mono text-[10.5px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ChevronLeft className="size-3.5" /> {prev.id} {prev.title}
                    </button>
                  ) : (
                    <span />
                  )}
                  {next && (
                    <button
                      onClick={() => setChapterId(next.id)}
                      className="mono-feats inline-flex items-center gap-1 font-mono text-[10.5px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {next.id} {next.title} <ChevronRight className="size-3.5" />
                    </button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </article>
        )}
      </div>
    </div>
  );
}
