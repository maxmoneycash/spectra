import { useEffect, useState } from 'react';
import { ArrowRight, Check, Map, Radio, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { GroupLabel } from '@/ui/controls';
import { StarLink } from '@/ui/StarLink';
import { useStore } from '@/store/store';
import { cn } from '@/lib/utils';
import { useCampaign } from './store';
import {
  campaignJournal,
  FOX_TRAIL,
  FOX_TRAIL_DEBRIEF,
  LISTENING_POSTS,
  postById,
  SUSPECT_SITES,
  type ActionResult,
  type PostId,
} from './model';

const button =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border px-3 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-45 disabled:cursor-not-allowed';
const primary = `${button} border-foreground bg-foreground text-background hover:bg-foreground/85`;

function returnToStation() {
  useCampaign.getState().leave();
  const rx = useStore.getState();
  if (rx.sceneLabel?.tag === 'campaign') {
    rx.stop();
    rx.loadScenario(rx.scenarioId);
  }
  rx.setView('station');
}

/** Fictional geography: the receiver supplies the measurements, never the map. */
function TrailMap({ postId }: { postId: PostId }) {
  return (
    <svg
      viewBox="0 0 420 270"
      role="img"
      aria-label="Fictional park map: South gate in the south, Footbridge in the center, Ridge lookout in the northeast beside Water tower. Old mill is southwest; Quarry shelter is northwest."
      className="w-full rounded-md border border-line bg-secondary/40 text-muted-foreground"
    >
      <path
        d="M0 192Q100 145 182 164T420 90M0 206Q100 159 182 178T420 104"
        fill="none"
        stroke="currentColor"
        opacity=".18"
        strokeWidth="3"
      />
      <path
        d="M70 270Q130 190 220 153T320 64"
        fill="none"
        stroke="currentColor"
        opacity=".4"
        strokeWidth="1.5"
        strokeDasharray="4 5"
      />
      <path
        d="M35 30Q130 0 142 80T215 110M52 18Q158 10 165 75T240 89M261 254Q294 201 408 230"
        fill="none"
        stroke="currentColor"
        opacity=".12"
      />
      {SUSPECT_SITES.map((s) => (
        <g key={s.id} transform={`translate(${s.x * 4.2},${s.y * 2.7})`}>
          <rect x="-4" y="-4" width="8" height="8" fill="none" stroke="currentColor" />
          <text y="-12" textAnchor="middle" fill="currentColor" fontSize="11">
            {s.name}
          </text>
        </g>
      ))}
      {LISTENING_POSTS.map((p, i) => (
        <g
          key={p.id}
          transform={`translate(${p.x * 4.2},${p.y * 2.7})`}
          className={p.id === postId ? 'text-tuned' : ''}
        >
          <circle
            r="10"
            fill="var(--color-background)"
            stroke="currentColor"
            strokeWidth={p.id === postId ? 2 : 1}
          />
          <text y="4" textAnchor="middle" fill="currentColor" fontSize="11">
            {i + 1}
          </text>
          <text y="25" textAnchor="middle" fill="currentColor" fontSize="11">
            {p.name}
          </text>
        </g>
      ))}
      <text x="15" y="20" fill="currentColor" fontSize="9" letterSpacing="2">
        PRACTICE PARK · FICTIONAL
      </text>
      <text x="390" y="20" fill="currentColor" fontSize="10">
        N ↑
      </text>
    </svg>
  );
}

export function CampaignCard() {
  const observations = useCampaign((s) => s.observations);
  const completedAt = useCampaign((s) => s.completedAt);
  const active = useCampaign((s) => s.active);
  const postId = useCampaign((s) => s.postId);
  const started = observations.length > 0 || active;
  return (
    <section className="border-b border-line px-4 py-5 sm:px-6">
      <GroupLabel>Field exercise · 5–10 min</GroupLabel>
      <div className="mt-2 flex items-start gap-3">
        <Map className="mt-1 size-5 shrink-0 text-tuned" />
        <div>
          <h2 className="text-[15px] font-medium">{FOX_TRAIL.name}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{FOX_TRAIL.brief}</p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {completedAt
              ? 'Case closed · evidence saved'
              : `${observations.length}/3 listening posts logged · simulated RF`}
          </p>
          <button
            className={cn(primary, 'mt-3')}
            onClick={() =>
              completedAt || started ? useCampaign.getState().resume() : useCampaign.getState().start()
            }
          >
            {completedAt
              ? 'Open debrief'
              : started
                ? `Resume at ${postById(postId)?.name ?? 'South gate'}`
                : 'Begin Fox trail'}
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}

export function CampaignCoach({ docked = false }: { docked?: boolean }) {
  const c = useCampaign();
  const [boardOpen, setBoardOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  useEffect(() => {
    setBoardOpen(c.active && c.completedAt !== null);
    setFeedback('');
  }, [c.active, c.completedAt]);
  if (!c.active) return null;
  const post = postById(c.postId)!;
  const logged = c.observations.some((o) => o.postId === c.postId);
  const nextPost = LISTENING_POSTS.find((p) => !c.observations.some((o) => o.postId === p.id));
  const report = (result: ActionResult) => setFeedback(result.message);
  const visit = (id: PostId) => {
    report(c.visit(id));
    setBoardOpen(false);
  };
  const complete = c.stage === 'complete';
  const heading = complete
    ? 'Beacon located'
    : c.stage === 'locate'
      ? 'Mark the likely site'
      : c.stage === 'identify'
        ? 'Copy the beacon identifier'
        : `Listen at ${post.name}`;
  const instruction =
    c.stage === 'survey'
      ? logged
        ? 'Observation saved. Move to the next listening post and compare the same beacon.'
        : 'Start the receiver. Tune to 145.225 MHz, select CW, and log the beacon when it is detected.'
      : c.stage === 'identify'
        ? 'Stay on 145.225 MHz in CW. Let the live decoder copy a full identifier, then save it as evidence.'
        : c.stage === 'locate'
          ? 'Compare your three measurements on the map. Which site is nearest the strongest reception?'
          : 'Three listening posts, one decoded identifier, and a location supported by your evidence.';
  return (
    <>
      <section
        aria-label="Fox trail campaign"
        className={cn(
          'z-40 border-line bg-card/95 text-foreground',
          docked
            ? 'thin-scroll max-h-[36dvh] shrink-0 overflow-y-auto border-b'
            : 'absolute bottom-4 left-4 w-[360px] rounded-md border shadow-xl backdrop-blur-md',
        )}
      >
        <header className="flex items-center gap-2 border-b border-line px-3 py-1">
          <Map className="size-3.5 text-tuned" />
          <span className="flex-1 font-mono text-[10px] uppercase tracking-wider">
            Fox trail · {complete ? 'Complete' : `${c.observations.length}/3 posts`}
          </span>
          <button
            className="grid size-11 place-items-center text-muted-foreground lg:size-8"
            aria-label="Leave Fox trail"
            onClick={returnToStation}
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="px-3 py-2.5">
          <h2 className="text-sm font-medium">{heading}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{instruction}</p>
          {c.stage === 'identify' && (
            <p
              className="mt-2 min-h-5 break-words font-mono text-xs text-tuned"
              aria-label="Live campaign decoder"
            >
              {c.liveIdentifier || 'Listening for Morse…'}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {c.stage === 'survey' &&
              (!logged ? (
                <button className={primary} onClick={() => report(c.recordObservation())}>
                  Log reception
                </button>
              ) : (
                nextPost && (
                  <button className={primary} onClick={() => visit(nextPost.id)}>
                    Next post <ArrowRight className="size-3.5" />
                  </button>
                )
              ))}
            {c.stage === 'identify' && (
              <button className={primary} onClick={() => report(c.copyIdentifier())}>
                Save identifier
              </button>
            )}
            <button
              className={cn(
                button,
                (c.stage === 'locate' || complete) &&
                  'border-foreground bg-foreground text-background hover:bg-foreground/85',
              )}
              onClick={() => {
                setFeedback('');
                setBoardOpen(true);
              }}
            >
              <Map className="size-3.5" />
              {complete ? 'Read debrief' : 'Map & evidence'}
            </button>
          </div>
          {feedback && (
            <p role="status" className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {feedback}
            </p>
          )}
        </div>
      </section>
      <Dialog open={boardOpen} onOpenChange={setBoardOpen}>
        <DialogContent className="thin-scroll max-h-[90dvh] overflow-y-auto p-4 sm:max-w-xl sm:p-6">
          <DialogTitle>{complete ? 'Fox trail · case closed' : 'Fox trail · field notes'}</DialogTitle>
          <DialogDescription>
            {complete
              ? 'Your receiver evidence is saved on this device.'
              : 'Visit the listening posts, then use your recorded evidence to place the beacon.'}
          </DialogDescription>
          <TrailMap postId={c.postId} />
          {!complete && (
            <div className="grid grid-cols-3 gap-2">
              {LISTENING_POSTS.map((p, i) => (
                <button
                  key={p.id}
                  className={cn(
                    button,
                    'flex-col gap-1 px-1 py-2 text-[11px]',
                    p.id === c.postId && 'border-tuned text-tuned',
                  )}
                  onClick={() => visit(p.id)}
                  aria-pressed={p.id === c.postId}
                >
                  <span>
                    {i + 1}. {p.name}
                  </span>
                  {c.observations.some((o) => o.postId === p.id) && <Check className="size-3" />}
                </button>
              ))}
            </div>
          )}
          <div>
            <GroupLabel>Evidence journal</GroupLabel>
            {c.observations.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                No observations yet. Close the map and acquire the beacon at South gate.
              </p>
            ) : (
              <ol className="mt-2 divide-y divide-line">
                {campaignJournal(c).map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-3 py-2 text-xs">
                    <span>
                      {entry.title}
                      <span className="mt-1 block font-mono text-[11px] text-muted-foreground">
                        {entry.detail}
                      </span>
                    </span>
                    <time className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {new Date(entry.at).toISOString().slice(11, 16)}Z
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </div>
          {c.stage === 'locate' && (
            <div>
              <GroupLabel>Place the beacon</GroupLabel>
              <div className="mt-2 flex flex-wrap gap-2">
                {SUSPECT_SITES.map((site) => (
                  <button className={button} key={site.id} onClick={() => report(c.locate(site.id))}>
                    {site.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {feedback && (
            <p role="status" className="text-xs text-muted-foreground">
              {feedback}
            </p>
          )}
          {complete && (
            <div className="border-t border-line pt-3">
              <p className="text-xs leading-relaxed text-muted-foreground">{FOX_TRAIL_DEBRIEF}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button className={button} onClick={returnToStation}>
                  <Radio className="size-3.5" />
                  Back to Station
                </button>
                <StarLink />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
