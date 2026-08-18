import type { GroupStatus, RosterUser } from '@lgs/shared';

export const WAITING_POLL_INTERVAL_MS = 20_000;
const WAITING_POLL_JITTER_MS = 2_000;

/**
 * A deterministic spread keeps the five browsers from landing on the status
 * endpoint at the same instant without making polling behavior untestable.
 */
export function waitingPollDelay(cycle: number): number {
  const boundedCycle = Math.max(0, Math.floor(cycle));
  const offset = (boundedCycle * 7919) % (WAITING_POLL_JITTER_MS * 2 + 1) - WAITING_POLL_JITTER_MS;
  return WAITING_POLL_INTERVAL_MS + offset;
}

export function canPollWaitingLobby(input: {
  visibilityState: DocumentVisibilityState;
  hasFocus: boolean;
  revealOpen: boolean;
}): boolean {
  return input.visibilityState === 'visible' && input.hasFocus && !input.revealOpen;
}

/** Initial status is intentionally not a completion event. */
export function newlyCompletedMembers(previous: GroupStatus | null, next: GroupStatus): RosterUser[] {
  if (!previous) return [];
  const completeBefore = new Set(previous.members.filter((member) => member.complete).map((member) => member.user));
  return next.members
    .filter((member) => member.complete && !completeBefore.has(member.user))
    .map((member) => member.user);
}

export function waitingNudgeMessage(origin: string): string {
  return `Your trip choices are waiting whenever you’re ready: ${origin}`;
}
