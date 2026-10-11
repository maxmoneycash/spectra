import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, Crosshair, Headphones, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GroupLabel } from '@/ui/controls';
import { tick } from '@/ui/kit/haptics';
import { cn } from '@/lib/utils';
import { useStore } from '../store/store';
import { useGuide } from '../guide/store';
import { LESSONS } from '../guide/lessons';
import { challengeById } from '../ctf/challenges';

const lesson = LESSONS[0];
const challenge = challengeById(lesson.challengeId)!;

/** A briefing for the first lesson/mission pair, using their existing progress. */
export function FirstContact({ lessonDone, missionDone }: { lessonDone: boolean; missionDone: boolean }) {
  const startLesson = useGuide((s) => s.start);
  const activeLesson = useGuide((s) => s.lessonId);
  const openChallenge = useGuide((s) => s.openChallenge);
  const quitLesson = useGuide((s) => s.quit);
  const setView = useStore((s) => s.setView);
  const sceneLabel = useStore((s) => s.sceneLabel);
  const capture = useStore((s) => s.capture);
  const reduce = useReducedMotion();
  const resume = activeLesson === lesson.id && !capture && sceneLabel?.tag === 'training' && sceneLabel.name === lesson.title;

  const begin = () => {
    tick();
    if (!lessonDone) {
      if (resume) setView('console');
      else startLesson(lesson.id);
    } else {
      quitLesson();
      openChallenge(lesson.id);
    }
  };

  return (
    <motion.section
      aria-labelledby="first-contact-title"
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="border-b border-line"
    >
      <div className="px-4 pt-5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <GroupLabel>Operation 01</GroupLabel>
          <GroupLabel>Simulated · FM broadcast</GroupLabel>
        </div>
        <h2 id="first-contact-title" className="mt-2 text-balance text-2xl font-semibold text-foreground">
          First contact
        </h2>
        <p className="mt-2 max-w-lg text-pretty text-sm leading-relaxed text-muted-foreground">
          {lessonDone
            ? 'You have worked the receiver. Now survey a new band and submit your first flag without the coach.'
            : 'Find a signal. Tune in. Hear a voice. Your coach points out each control as you use the radio.'}
        </p>
      </div>

      <TrainingBand />

      <div className="px-4 pb-5 sm:px-6">
        <ol aria-label="First contact objectives" className="divide-y divide-line border-y border-line">
          {[
            { title: lesson.title, detail: `${lesson.minutes} min · guided receiver`, done: lessonDone, current: !lessonDone, Icon: Headphones },
            { title: challenge.name, detail: `Radio CTF · up to ${challenge.points} points`, done: missionDone, current: lessonDone, Icon: Crosshair },
          ].map(({ title, detail, done, current, Icon }, i) => (
            <li key={title} aria-current={current && !done ? 'step' : undefined} className="flex items-center gap-3 py-3">
              <span className={cn('grid size-8 shrink-0 place-items-center rounded-full border', current && !done ? 'border-tuned text-tuned' : 'border-border text-muted-foreground')}>
                {done ? <Check aria-hidden className="size-4" /> : <Icon aria-hidden className="size-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{title}</span>
                <span className="block text-xs text-muted-foreground">{detail}</span>
              </span>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {done ? 'COMPLETE' : current ? 'UP NEXT' : `0${i + 1}`}
              </span>
            </li>
          ))}
        </ol>
        <Button onClick={begin} className="mt-4 min-h-11 w-full justify-between">
          {lessonDone ? `Begin ${challenge.name}` : resume ? 'Resume guided reception' : 'Start guided reception'}
          <ArrowRight aria-hidden />
        </Button>
        <Button variant="ghost" onClick={() => setView('console')} className="mt-1 min-h-11 w-full text-xs text-muted-foreground">
          <Radio aria-hidden /> Explore the receiver
        </Button>
        <p className="mt-1 text-center text-xs text-muted-foreground">No equipment or account needed. Progress saves on this device.</p>
      </div>
    </motion.section>
  );
}

/** Static briefing diagram, explicitly labelled; never presented as live RF. */
function TrainingBand() {
  const left = lesson.scene.centerFreqHz - 500_000;
  const x = (hz: number) => 28 + ((hz - left) / 1_000_000) * 504;
  return (
    <figure className="my-4 border-y border-line bg-stage px-4 py-3 sm:px-6">
      <figcaption className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
        <span>TRAINING BAND PREVIEW</span><span>MHz</span>
      </figcaption>
      <svg viewBox="0 0 560 112" role="img" aria-label="Practice band with three broadcast stations. The voice station is at 101.500 megahertz." className="w-full overflow-visible">
        <path d="M0 78H560" fill="none" stroke="var(--stage-border)" />
        {Array.from({ length: 21 }, (_, i) => <path key={i} d={`M${28 + i * 25.2} 78v${i % 2 ? 4 : 8}`} stroke="var(--stage-border)" />)}
        {lesson.scene.emitters.map((emitter) => {
          const cx = x(emitter.freqHz);
          const voice = Boolean(emitter.speech);
          const top = 20 + Math.abs(emitter.powerDb ?? -6) * 3;
          return (
            <g key={emitter.id}>
              <path d={`M${cx - 38} 78L${cx - 28} ${top + 14}L${cx - 19} ${top}H${cx + 19}L${cx + 28} ${top + 14}L${cx + 38} 78Z`} fill={voice ? 'var(--tuned)' : 'var(--stage-foreground)'} fillOpacity={voice ? 0.14 : 0.05} />
              <path d={`M${cx - 38} 78L${cx - 28} ${top + 14}L${cx - 19} ${top}H${cx + 19}L${cx + 28} ${top + 14}L${cx + 38} 78`} fill="none" stroke={voice ? 'var(--tuned)' : 'var(--stage-muted)'} strokeWidth="1.5" />
              {voice && <text x={cx} y="15" textAnchor="middle" fill="var(--stage-foreground)" fontFamily="var(--font-mono)" fontSize="16">VOICE</text>}
              <text x={cx} y="105" textAnchor="middle" fill="var(--stage-muted)" fontFamily="var(--font-mono)" fontSize="18">{(emitter.freqHz / 1e6).toFixed(3)}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
