import { AnimatePresence, motion } from 'motion/react';
import { FileText } from 'lucide-react';
import { useStore } from '@/store/store';

function utc(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}Z`;
}

/**
 * The intercept log: everything the receiver was tuned to when someone
 * transmitted, newest first, in UTC like a station logbook. Reading it back
 * is how you learn the shape of real traffic — who calls whom, how they
 * identify, what a net sounds like.
 */
export function LogPanel() {
  const intercepts = useStore((s) => s.intercepts);
  const setTuning = useStore((s) => s.setTuning);
  const centerFreqHz = useStore((s) => s.centerFreqHz);

  if (intercepts.length === 0) {
    return (
      <div className="flex flex-col items-center px-4 py-8 text-center">
        <span className="grid size-10 place-items-center rounded-xl bg-secondary text-muted-foreground">
          <FileText className="size-5" />
        </span>
        <p className="mt-3 text-[13px] font-medium text-foreground">Nothing intercepted yet</p>
        <p className="mt-1 max-w-[17rem] text-[12px] leading-relaxed text-muted-foreground">
          Lock onto a voice signal, or let the scanner run. Every transmission you hear is logged here with a
          transcript.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mono-feats pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        Intercepts · {intercepts.length}
      </p>
      <ol className="space-y-2">
        <AnimatePresence initial={false}>
          {intercepts.slice(0, 80).map((e) => (
            <motion.li
              key={e.id}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-line bg-card p-3"
            >
              <button
                onClick={() => setTuning(Math.round(e.freqHz - centerFreqHz))}
                className="block w-full text-left"
                title="Tune back to this frequency"
              >
                <span className="mono-feats flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  <span className="tabular-nums">{utc(e.at)}</span>
                  <span className="text-foreground/80">{(e.freqHz / 1e6).toFixed(4)}</span>
                  <span>{e.mode}</span>
                  <span className="ml-auto font-semibold normal-case tracking-normal text-foreground">{e.who}</span>
                </span>
                <span className="mt-1.5 block text-[12.5px] leading-snug text-foreground">{e.text}</span>
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}
