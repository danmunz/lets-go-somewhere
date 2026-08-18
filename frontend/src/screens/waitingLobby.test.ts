import { describe, expect, it } from 'vitest';
import type { GroupStatus } from '@lgs/shared';
import {
  canPollWaitingLobby,
  newlyCompletedMembers,
  waitingNudgeMessage,
  waitingPollDelay,
} from './waitingLobby.js';

const status = (complete: readonly string[] = [], revealOpen = false): GroupStatus => ({
  revealOpen,
  allComplete: complete.length === 5,
  members: ['dan', 'james', 'john', 'matt', 'peter'].map((user) => ({ user: user as GroupStatus['members'][number]['user'], complete: complete.includes(user) })),
  updatedAt: '2026-08-19T12:00:00.000Z',
});

describe('waiting lobby polling contract', () => {
  it('uses deterministic 20-second delays with no more than ten percent jitter', () => {
    const first = waitingPollDelay(0);
    expect(first).toBe(waitingPollDelay(0));
    expect(first).toBeGreaterThanOrEqual(18_000);
    expect(first).toBeLessThanOrEqual(22_000);
    expect(waitingPollDelay(7)).toBeGreaterThanOrEqual(18_000);
    expect(waitingPollDelay(7)).toBeLessThanOrEqual(22_000);
  });

  it('only polls while the page is visible, focused, and the envelope is sealed', () => {
    expect(canPollWaitingLobby({ visibilityState: 'visible', hasFocus: true, revealOpen: false })).toBe(true);
    expect(canPollWaitingLobby({ visibilityState: 'hidden', hasFocus: true, revealOpen: false })).toBe(false);
    expect(canPollWaitingLobby({ visibilityState: 'visible', hasFocus: false, revealOpen: false })).toBe(false);
    expect(canPollWaitingLobby({ visibilityState: 'visible', hasFocus: true, revealOpen: true })).toBe(false);
  });

  it('does not create completion toasts for the first status, only later transitions', () => {
    expect(newlyCompletedMembers(null, status(['dan', 'matt']))).toEqual([]);
    expect(newlyCompletedMembers(status(['dan']), status(['dan', 'matt']))).toEqual(['matt']);
  });

  it('creates a destination-free nudge with the current app origin', () => {
    expect(waitingNudgeMessage('https://lets-go-somewhere-3549f.web.app')).toBe(
      'Your trip choices are waiting whenever you’re ready: https://lets-go-somewhere-3549f.web.app',
    );
  });
});
