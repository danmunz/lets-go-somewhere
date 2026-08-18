import {
  comparisonSchema,
  finalDecisionRecordSchema,
  finalDecisionRequestSchema,
  groupResultsResponseSchema,
  groupStatusSchema,
  nextComparisonResponseSchema,
  personalResultsResponseSchema,
  profileResponseSchema,
  rosterUserSchema,
  type FinalDecision,
  type FinalDecisionChoice,
  type GroupResultsResponse,
  type GroupStatus,
  type NextComparisonResponse,
  type PersonalResultsResponse,
  type ProfileResponse,
  type RosterUser,
} from '@lgs/shared';
import type { ApiRequestSource, ApiRouteIntent, AtlasResponse, FinalDecisionResponse } from './types.js';

type ResponseParser<T> = { parse(value: unknown): T };
type FetchLike = typeof fetch;

export type ApiAuthentication = { user: RosterUser; token?: string };
export type SessionResponse = { user: RosterUser; roster: RosterUser[] };

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

const messageFromPayload = (payload: unknown) =>
  typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string'
    ? payload.error
    : 'Something went wrong. Please try again.';

const readPayload = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return undefined;
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

/**
 * Centralizes API failure behavior so route components never infer gate state
 * from missing result data. A 409 has different meaning for an incomplete
 * traveler and an already-recorded immutable decision, hence the source.
 */
export function routeIntentForApiError(error: ApiError, source: ApiRequestSource): ApiRouteIntent {
  if (error.status === 401) return 'show-sign-in';
  if (error.status === 403) return 'show-access-error';
  if (error.status === 423) return 'show-waiting';
  if (error.status === 409 && source === 'final-decision') return 'use-recorded-decision';
  if (error.status === 409 && ['completion', 'profile', 'atlas', 'personal-results'].includes(source)) {
    return 'return-to-comparison';
  }
  return 'stay-put';
}

export function createApiClient(authentication: ApiAuthentication, fetchImpl: FetchLike = fetch) {
  const request = async <T>(path: string, parser: ResponseParser<T>, init?: RequestInit): Promise<T> => {
    const headers = new Headers(init?.headers);
    headers.set('Accept', 'application/json');
    headers.set('Content-Type', 'application/json');
    headers.set(
      authentication.token ? 'Authorization' : 'X-Demo-User',
      authentication.token ? `Bearer ${authentication.token}` : authentication.user,
    );

    const response = await fetchImpl(path, { ...init, headers });
    const payload = await readPayload(response);
    if (!response.ok) throw new ApiError(response.status, messageFromPayload(payload), payload);
    return parser.parse(payload);
  };

  return {
    getSession: () => request('/v1/session', sessionResponseParser),
    getNextComparison: () => request('/v1/comparison/next', nextComparisonResponseSchema),
    submitComparison: (comparison: { activityA: string; activityB: string; winner: string }) =>
      request('/v1/comparisons', acceptedComparisonParser, {
        method: 'POST',
        body: JSON.stringify(comparisonSchema.parse(comparison)),
      }),
    getProfile: () => request('/v1/profile', profileResponseSchema),
    getAtlas: () => request('/v1/atlas', atlasResponseParser),
    getGroupStatus: () => request('/v1/group-status', groupStatusSchema),
    getPersonalResults: () => request('/v1/results/me', personalResultsResponseSchema),
    getGroupResults: () => request('/v1/results/group', groupResultsResponseSchema),
    getFinalDecision: () => request('/v1/final-decision', finalDecisionResponseParser),
    openReveal: () => request('/v1/reveal', revealResponseParser, { method: 'POST' }),
    recordFinalDecision: (choice: FinalDecisionChoice) =>
      request('/v1/final-decision', finalDecisionResponseParser, {
        method: 'POST',
        body: JSON.stringify(finalDecisionRequestSchema.parse({ choice })),
      }),
  };
}

const atlasDestinationParser = {
  parse(value: unknown): AtlasResponse {
    if (!value || typeof value !== 'object' || !Array.isArray((value as { destinations?: unknown }).destinations)) {
      throw new Error('The atlas response was not valid.');
    }
    // The atlas remains completion-gated at the route. This local parser keeps
    // its data boundary explicit without duplicating the shared destination schema.
    return value as AtlasResponse;
  },
};

const atlasResponseParser = atlasDestinationParser;

const finalDecisionResponseParser = {
  parse(value: unknown): FinalDecisionResponse {
    if (!value || typeof value !== 'object') throw new Error('The decision response was not valid.');
    const response = value as { decision?: unknown; decisions?: unknown };
    return {
      decision: response.decision === null || response.decision === undefined ? null : finalDecisionRecordSchema.parse(response.decision),
      decisions: Array.isArray(response.decisions) ? response.decisions.map((decision) => finalDecisionRecordSchema.parse(decision)) : [],
    };
  },
};

const sessionResponseParser = {
  parse(value: unknown): SessionResponse {
    if (!value || typeof value !== 'object') throw new Error('The session response was not valid.');
    const record = value as { user?: unknown; roster?: unknown };
    return {
      user: rosterUserSchema.parse(record.user),
      roster: Array.isArray(record.roster) ? record.roster.map((user) => rosterUserSchema.parse(user)) : [],
    };
  },
};

const acceptedComparisonParser = {
  parse(value: unknown): { accepted: true } {
    if (!value || typeof value !== 'object' || (value as { accepted?: unknown }).accepted !== true) {
      throw new Error('The choice was not accepted.');
    }
    return { accepted: true };
  },
};

const revealResponseParser = {
  parse(value: unknown): { revealOpen: true; snapshotId: string } {
    if (!value || typeof value !== 'object') throw new Error('The reveal response was not valid.');
    const response = value as { revealOpen?: unknown; snapshotId?: unknown };
    if (response.revealOpen !== true || typeof response.snapshotId !== 'string') throw new Error('The reveal response was not valid.');
    return { revealOpen: true, snapshotId: response.snapshotId };
  },
};

export type OneTripApiClient = ReturnType<typeof createApiClient>;
export type {
  FinalDecision,
  GroupResultsResponse,
  GroupStatus,
  NextComparisonResponse,
  PersonalResultsResponse,
  ProfileResponse,
};

// Retain a runtime roster parser at this boundary for future session bootstrap.
export const parseRosterUser = (value: unknown) => rosterUserSchema.parse(value);
