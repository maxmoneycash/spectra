import { useState, type ReactNode } from 'react';
import { ClipboardCheck, Crosshair, GraduationCap, IdCard, Radio, ScrollText } from 'lucide-react';
import { useStore } from '../store/store';
import { useGuide } from '../guide/store';
import { useExam } from '../exam/store';
import { LESSONS, lessonById } from '../guide/lessons';
import { challengeById } from '../ctf/challenges';
import { openMission } from '../ctf/open';
import type { ElementId } from '../exam/types';
import { useProgression, type ExamStanding, type Progression } from '../progression/progression';
import type { LogEntry, NextUp } from '../progression/rank';
import { GroupLabel, IconButton } from '@/ui/controls';
import { BottomSheet } from '@/ui/BottomSheet';
import { tick } from '@/ui/kit/haptics';
import { cn } from '@/lib/utils';

/** `10-09 20:42Z` — the log spans days, so the date stays. */
function stamp(at: number): string {
  const iso = new Date(at).toISOString();
  return `${iso.slice(5, 10)} ${iso.slice(11, 16)}Z`;
}

const PRIMARY =
  'inline-flex min-h-11 items-center gap-2 rounded-lg border border-foreground bg-foreground px-3.5 text-[12px] font-medium text-background transition-opacity hover:opacity-85 sm:min-h-10';
const SECONDARY =
  'inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground sm:min-h-10';

/**
 * The board: what to do next, how ready you are, what you've done. Every
 * number here is derived from the same stores the other views write, so it
 * can't drift from them. One primary action at a time.
 */
export function Station() {
  const p = useProgression();
  const setView = useStore((s) => s.setView);
  const setCardOpen = useStore((s) => s.setCardOpen);
  const since = useStore((s) => s.operator.since);
  const [logOpen, setLogOpen] = useState(false);

  const sinceLabel = new Date(since).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

  return (
    <div className="thin-scroll h-full overflow-y-auto">
      <div className="mx-auto min-h-full max-w-2xl border-x border-line">
        <header className="border-b border-line px-4 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <GroupLabel>Station</GroupLabel>
              <h1 className="mt-0.5 text-[19px] font-semibold tracking-tight text-foreground">{p.rank}</h1>
              <p className="mono-feats mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Since {sinceLabel} · {p.identified.length} {p.identified.length === 1 ? 'emitter' : 'emitters'}{' '}
                identified
              </p>
            </div>
            <IconButton label="Operator card" onClick={() => setCardOpen(true)}>
              <IdCard />
            </IconButton>
          </div>
        </header>

        <section className="border-b border-line px-4 py-5 sm:px-6">
          <GroupLabel>Next</GroupLabel>
          <NextCard next={p.next} featured={p.featured} setView={setView} />
        </section>

        <section className="border-b border-line px-4 py-5 sm:px-6">
          <GroupLabel>Readiness</GroupLabel>
          <Readiness p={p} setView={setView} />
        </section>

        <section className="px-4 py-5 sm:px-6">
          <div className="flex items-baseline justify-between">
            <GroupLabel>Log</GroupLabel>
            {p.log.length > 5 && (
              <button
                onClick={() => setLogOpen(true)}
                className="mono-feats inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              >
                <ScrollText className="size-3" /> Full log · {p.log.length}
              </button>
            )}
          </div>
          <Log entries={p.log.slice(0, 5)} />
        </section>
      </div>

      <BottomSheet open={logOpen} onClose={() => setLogOpen(false)} title="Log">
        <div className="px-4 pb-4">
          <Log entries={p.log} />
        </div>
      </BottomSheet>
    </div>
  );
}

function NextCard({
  next,
  featured,
  setView,
}: {
  next: NextUp;
  featured: ExamStanding;
  setView: (v: 'console' | 'academy' | 'exam' | 'ctf') => void;
}) {
  const startLesson = useGuide((s) => s.start);
  const examPool = useExam((s) => s.pool);
  const loadPool = useExam((s) => s.loadPool);
  const startExam = useExam((s) => s.startExam);

  const sitExam = async (pool: ElementId) => {
    tick();
    setView('exam');
    if (examPool !== pool) await loadPool(pool);
    startExam();
  };

  let eyebrow = '';
  let title = '';
  let body = '';
  let action: ReactNode = null;

  if (next.kind === 'lesson') {
    const l = lessonById(next.id);
    if (l) {
      const n = String(LESSONS.findIndex((x) => x.id === l.id) + 1).padStart(2, '0');
      eyebrow = `Tasking ${n} · ${l.minutes} min`;
      title = l.title;
      const skill = l.skill.charAt(0).toLowerCase() + l.skill.slice(1);
      body = `Teaches ${skill}. ${l.steps.length} steps on the live receiver; each confirms itself when the receiver shows you did it.`;
      action = (
        <button
          className={PRIMARY}
          onClick={() => {
            tick();
            startLesson(l.id);
          }}
        >
          <GraduationCap className="size-4" /> Begin tasking
        </button>
      );
    }
  } else if (next.kind === 'mission') {
    const c = challengeById(next.id);
    if (c) {
      eyebrow = `Mission · +${c.points}`;
      title = c.name;
      body = c.brief;
      action = (
        <button
          className={PRIMARY}
          onClick={() => {
            tick();
            setView('ctf');
            void openMission(c.id);
          }}
        >
          <Crosshair className="size-4" /> Open tasking
        </button>
      );
    }
  } else if (next.kind === 'exam') {
    const e = next.pool === featured.pool ? featured : null;
    const total = e?.total ?? featured.total;
    eyebrow = `Practice exam · ${total} questions`;
    title = `${e?.name ?? next.pool} practice exam`;
    body = e
      ? `Pass is ${e.passing}. Predicted ${e.predicted}, likely ${e.low}–${e.high}. One question from each of the ${e.groups} groups, as a VE session draws it.`
      : 'One question from each group, as a VE session draws it.';
    action = (
      <button className={PRIMARY} onClick={() => void sitExam(next.pool)}>
        <ClipboardCheck className="size-4" /> Sit the exam
      </button>
    );
  } else {
    eyebrow = 'All taskings cleared';
    title = 'Nothing pending';
    body = `Every lesson, every flag, and a passed practice exam. Sit another ${featured.name} exam to keep the prediction current, or go listen.`;
    action = (
      <>
        <button className={PRIMARY} onClick={() => void sitExam(featured.pool)}>
          <ClipboardCheck className="size-4" /> Sit another exam
        </button>
        <button className={SECONDARY} onClick={() => setView('console')}>
          <Radio className="size-4" /> Open the receiver
        </button>
      </>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-line bg-card p-4">
      <p className="mono-feats font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
      <h2 className="mt-1 text-[15px] font-medium text-foreground">{title}</h2>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-3 flex flex-wrap gap-2">{action}</div>
    </div>
  );
}

function Readiness({ p, setView }: { p: Progression; setView: (v: 'academy' | 'exam' | 'ctf') => void }) {
  const e = p.featured;
  const cells: {
    key: string;
    label: string;
    value: string;
    sub?: string;
    pct: number;
    view: 'academy' | 'exam' | 'ctf';
    icon: typeof GraduationCap;
  }[] = [
    {
      key: 'lessons',
      label: 'Lessons',
      value: `${p.lessons.done.length} / ${p.lessons.total}`,
      pct: p.lessons.total ? (p.lessons.done.length / p.lessons.total) * 100 : 0,
      view: 'academy',
      icon: GraduationCap,
    },
    {
      key: 'flags',
      label: 'Flags',
      value: `${p.flags.points.toLocaleString()} / ${p.flags.totalPoints.toLocaleString()}`,
      pct: p.flags.totalPoints ? (p.flags.points / p.flags.totalPoints) * 100 : 0,
      view: 'ctf',
      icon: Crosshair,
    },
    {
      key: 'exam',
      label: `Exam · ${e.name}`,
      value: `${e.predicted} / ${e.total}`,
      // The likely range lives in the NEXT card; the cell is too narrow on a phone.
      sub: e.passedPractice ? `Passed · best ${e.best?.correct ?? e.predicted}` : `Pass mark ${e.passing}`,
      pct: e.total ? (e.predicted / e.total) * 100 : 0,
      view: 'exam',
      icon: ClipboardCheck,
    },
  ];

  return (
    <div className="mt-2 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-border">
      {cells.map((c) => {
        const Icon = c.icon;
        const passLine = c.key === 'exam' && !e.passedPractice ? (e.passing / e.total) * 100 : null;
        return (
          <button
            key={c.key}
            onClick={() => setView(c.view)}
            className="group bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent/60"
            aria-label={`${c.label}: ${c.value}`}
          >
            <p className="mono-feats flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              <Icon className="size-3" /> {c.label}
            </p>
            <p className="mono-feats mt-0.5 truncate font-mono text-[14px] font-medium text-foreground">{c.value}</p>
            <div className="relative mt-1.5 h-[3px] overflow-hidden rounded-full bg-border">
              <div
                className={cn('h-full rounded-full transition-[width] duration-500 ease-out', 'bg-foreground')}
                style={{ width: `${Math.min(100, c.pct)}%` }}
              />
              {passLine !== null && (
                <span
                  aria-hidden
                  className="absolute top-0 h-full w-px bg-tuned"
                  style={{ left: `${passLine}%` }}
                />
              )}
            </div>
            {c.sub && (
              <p className="mono-feats mt-1 truncate font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {c.sub}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Log({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="mono-feats mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        No traffic logged — begin tasking 01
      </p>
    );
  }
  return (
    <ol className="mt-2 divide-y divide-border border-y border-line">
      {entries.map((e, i) => (
        <li key={`${e.kind}-${e.at}-${i}`} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 py-2">
          <span className="mono-feats font-mono text-[10px] tabular-nums text-muted-foreground">{stamp(e.at)}</span>
          <span className="min-w-0">
            <span className="mono-feats block font-mono text-[10px] uppercase tracking-[0.14em] text-foreground">
              {e.tag}
            </span>
            <span className="block truncate text-[12px] text-muted-foreground">{e.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
