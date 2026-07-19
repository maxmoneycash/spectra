import { motion } from 'motion/react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Circle,
  Eye,
  Keyboard,
  Sun,
  Moon,
  LayoutGrid,
  Radio,
} from 'lucide-react';

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}
import { useStore, type AppView } from '../store/store';
import { scenarioById } from '../scenarios/scenarios';
import { useTheme } from '../hooks/useTheme';
import { cn } from '@/lib/utils';

function NavTab({
  id,
  label,
  active,
  onClick,
}: {
  id: AppView;
  label: string;
  active: boolean;
  onClick: (v: AppView) => void;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={() => onClick(id)}
      className={cn(
        'relative px-1 py-1.5 text-[13px] transition-colors',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
      {active && (
        <motion.span
          layoutId="nav-underline"
          className="absolute inset-x-0 -bottom-[1px] h-px bg-foreground"
          transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
        />
      )}
    </button>
  );
}

function IconBtn({
  label,
  onClick,
  active,
  disabled,
  children,
  className,
}: {
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.94 }}
      className={cn(
        'grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors',
        'hover:bg-accent hover:text-foreground',
        'focus-visible:outline-2 focus-visible:outline-ring',
        'disabled:opacity-40',
        active && 'bg-accent text-foreground',
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px bg-border" aria-hidden />;

/**
 * Ruled navbar: logo, view tabs, transport, engine actions, theme toggle.
 */
export function TopBar({
  onOpenPanels,
  onToggleKeys,
}: {
  onOpenPanels: () => void;
  onToggleKeys: () => void;
}) {
  const running = useStore((s) => s.running);
  const start = useStore((s) => s.start);
  const stop = useStore((s) => s.stop);
  const tuneStep = useStore((s) => s.tuneStep);
  const recording = useStore((s) => s.recording);
  const toggleRecording = useStore((s) => s.toggleRecording);
  const revealTruth = useStore((s) => s.revealTruth);
  const toggleReveal = useStore((s) => s.toggleReveal);
  const scenarioId = useStore((s) => s.scenarioId);
  const setPanel = useStore((s) => s.setPanel);
  const detections = useStore((s) => s.detections);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const { theme, toggle } = useTheme();

  const sc = scenarioById(scenarioId);
  const isConsole = view === 'console';

  return (
    <header className="flex h-14 items-center gap-2 overflow-hidden border-b border-line bg-background px-3 sm:px-4">
      <div className="flex select-none items-center gap-2">
        <Radio className="size-4 text-foreground" strokeWidth={1.75} />
        <span className="text-[13px] font-semibold tracking-[0.2em]">SPECTRA</span>
        <span className="mono-feats hidden font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground sm:inline">
          SDR Lab
        </span>
      </div>

      <div className="ml-2 flex items-center gap-3" role="tablist" aria-label="View">
        <NavTab id="console" label="Console" active={isConsole} onClick={setView} />
        <NavTab id="academy" label="Academy" active={!isConsole} onClick={setView} />
      </div>

      {isConsole && sc && (
        <button
          onClick={() => {
            setPanel('scenario');
            onOpenPanels();
          }}
          className="mono-feats ml-2 hidden items-center gap-2 rounded-md border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:flex"
          title="Open mission briefing"
        >
          <span className="size-1.5 rounded-full bg-foreground" />
          <span className="max-w-40 truncate">{sc.name}</span>
          <span className="uppercase">{sc.difficulty}</span>
        </button>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-0.5">
        <IconBtn
          label="Previous signal"
          onClick={() => tuneStep(-1)}
          disabled={!running || detections.length === 0}
          className="max-sm:hidden"
        >
          <SkipBack className="size-4" strokeWidth={1.75} />
        </IconBtn>
        <motion.button
          aria-label={running ? 'Stop the simulation' : 'Start the simulation'}
          title={running ? 'Stop' : 'Start'}
          onClick={() => (running ? stop() : start())}
          whileTap={{ scale: 0.94 }}
          className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground transition-colors hover:opacity-90"
        >
          {running ? (
            <Pause className="size-4" strokeWidth={1.75} />
          ) : (
            <Play className="size-4 translate-x-px" strokeWidth={1.75} />
          )}
        </motion.button>
        <IconBtn
          label="Next signal"
          onClick={() => tuneStep(1)}
          disabled={!running || detections.length === 0}
          className="max-sm:hidden"
        >
          <SkipForward className="size-4" strokeWidth={1.75} />
        </IconBtn>
      </div>

      <Sep />

      <IconBtn
        label={recording ? 'Stop recording (exports SigMF)' : 'Record I/Q to SigMF'}
        onClick={toggleRecording}
        disabled={!running}
        active={recording}
        className={recording ? 'animate-pulse' : ''}
      >
        <Circle className={cn('size-4', recording && 'fill-current')} strokeWidth={1.75} />
      </IconBtn>
      {isConsole && (
        <IconBtn label="Reveal ground truth" onClick={toggleReveal} active={revealTruth} className="max-sm:hidden">
          <Eye className="size-4" strokeWidth={1.75} />
        </IconBtn>
      )}
      <IconBtn label="Keyboard shortcuts" onClick={onToggleKeys} className="max-sm:hidden">
        <Keyboard className="size-4" strokeWidth={1.75} />
      </IconBtn>

      <Sep />

      <IconBtn
        label="GitHub repository"
        onClick={() => window.open('https://github.com/maxmoneycash/spectra', '_blank')}
        className="max-sm:hidden"
      >
        <GithubMark className="size-4" />
      </IconBtn>
      <IconBtn
        label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        onClick={(e) => toggle(e.clientX, e.clientY)}
      >
        {theme === 'dark' ? (
          <Sun className="size-4" strokeWidth={1.75} />
        ) : (
          <Moon className="size-4" strokeWidth={1.75} />
        )}
      </IconBtn>

      {isConsole && (
        <IconBtn label="Open panels" onClick={onOpenPanels} className="lg:hidden">
          <LayoutGrid className="size-4" strokeWidth={1.75} />
          {detections.length > 0 && (
            <span className="mono-feats absolute -right-1 -top-1 grid min-h-3.5 min-w-3.5 place-items-center rounded-full bg-primary px-0.5 font-mono text-[9px] font-medium text-primary-foreground">
              {detections.length}
            </span>
          )}
        </IconBtn>
      )}
    </header>
  );
}
