import type { SceneSpec } from '../engine/protocol';
import type { SceneLabel } from '../store/store';

export const FOX_TRAIL = {
  id: 'fox-trail',
  name: 'Fox trail',
  brief: 'A practice beacon is hidden in a fictional park. Compare reception at three listening posts, copy its Morse identifier, then mark the most likely site.',
  targetHz: 145_225_000,
  identifier: 'FOX 7',
  centerFreqHz: 145_200_000,
} as const;

/** Map coordinates are fictional drawing units, never GPS coordinates. */
export const LISTENING_POSTS = [
  { id: 'south-gate', name: 'South gate', x: 24, y: 72, detail: 'The trail begins beside the southern entrance.', targetPowerDb: -21 },
  { id: 'footbridge', name: 'Footbridge', x: 53, y: 59, detail: 'An open crossing halfway up the valley.', targetPowerDb: -13 },
  { id: 'ridge', name: 'Ridge lookout', x: 76, y: 34, detail: 'A clear view toward the northern water tower.', targetPowerDb: -5 },
] as const;
export type PostId = (typeof LISTENING_POSTS)[number]['id'];

export const SUSPECT_SITES = [
  { id: 'old-mill', name: 'Old mill', x: 21, y: 84 },
  { id: 'quarry', name: 'Quarry shelter', x: 18, y: 22 },
  { id: 'water-tower', name: 'Water tower', x: 81, y: 20 },
] as const;
export type SiteId = (typeof SUSPECT_SITES)[number]['id'];
export const CORRECT_SITE: SiteId = 'water-tower';

export interface Observation {
  postId: PostId;
  at: number;
  freqHz: number;
  /** Peak SNR reported by the live detector while tuned to the beacon. */
  snrDb: number;
}
export interface Identification { text: string; at: number }
export interface CampaignProgress {
  observations: Observation[];
  identification: Identification | null;
  completedAt: number | null;
}
export type CampaignStage = 'survey' | 'identify' | 'locate' | 'complete';
export interface ActionResult { ok: boolean; message: string }

export const emptyProgress = (): CampaignProgress => ({ observations: [], identification: null, completedAt: null });
export const postById = (id: string) => LISTENING_POSTS.find((p) => p.id === id);

export function stageOf(p: CampaignProgress): CampaignStage {
  if (p.completedAt !== null) return 'complete';
  if (p.identification) return 'locate';
  return p.observations.length === LISTENING_POSTS.length ? 'identify' : 'survey';
}

export function campaignSceneLabel(id: PostId): SceneLabel {
  return { name: `${FOX_TRAIL.name} · ${postById(id)!.name}`, tag: 'campaign', from: 'station' };
}

export function sceneForPost(id: PostId): SceneSpec {
  const post = postById(id)!;
  return {
    centerFreqHz: FOX_TRAIL.centerFreqHz,
    noiseSigma: 0.025,
    emitters: [
      { id: 'fox-trail-beacon', kind: 'cw', freqHz: FOX_TRAIL.targetHz, powerDb: post.targetPowerDb, wpm: 18, text: 'VVV FOX 7  ', seed: 7401 },
      { id: 'park-radio', kind: 'nfm', freqHz: 145_040_000, powerDb: -9, message: 'voice', seed: 7402 },
      { id: 'utility-beacon', kind: 'cw', freqHz: 145_390_000, powerDb: -12, wpm: 18, text: 'VVV TEST  ', seed: 7403 },
    ],
  };
}

export function containsIdentifier(text: string): boolean {
  return /(?:^|\s)FOX\s+7(?:\s|$)/.test(text.toUpperCase());
}

const isTime = (value: unknown): value is number => typeof value === 'number' &&
  Number.isSafeInteger(value) && value > 0 && value <= 8_640_000_000_000_000;

/** Storage is untrusted: restore only a complete, internally consistent chain. */
export function restoreProgress(raw: unknown): CampaignProgress {
  if (!raw || typeof raw !== 'object') return emptyProgress();
  const data = raw as Record<string, unknown>;
  if (data.version !== 1 || !Array.isArray(data.observations) || data.observations.length > LISTENING_POSTS.length) return emptyProgress();
  const observations: Observation[] = [];
  let lastAt = 0;
  for (const item of data.observations) {
    if (!item || typeof item !== 'object') return emptyProgress();
    const o = item as Record<string, unknown>;
    const post = typeof o.postId === 'string' ? postById(o.postId) : undefined;
    if (!post || observations.some((v) => v.postId === post.id) ||
        !isTime(o.at) || o.at < lastAt ||
        o.freqHz !== FOX_TRAIL.targetHz || typeof o.snrDb !== 'number' ||
        !Number.isFinite(o.snrDb) || o.snrDb < 0 || o.snrDb > 150) return emptyProgress();
    observations.push({ postId: post.id, at: o.at, freqHz: FOX_TRAIL.targetHz, snrDb: o.snrDb });
    lastAt = o.at;
  }
  let identification: Identification | null = null;
  if (data.identification != null) {
    if (observations.length !== LISTENING_POSTS.length || typeof data.identification !== 'object') return emptyProgress();
    const id = data.identification as Record<string, unknown>;
    if (id.text !== FOX_TRAIL.identifier || !isTime(id.at) || id.at < lastAt) return emptyProgress();
    identification = { text: FOX_TRAIL.identifier, at: id.at };
    lastAt = id.at;
  }
  let completedAt: number | null = null;
  if (data.completedAt != null) {
    if (!identification || !isTime(data.completedAt) || data.completedAt < lastAt) return emptyProgress();
    completedAt = data.completedAt;
  }
  return { observations, identification, completedAt };
}

export interface JournalEntry { id: string; at: number; title: string; detail: string }
export function campaignJournal(p: CampaignProgress): JournalEntry[] {
  const entries: JournalEntry[] = p.observations.map((o) => ({
    id: o.postId, at: o.at, title: postById(o.postId)!.name,
    detail: `${(o.freqHz / 1e6).toFixed(3)} MHz · peak SNR ${o.snrDb.toFixed(1)} dB`,
  }));
  if (p.identification) entries.push({ id: 'identifier', at: p.identification.at, title: 'Identifier copied', detail: p.identification.text });
  if (p.completedAt !== null) entries.push({ id: 'located', at: p.completedAt, title: 'Beacon located', detail: 'Water tower · fictional training site' });
  return entries;
}

export const FOX_TRAIL_DEBRIEF = 'The same beacon grew stronger toward Ridge lookout, consistent with the water tower. Copying FOX 7 confirmed that every observation tracked the same transmitter. This exercise uses fixed simulated power at fictional posts. Real signal strength also changes with terrain, reflections, antennas, and obstructions; it cannot establish an exact location by itself.';
