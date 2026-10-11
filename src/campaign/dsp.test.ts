import { describe, expect, it } from 'vitest';
import { copyCw } from '../test/cwHarness';
import { detectScene, nearestTrack } from '../test/detectHarness';
import { FOX_TRAIL, LISTENING_POSTS, containsIdentifier, sceneForPost } from './model';

describe('Fox trail radio evidence', () => {
  it('the real detector sees a progressively stronger beacon at the three posts', () => {
    const strengths = LISTENING_POSTS.map((post) => {
      const result = detectScene({ spec: sceneForPost(post.id), sec: 3 });
      const track = nearestTrack(result.everSeen, FOX_TRAIL.targetHz);
      expect(track, post.name).not.toBeNull();
      expect(Math.abs(track!.centerFreqHz - FOX_TRAIL.targetHz)).toBeLessThan(500);
      return track!.snrDb;
    });
    // Tracker smoothing includes keyed gaps; demand a visible trend rather
    // than equating the detector's SNR with the transmitter's power setting.
    expect(strengths[1] - strengths[0], JSON.stringify(strengths)).toBeGreaterThan(3);
    expect(strengths[2] - strengths[1], JSON.stringify(strengths)).toBeGreaterThan(3);
  }, 120_000);

  it('copies the identifier through the real receiver even at the weakest post', () => {
    const spec = sceneForPost('south-gate');
    const copy = copyCw({ spec, tuneHz: FOX_TRAIL.targetHz, sec: 12 });
    expect(containsIdentifier(copy.text), copy.text).toBe(true);
    const offChannel = copyCw({ spec, tuneHz: FOX_TRAIL.targetHz + 12_500, sec: 12 });
    expect(containsIdentifier(offChannel.text), offChannel.text).toBe(false);
    const closedGate = copyCw({ spec, tuneHz: FOX_TRAIL.targetHz, squelchDb: -20, sec: 12 });
    expect(containsIdentifier(closedGate.text), closedGate.text).toBe(false);
  }, 120_000);
});
