import { create } from 'zustand';
import { useStore } from '../store/store';
import { DEFAULT_SQUELCH_DB } from '../store/modes';
import { useGuide } from '../guide/store';
import { useCtf } from '../ctf/store';
import {
  CORRECT_SITE, FOX_TRAIL, LISTENING_POSTS, SUSPECT_SITES,
  campaignSceneLabel, containsIdentifier, emptyProgress, postById, restoreProgress, sceneForPost, stageOf,
  type ActionResult, type CampaignProgress, type CampaignStage, type PostId, type SiteId,
} from './model';

export const CAMPAIGN_STORAGE_KEY = 'spectra.campaign.fox-trail.v1';

function load(): CampaignProgress {
  try { return restoreProgress(JSON.parse(localStorage.getItem(CAMPAIGN_STORAGE_KEY) ?? 'null')); }
  catch { return emptyProgress(); }
}
function save(progress: CampaignProgress) {
  try { localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify({ version: 1, ...progress })); }
  catch { /* Private browsing still permits an in-memory expedition. */ }
}

export interface CampaignState extends CampaignProgress {
  active: boolean;
  postId: PostId;
  stage: CampaignStage;
  liveSignal: { snrDb: number; samples: number } | null;
  /** Fresh decoder output, discarded whenever the receiver context changes. */
  liveIdentifier: string | null;
  start: () => void;
  resume: () => void;
  visit: (postId: PostId) => ActionResult;
  recordObservation: () => ActionResult;
  copyIdentifier: () => ActionResult;
  locate: (siteId: SiteId) => ActionResult;
  leave: () => void;
  reset: () => void;
}

const fail = (message: string): ActionResult => ({ ok: false, message });
const success = (message: string): ActionResult => ({ ok: true, message });
const saved = load();

export const useCampaign = create<CampaignState>((set, get) => {
  let previousMorse = '';
  let freshMorse = '';
  function resetCopy() {
    previousMorse = useStore.getState().morseText;
    freshMorse = '';
  }
  function sceneMatches() {
    const rx = useStore.getState();
    const label = campaignSceneLabel(get().postId);
    return !rx.capture && rx.centerFreqHz === FOX_TRAIL.centerFreqHz &&
      rx.sceneLabel?.tag === label.tag && rx.sceneLabel.name === label.name && rx.sceneLabel.from === label.from;
  }
  function receptionProblem(): string | null {
    const rx = useStore.getState();
    if (!get().active || !sceneMatches()) return 'Resume Fox trail to restore this listening post.';
    if (!rx.running) return 'Power on the receiver before collecting evidence.';
    if (rx.mode !== 'cw') return 'Select CW to receive the keyed beacon.';
    if (Math.abs(rx.centerFreqHz + rx.tuningOffsetHz - FOX_TRAIL.targetHz) > 250) return 'Tune the practice beacon at 145.225 MHz.';
    if (rx.noiseSigma !== sceneForPost(get().postId).noiseSigma) return 'Resume this post to restore the same noise conditions for comparison.';
    return null;
  }
  function persist(progress: CampaignProgress) {
    save(progress);
    set({ ...progress, stage: stageOf(progress) });
  }
  function progress(): CampaignProgress {
    const { observations, identification, completedAt } = get();
    return { observations, identification, completedAt };
  }
  function evidenceTime(): number {
    const s = get();
    return Math.max(Date.now(), s.identification?.at ?? 0, ...s.observations.map((o) => o.at));
  }
  function enter(postId: PostId, keepSettings = false) {
    // Disable collection while stopCapture briefly restores the sandbox.
    set({ active: false, liveSignal: null, liveIdentifier: null });
    useGuide.getState().quit();
    useGuide.getState().dismissFinished();
    useCtf.getState().setActive(null);
    const rx = useStore.getState();
    if (rx.capture) rx.stopCapture();
    rx.loadSpec(sceneForPost(postId), campaignSceneLabel(postId));
    rx.setMode(keepSettings ? rx.mode : 'nfm');
    if (keepSettings) {
      rx.setBandwidth(rx.bandwidthHz);
      rx.setTuning(rx.tuningOffsetHz);
    }
    rx.setSquelch(keepSettings ? rx.squelchDb : DEFAULT_SQUELCH_DB);
    rx.setView('console');
    resetCopy();
    set({ active: true, postId });
  }
  function resume() { enter(get().postId); }

  // The existing worker writes detections and decoded Morse into the real
  // receiver store. Collect only new updates in an unchanged receiver context.
  useStore.subscribe((rx, previous) => {
    if (!get().active) return;
    // Another lesson, tasking, sandbox or recording owns the receiver now.
    // Keep its evidence, but never leave two coaches active over one scene.
    if (!sceneMatches()) {
      resetCopy();
      set({ active: false, liveSignal: null, liveIdentifier: null });
      return;
    }
    const changed = rx.running !== previous.running || rx.capture !== previous.capture ||
      rx.sceneLabel !== previous.sceneLabel || rx.centerFreqHz !== previous.centerFreqHz ||
      rx.tuningOffsetHz !== previous.tuningOffsetHz || rx.mode !== previous.mode ||
      rx.bandwidthHz !== previous.bandwidthHz || rx.squelchDb !== previous.squelchDb ||
      rx.noiseSigma !== previous.noiseSigma;
    if (changed || receptionProblem()) {
      resetCopy();
      if (get().liveSignal || get().liveIdentifier) set({ liveSignal: null, liveIdentifier: null });
      return;
    }
    if (rx.detections !== previous.detections) {
      const target = rx.detections
        .filter((d) => Math.abs(d.centerFreqHz - FOX_TRAIL.targetHz) <= 500 && Number.isFinite(d.snrDb) && d.snrDb >= 0)
        .sort((a, b) => b.snrDb - a.snrDb)[0];
      if (target) {
        const last = get().liveSignal;
        const snrDb = Math.max(last?.snrDb ?? 0, target.snrDb);
        const samples = Math.min(3, (last?.samples ?? 0) + 1);
        if (snrDb !== last?.snrDb || samples !== last?.samples) set({ liveSignal: { snrDb, samples } });
      }
    }
    if (rx.morseText !== previous.morseText && get().stage === 'identify') {
      // The worker retains rolling text across filter/squelch changes. Only
      // characters appended since this receiver context became valid count.
      // A decoder reset or self-correction discards the partial fresh copy;
      // the next clean repetition can still prove the full identifier.
      freshMorse = rx.morseText.startsWith(previousMorse)
        ? (freshMorse + rx.morseText.slice(previousMorse.length)).slice(-160)
        : '';
      previousMorse = rx.morseText;
      set({ liveIdentifier: containsIdentifier(freshMorse) ? freshMorse : null });
    }
  });

  return {
    ...saved,
    active: false,
    postId: saved.observations[saved.observations.length - 1]?.postId ?? LISTENING_POSTS[0].id,
    stage: stageOf(saved),
    liveSignal: null,
    liveIdentifier: null,
    start: resume,
    resume,
    visit(postId) {
      if (!postById(postId)) return fail('Choose a listening post on the practice map.');
      if (!get().active) return fail('Start Fox trail before visiting a post.');
      if (postId !== get().postId || !sceneMatches()) enter(postId, sceneMatches());
      return success(`Listening from ${postById(postId)!.name}.`);
    },
    recordObservation() {
      if (get().stage !== 'survey') return fail('All three listening posts are already in the journal.');
      const problem = receptionProblem();
      if (problem) return fail(problem);
      const s = get();
      if (s.observations.some((o) => o.postId === s.postId)) return fail('This post is already logged. Visit another listening post.');
      if (!s.liveSignal || s.liveSignal.samples < 3) return fail('Hold on the beacon while the detector collects its signal strength.');
      const observation = { postId: s.postId, at: evidenceTime(), freqHz: FOX_TRAIL.targetHz, snrDb: s.liveSignal.snrDb };
      persist({ ...progress(), observations: [...s.observations, observation] });
      // Survey text cannot stand in for a fresh copy in the identification stage.
      resetCopy();
      set({ liveIdentifier: null });
      return success(`${postById(s.postId)!.name} added to the evidence journal.`);
    },
    copyIdentifier() {
      if (get().stage !== 'identify') return fail('Compare all three listening posts before copying the identifier.');
      const problem = receptionProblem();
      if (problem) return fail(problem);
      const text = get().liveIdentifier;
      if (!text || previousMorse !== useStore.getState().morseText || !containsIdentifier(text)) return fail('Keep the receiver on the beacon until the live Morse decoder copies its identifier.');
      persist({ ...progress(), identification: { text: FOX_TRAIL.identifier, at: evidenceTime() } });
      return success('FOX 7 copied from the live decoder. Mark the site supported by your measurements.');
    },
    locate(siteId) {
      if (get().stage !== 'locate') return fail('Collect the three readings and the decoded identifier before marking a site.');
      // Interpretation uses the verified journal, so pausing or retuning
      // cannot erase it. A different scene still requires an explicit resume.
      if (!get().active || !sceneMatches()) return fail('Resume Fox trail to review this expedition.');
      if (!SUSPECT_SITES.some((site) => site.id === siteId)) return fail('Choose a named site on the practice map.');
      if (siteId !== CORRECT_SITE) return fail('That site does not fit the strength trend. Compare the three logged readings and the nearest site.');
      persist({ ...progress(), completedAt: evidenceTime() });
      return success('Beacon located at the fictional water tower. Review your expedition debrief.');
    },
    leave: () => set({ active: false, liveSignal: null, liveIdentifier: null }),
    reset() {
      const cleared = emptyProgress();
      persist(cleared);
      set({ active: false, postId: LISTENING_POSTS[0].id, liveSignal: null, liveIdentifier: null });
    },
  };
});
