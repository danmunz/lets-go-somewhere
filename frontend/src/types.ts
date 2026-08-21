import type {
  AtlasDestination,
  FinalDecision,
  FinalDecisionChoice,
  TransparentGroupResultsResponse,
  GroupStatus,
  NextComparisonResponse,
  PersonalResultsResponse,
  PreferenceProfile,
  ProfileResponse,
  RosterUser,
} from '@lgs/shared';

/**
 * The application state names are deliberately about a traveler’s journey,
 * not a generic account area. OT-18 will make these states resumable.
 */
export type AppScreen =
  | 'welcome'
  | 'character'
  | 'how-it-works'
  | 'comparison'
  | 'completed-transition'
  | 'profile'
  | 'atlas'
  | 'waiting'
  | 'verdict'
  | 'my-results';

export type ApiRequestSource =
  | 'comparison'
  | 'completion'
  | 'profile'
  | 'atlas'
  | 'group-status'
  | 'personal-results'
  | 'group-results'
  | 'final-decision';

export type ApiRouteIntent =
  | 'stay-put'
  | 'return-to-comparison'
  | 'show-waiting'
  | 'show-sign-in'
  | 'show-access-error'
  | 'use-recorded-decision';

export type AtlasResponse = { destinations: AtlasDestination[] };
export type FinalDecisionResponse = { decision: FinalDecision | null; decisions: FinalDecision[] };

export type OneTripApiContracts = {
  nextComparison: NextComparisonResponse;
  profile: ProfileResponse;
  atlas: AtlasResponse;
  groupStatus: GroupStatus;
  personalResults: PersonalResultsResponse;
  groupResults: TransparentGroupResultsResponse;
  finalDecision: FinalDecisionResponse;
};

export type { FinalDecisionChoice, PreferenceProfile, RosterUser };
