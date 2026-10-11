import { describe, expect, it } from 'vitest';
import {
  FOX_TRAIL, LISTENING_POSTS, campaignJournal, containsIdentifier,
  emptyProgress, restoreProgress, stageOf, type CampaignProgress,
} from './model';

const observations = LISTENING_POSTS.map((post, i) => ({
  postId: post.id, at: 100 + i, freqHz: FOX_TRAIL.targetHz, snrDb: 20 + i * 8,
}));
const complete: CampaignProgress = {
  observations, identification: { text: FOX_TRAIL.identifier, at: 104 }, completedAt: 105,
};

describe('Fox trail evidence', () => {
  it('derives three ordered stages and the final debrief from evidence', () => {
    expect(stageOf(emptyProgress())).toBe('survey');
    expect(stageOf({ observations, identification: null, completedAt: null })).toBe('identify');
    expect(stageOf({ ...complete, completedAt: null })).toBe('locate');
    expect(stageOf(complete)).toBe('complete');
    expect(campaignJournal(complete).map((e) => e.id)).toEqual([
      'south-gate', 'footbridge', 'ridge', 'identifier', 'located',
    ]);
  });

  it('restores valid partial and completed journals without inventing progress', () => {
    expect(restoreProgress({ version: 1, ...complete })).toEqual(complete);
    const partial = { observations: observations.slice(0, 1), identification: null, completedAt: null };
    expect(restoreProgress({ version: 1, ...partial })).toEqual(partial);
  });

  it.each([
    null,
    { version: 2, ...complete },
    { version: 1, ...complete, observations: [observations[0], observations[0], observations[2]] },
    { version: 1, ...complete, observations: observations.slice(0, 2) },
    { version: 1, ...complete, identification: { text: 'FOX 8', at: 104 } },
    { version: 1, ...complete, identification: null },
    { version: 1, ...complete, completedAt: 90 },
    { version: 1, ...complete, completedAt: 1e100 },
    { version: 1, ...complete, observations: [{ ...observations[0], snrDb: NaN }] },
    { version: 1, ...complete, observations: [{ ...observations[0], freqHz: 123 }] },
  ])('rejects corrupt or out-of-order saved evidence %#', (raw) => {
    expect(restoreProgress(raw)).toEqual(emptyProgress());
  });

  it('accepts a complete identifier, never a matching substring', () => {
    expect(containsIdentifier('VVV FOX 7 VVV')).toBe(true);
    expect(containsIdentifier('fox   7')).toBe(true);
    expect(containsIdentifier('FOX 70')).toBe(false);
    expect(containsIdentifier('RED FOX 77')).toBe(false);
    expect(containsIdentifier('FOXY 7')).toBe(false);
  });
});
