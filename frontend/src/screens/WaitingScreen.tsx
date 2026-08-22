import { useCallback, useEffect, useRef, useState } from 'react';
import type { GroupStatus, RosterUser } from '@lgs/shared';
import danAvatar from '../../../assets/images/dan_cutout.png';
import jamesAvatar from '../../../assets/images/james_cutout.png';
import johnAvatar from '../../../assets/images/john_cutout.png';
import mattAvatar from '../../../assets/images/matt_cutout.png';
import peterAvatar from '../../../assets/images/peter_cutout.png';
import {
  canPollWaitingLobby,
  newlyCompletedMembers,
  waitingNudgeMessage,
  waitingPollDelay,
} from './waitingLobby.js';

type Props = {
  status: GroupStatus;
  user: RosterUser;
  travelerName: (user: RosterUser) => string;
  /** Refreshes the parent-owned safe status DTO. It may resolve without a value. */
  onRefresh: () => Promise<unknown> | unknown;
  onOpenReveal?: () => void;
  onOpenVerdict?: () => void;
  /** Only use after a user-triggered navigation from an actionable state. */
  focusHeading?: number;
};

const travelerArt: Record<RosterUser, string> = {
  dan: danAvatar,
  james: jamesAvatar,
  john: johnAvatar,
  matt: mattAvatar,
  peter: peterAvatar,
};

const memberState = (complete: boolean) => complete ? 'Ready' : 'Still choosing';

/** A completion-only campfire pause. Parent owns all status data and routing. */
export function WaitingScreen({
  status,
  user,
  travelerName,
  onRefresh,
  onOpenReveal,
  onOpenVerdict,
  focusHeading,
}: Props) {
  const previousStatus = useRef<GroupStatus | null>(null);
  const requestInFlight = useRef(false);
  const pollCycle = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [pollingEligible, setPollingEligible] = useState(() =>
    typeof document === 'undefined'
      ? false
      : canPollWaitingLobby({ visibilityState: document.visibilityState, hasFocus: document.hasFocus(), revealOpen: status.revealOpen }),
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [nudgeStatus, setNudgeStatus] = useState('');

  const refreshStatus = useCallback(async (source: 'manual' | 'poll') => {
    if (requestInFlight.current) return false;
    requestInFlight.current = true;
    if (source === 'manual') {
      setIsRefreshing(true);
      setRefreshError('');
    }
    try {
      await onRefresh();
      return true;
    } catch {
      if (source === 'manual') setRefreshError('We couldn’t reach the trail. Your saved choices are safe. Try again in a moment.');
      return false;
    } finally {
      requestInFlight.current = false;
      if (source === 'manual') setIsRefreshing(false);
    }
  }, [onRefresh]);

  useEffect(() => {
    if (focusHeading) headingRef.current?.focus();
  }, [focusHeading]);

  useEffect(() => {
    const syncEligibility = () => {
      setPollingEligible(canPollWaitingLobby({
        visibilityState: document.visibilityState,
        hasFocus: document.hasFocus(),
        revealOpen: status.revealOpen,
      }));
    };
    syncEligibility();
    document.addEventListener('visibilitychange', syncEligibility);
    window.addEventListener('focus', syncEligibility);
    window.addEventListener('blur', syncEligibility);
    return () => {
      document.removeEventListener('visibilitychange', syncEligibility);
      window.removeEventListener('focus', syncEligibility);
      window.removeEventListener('blur', syncEligibility);
    };
  }, [status.revealOpen]);

  useEffect(() => {
    const newlyReady = newlyCompletedMembers(previousStatus.current, status);
    previousStatus.current = status;
    if (newlyReady.length) {
      const mostRecent = newlyReady[newlyReady.length - 1]!;
      const readyCount = status.members.filter((member) => member.complete).length;
      setAnnouncement(`${travelerName(mostRecent)} is ready. ${readyCount} of 5 travelers set.`);
    }
  }, [status, travelerName]);

  useEffect(() => {
    if (!pollingEligible || status.revealOpen) return;
    let active = true;
    const schedulePoll = () => {
      const delay = waitingPollDelay(pollCycle.current++);
      return window.setTimeout(async () => {
        if (!active || !canPollWaitingLobby({
          visibilityState: document.visibilityState,
          hasFocus: document.hasFocus(),
          revealOpen: status.revealOpen,
        })) return;
        await refreshStatus('poll');
        if (active) timer = schedulePoll();
      }, delay);
    };
    let timer = schedulePoll();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [pollingEligible, refreshStatus, status.revealOpen]);

  const copyNudge = async () => {
    const origin = typeof window === 'undefined' ? 'the trip link' : window.location.origin;
    try {
      await navigator.clipboard.writeText(waitingNudgeMessage(origin));
      setNudgeStatus('Nudge copied.');
    } catch {
      setNudgeStatus('Couldn’t copy the nudge. You can share this page’s link instead.');
    }
  };

  const canOpenReveal = status.allComplete && !status.revealOpen && user === 'dan';
  const stateCopy = status.revealOpen
    ? 'The group results are ready.'
    : status.allComplete
      ? (user === 'dan' ? 'Everyone is finished. You can open the group reveal.' : 'Everyone is finished. Dan will open the envelope.')
      : 'Everyone is choosing on their own. The envelope opens after all five people finish.';

  return (
    <main className="one-trip-screen waiting-screen screen-enter" aria-labelledby="waiting-title">
      <section className="waiting-screen__intro">
        <p className="eyebrow">Who’s finished</p>
        <h1 id="waiting-title" ref={headingRef} tabIndex={-1}>You’re done.<br />Here’s who has finished too.</h1>
        <p className="lede" data-testid="group-status">{stateCopy}</p>
      </section>
      <ul className="crew-roster" aria-label="Crew completion status">
        {status.members.map((member) => <li key={member.user} className={`crew-roster__member ${member.complete ? 'is-complete' : 'is-incomplete'}`}>
          <div className="crew-roster__figure" aria-hidden="true">
            <i />
            <img src={travelerArt[member.user]} alt="" />
          </div>
          <div className="crew-roster__nameplate">
            <strong>{travelerName(member.user)}</strong>
            {member.user === user && <span className="crew-roster__you">You</span>}
          </div>
          <p><span className="crew-roster__state-icon" aria-hidden="true">{member.complete ? '✓' : '○'}</span>{memberState(member.complete)}</p>
        </li>)}
      </ul>
      <div className="one-trip-actions">
        <button className="lgs-button lgs-button--secondary" onClick={() => void refreshStatus('manual')} disabled={isRefreshing}>
          {isRefreshing ? 'Checking who’s finished' : 'Check who’s finished'}
        </button>
        <button className="lgs-button lgs-button--secondary" onClick={() => void copyNudge()}>Copy a nudge</button>
        {canOpenReveal && onOpenReveal && <button className="lgs-button lgs-button--primary" onClick={onOpenReveal}>Open the group reveal</button>}
        {status.revealOpen && onOpenVerdict && <button className="lgs-button lgs-button--primary" onClick={onOpenVerdict}>See how the group voted</button>}
      </div>
      {refreshError && <p className="waiting-screen__error" role="alert">{refreshError}</p>}
      <p className="waiting-screen__updated">This page only shows who has finished. Nobody’s picks or rankings are shared here.</p>
      <p className="screen-reader-status" role="status" aria-live="polite">{announcement}</p>
      <p className="screen-reader-status" role="status" aria-live="polite">{nudgeStatus}</p>
    </main>
  );
}
