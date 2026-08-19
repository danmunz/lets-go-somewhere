import { z } from 'zod';

export const ATTRIBUTE_KEYS = [
  'adventure',
  'nature',
  'culture',
  'food',
  'history',
  'urban',
  'novelty',
  'physicalIntensity',
] as const;

export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];

export const attributesSchema = z.object(
  Object.fromEntries(
    ATTRIBUTE_KEYS.map((key) => [key, z.number().int().min(0).max(5)]),
  ) as Record<AttributeKey, z.ZodNumber>,
);

export const localMediaPathSchema = z
  .string()
  .regex(
    /^\/media\/(?:cards|destinations)\/[a-z0-9/_-]+\.webp$/,
    'Media must be a local opaque or destination-gallery path.',
  );

export const localCardMediaPathSchema = z
  .string()
  .regex(/^\/media\/cards\/[a-z0-9_-]+\.webp$/, 'Comparison media must be an opaque local card path.');

export const photoCreditSchema = z.object({
  path: localMediaPathSchema,
  sourceUrl: z
    .string()
    .url()
    .refine(
      (value) => value.startsWith('https://images.unsplash.com/') || value.startsWith('https://unsplash.com/photos/'),
      'Photo source must be Unsplash.',
    ),
  photographerName: z.string().min(1),
  photographerUrl: z.string().url(),
  alt: z.string().min(12),
});

export const coordinatesSchema = z.object({
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
});

export const activitySchema = z.object({
  id: z.string().min(1),
  destinationId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  imageUrl: z.string().nullable().optional(),
  attributes: attributesSchema,
});

export const destinationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  country: z.string().min(1),
  tagline: z.string().min(1),
  imageUrl: localMediaPathSchema,
  coordinates: coordinatesSchema,
  gallery: z.array(photoCreditSchema).length(3),
  airfare: z.record(z.number()).optional(),
  travelFriction: z.number().int().min(0).max(5),
  novemberWeather: z.string().min(1),
});

export type Activity = z.infer<typeof activitySchema>;
export type Destination = z.infer<typeof destinationSchema>;
export type Attributes = z.infer<typeof attributesSchema>;

export const comparisonSchema = z
  .object({
    activityA: z.string().min(1),
    activityB: z.string().min(1),
    winner: z.string().min(1),
    reason: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.activityA === value.activityB) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Activities must differ' });
    }
    if (value.winner !== value.activityA && value.winner !== value.activityB) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Winner must be offered' });
    }
  });

export type Comparison = z.infer<typeof comparisonSchema>;

/**
 * The only activity shape permitted to cross the blind-comparison boundary.
 * Keep this strict: a field added to Activity must not be made public by an
 * object spread or by assigning Activity directly to a comparison DTO.
 */
export const safeActivitySchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    imageUrl: localCardMediaPathSchema,
  })
  .strict();

export type SafeActivity = z.infer<typeof safeActivitySchema>;

export const BLIND_ACTIVITY_FORBIDDEN_FIELDS = [
  'destinationId',
  'destination',
  'name',
  'country',
  'flag',
  'airportCode',
  'airfare',
  'travelFriction',
  'novemberWeather',
  'coordinates',
  'gallery',
  'photographerName',
  'photographerUrl',
  'sourceUrl',
  'score',
  'preferenceScore',
  'rank',
  'interval',
  'confidence',
  'modelVersion',
  'modelDiagnostics',
  'selectorReason',
] as const;

export type BlindActivityForbiddenField = (typeof BLIND_ACTIVITY_FORBIDDEN_FIELDS)[number];

export const toSafeActivity = (activity: Activity): SafeActivity =>
  safeActivitySchema.parse({
    id: activity.id,
    title: activity.title,
    description: activity.description,
    imageUrl: activity.imageUrl,
  });

export const isSafeActivity = (value: unknown): value is SafeActivity => safeActivitySchema.safeParse(value).success;

export type AtlasDestination = Pick<
  Destination,
  'id' | 'name' | 'country' | 'tagline' | 'novemberWeather' | 'travelFriction' | 'coordinates' | 'gallery'
>;

export const toAtlasDestination = (destination: Destination): AtlasDestination => ({
  id: destination.id,
  name: destination.name,
  country: destination.country,
  tagline: destination.tagline,
  novemberWeather: destination.novemberWeather,
  travelFriction: destination.travelFriction,
  coordinates: destination.coordinates,
  gallery: destination.gallery,
});

// One-trip public contracts. These are additive until the later API tasks
// switch their route builders from the deployed legacy DTOs.
export const ROSTER_USERS = ['dan', 'james', 'john', 'matt', 'peter'] as const;
export const rosterUserSchema = z.enum(ROSTER_USERS);
export type RosterUser = z.infer<typeof rosterUserSchema>;

export const progressPhaseSchema = z.enum(['explore', 'discriminate', 'checking-boundary']);
export const progressSchema = z
  .object({
    comparisons: z.number().int().min(0).max(40),
    minimum: z.literal(24),
    maximum: z.literal(40),
    estimatedCompletion: z.number().min(0).max(1),
    phase: progressPhaseSchema,
  })
  .strict();
export type Progress = z.infer<typeof progressSchema>;

export const completionReasonSchema = z.enum(['stable-top-five', 'maximum-reached', 'portfolio-exhausted']);
export const completionConfidenceLabelSchema = z.enum(['clear-shape', 'close-call']);
export const completionStateSchema = z
  .object({
    complete: z.boolean(),
    reason: completionReasonSchema.optional(),
    confidenceLabel: completionConfidenceLabelSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.complete && !value.reason) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Completed states require a completion reason.' });
    }
    if (!value.complete && (value.reason || value.confidenceLabel)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Incomplete states cannot include completion details.' });
    }
  });
export type CompletionState = z.infer<typeof completionStateSchema>;

export const nextComparisonResponseSchema = z.discriminatedUnion('complete', [
  z
    .object({
      complete: z.literal(false),
      progress: progressSchema,
      activityA: safeActivitySchema,
      activityB: safeActivitySchema,
    })
    .strict(),
  z
    .object({
      complete: z.literal(true),
      completion: completionStateSchema,
    })
    .strict(),
]);
export type NextComparisonResponse = z.infer<typeof nextComparisonResponseSchema>;

export const profileDimensionSchema = z
  .object({
    key: z.enum(ATTRIBUTE_KEYS),
    label: z.string().min(1),
    strength: z.enum(['strong', 'present', 'open']),
    direction: z.enum(['drawn-to', 'less-drawn-to']),
  })
  .strict();
export type ProfileDimension = z.infer<typeof profileDimensionSchema>;

export const profileConfidenceLabelSchema = z.enum(['clear-shape', 'still-emerging']);
export const preferenceProfileSchema = z
  .object({
    headline: z.string().min(1),
    synthesis: z.string().min(1),
    // The specification's honest fallback deliberately permits two dimensions
    // when fewer than three are sufficiently clear.
    dimensions: z.array(profileDimensionSchema).min(2).max(5),
    confidenceLabel: profileConfidenceLabelSchema,
  })
  .strict();
export type PreferenceProfile = z.infer<typeof preferenceProfileSchema>;

export const profileResponseSchema = z
  .object({
    profile: preferenceProfileSchema,
    modelVersion: z.string().min(1),
  })
  .strict();
export type ProfileResponse = z.infer<typeof profileResponseSchema>;

export const rosterCompletionSchema = z
  .object({
    user: rosterUserSchema,
    complete: z.boolean(),
  })
  .strict();

const hasEveryRosterUserExactlyOnce = (members: ReadonlyArray<{ user: RosterUser }>) =>
  members.length === ROSTER_USERS.length && new Set(members.map((member) => member.user)).size === ROSTER_USERS.length;

export const groupStatusSchema = z
  .object({
    revealOpen: z.boolean(),
    allComplete: z.boolean(),
    members: z.array(rosterCompletionSchema).length(ROSTER_USERS.length),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((value, context) => {
    if (!hasEveryRosterUserExactlyOnce(value.members)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Group status must include each roster user exactly once.' });
    }
    if (value.allComplete !== value.members.every((member) => member.complete)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'allComplete must match member completion states.' });
    }
  });
export type GroupStatus = z.infer<typeof groupStatusSchema>;

export const resultConfidenceSchema = z
  .object({
    label: z.enum(['clear-favorite', 'close-call']),
    summary: z.string().min(1),
  })
  .strict();
export type ResultConfidence = z.infer<typeof resultConfidenceSchema>;

export const intervalSchema = z
  .object({
    low: z.number().finite(),
    high: z.number().finite(),
  })
  .strict()
  .refine((value) => value.low <= value.high, 'Interval low must not exceed high.');
export type Interval = z.infer<typeof intervalSchema>;

export const resultContextSchema = z
  .object({
    novemberWeather: z.string().min(1),
    travelFriction: z.number().int().min(1).max(5),
  })
  .strict();

export const personalResultExplanationSchema = z
  .object({
    themes: z.array(z.string().min(1)).min(2).max(4),
    matchedActivityCount: z.number().int().min(0),
    encounteredActivityCount: z.number().int().min(0),
  })
  .strict()
  .refine(
    (value) => value.matchedActivityCount <= value.encounteredActivityCount,
    'Matched activity count cannot exceed encountered activity count.',
  );

export const personalResultSchema = z
  .object({
    rank: z.number().int().min(1).max(5),
    id: z.string().min(1),
    name: z.string().min(1),
    country: z.string().min(1),
    imageUrl: localMediaPathSchema,
    fitLabel: z.enum(['strong-match', 'contender', 'close-call']),
    interval: intervalSchema,
    explanation: personalResultExplanationSchema,
    context: resultContextSchema,
  })
  .strict();
export type PersonalResult = z.infer<typeof personalResultSchema>;

export const groupFinalistSchema = z
  .object({
    rank: z.number().int().min(1).max(5),
    id: z.string().min(1),
    name: z.string().min(1),
    country: z.string().min(1),
    imageUrl: localMediaPathSchema,
    groupScore: z.number().finite(),
    interval: intervalSchema,
    consensus: z.enum(['broad-consensus', 'mixed', 'polarized']),
    context: resultContextSchema,
  })
  .strict();
export type GroupFinalist = z.infer<typeof groupFinalistSchema>;

export const finalistRankSchema = z
  .object({
    user: rosterUserSchema,
    rank: z.union([z.number().int().min(1).max(5), z.literal('6+')]),
  })
  .strict();
export type FinalistRank = z.infer<typeof finalistRankSchema>;

export const memberTopThreeSchema = z
  .object({
    user: rosterUserSchema,
    topThree: z
      .array(
        z
          .object({
            rank: z.union([z.literal(1), z.literal(2), z.literal(3)]),
            id: z.string().min(1),
            name: z.string().min(1),
            imageUrl: localMediaPathSchema,
          })
          .strict(),
      )
      .length(3),
  })
  .strict();

export const insightSchema = z
  .object({
    kind: z.enum(['consensus', 'close-call', 'polarization']),
    title: z.string().min(1),
    body: z.string().min(1),
  })
  .strict();

export const finalDecisionChoiceSchema = z.union([z.literal('need-more-research'), z.string().trim().min(1)]);
export type FinalDecisionChoice = z.infer<typeof finalDecisionChoiceSchema>;

/**
 * Validates the value itself; membership in the immutable group top five is a
 * server-side snapshot check and cannot be expressed in this shared schema.
 */
export const finalDecisionSchema = finalDecisionChoiceSchema;
export const finalDecisionRequestSchema = z.object({ choice: finalDecisionChoiceSchema }).strict();
export const finalDecisionRecordSchema = z
  .object({
    user: rosterUserSchema,
    choice: finalDecisionChoiceSchema,
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();
export type FinalDecision = z.infer<typeof finalDecisionRecordSchema>;

export const personalResultsResponseSchema = z
  .object({
    snapshotId: z.string().min(1),
    modelVersion: z.string().min(1),
    confidence: resultConfidenceSchema,
    profile: preferenceProfileSchema,
    results: z.array(personalResultSchema).length(5),
  })
  .strict();
export type PersonalResultsResponse = z.infer<typeof personalResultsResponseSchema>;

export const groupResultsResponseSchema = z
  .object({
    snapshotId: z.string().min(1),
    modelVersion: z.string().min(1),
    confidence: resultConfidenceSchema,
    group: z.array(groupFinalistSchema).length(5),
    members: z.array(memberTopThreeSchema).length(ROSTER_USERS.length),
    finalistRanks: z
      .array(
        z
          .object({
            destinationId: z.string().min(1),
            ranks: z.array(finalistRankSchema).length(ROSTER_USERS.length),
          })
          .strict(),
      )
      .length(5),
    insights: z.array(insightSchema).max(3),
    decisions: z.array(finalDecisionRecordSchema).max(ROSTER_USERS.length),
  })
  .strict();
export type GroupResultsResponse = z.infer<typeof groupResultsResponseSchema>;

/**
 * Version 2 is the transparent social ballot.  These contracts deliberately
 * live alongside the v1 response during migration: an already-open v1 reveal
 * remains readable, while new reveal creation may only use the v2 snapshot.
 */
export const socialBallotRankSchema = z.union([z.number().int().min(1).max(5), z.literal('outside-top-five')]);
export type SocialBallotRank = z.infer<typeof socialBallotRankSchema>;

const exactlyFiveUniqueIds = (value: readonly string[]) =>
  value.length === 5 && new Set(value).size === 5;

export const socialBallotTopFiveSchema = z
  .array(z.string().min(1))
  .length(5)
  .refine(exactlyFiveUniqueIds, 'A top-five ballot must contain five distinct destination IDs.');

export const socialBallotUserSchema = z
  .object({
    topFive: socialBallotTopFiveSchema,
    // These are controlled labels derived from the existing preference
    // profile, never free-form explanations of an individual comparison.
    profileThemes: z.array(z.string().min(1)).min(1).max(5),
  })
  .strict();
export type SocialBallotUser = z.infer<typeof socialBallotUserSchema>;

export const socialBallotUsersSchema = z
  .object({
    dan: socialBallotUserSchema,
    james: socialBallotUserSchema,
    john: socialBallotUserSchema,
    matt: socialBallotUserSchema,
    peter: socialBallotUserSchema,
  })
  .strict();
export type SocialBallotUsers = z.infer<typeof socialBallotUsersSchema>;

const transparentGroupFinalistFieldsSchema = z
  .object({
    // This is a displayed rank. It may be shared when every published
    // tiebreaker is equal; it is not an ordinal array index.
    rank: z.number().int().min(1).max(5),
    id: z.string().min(1),
    points: z.number().int().min(0).max(25),
    firstPlaceVotes: z.number().int().min(0).max(ROSTER_USERS.length),
    topFiveSupporters: z.array(rosterUserSchema).max(ROSTER_USERS.length),
  })
  .strict();

const validateUniqueSupporters = (value: { topFiveSupporters: readonly RosterUser[] }, context: z.RefinementCtx) => {
  if (new Set(value.topFiveSupporters).size !== value.topFiveSupporters.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Top-five supporters must be unique.' });
  }
};

export const transparentGroupFinalistSchema = transparentGroupFinalistFieldsSchema
  .superRefine((value, context) => {
    validateUniqueSupporters(value, context);
  });
export type TransparentGroupFinalist = z.infer<typeof transparentGroupFinalistSchema>;

export const transparentFinalistRankRowSchema = z
  .object({
    destinationId: z.string().min(1),
    ranks: z
      .array(
        z
          .object({ user: rosterUserSchema, rank: socialBallotRankSchema })
          .strict(),
      )
      .length(ROSTER_USERS.length),
  })
  .strict()
  .superRefine((value, context) => {
    if (!hasEveryRosterUserExactlyOnce(value.ranks)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Each finalist row must include every roster user once.' });
    }
  });
export type TransparentFinalistRankRow = z.infer<typeof transparentFinalistRankRowSchema>;

export const groupDisplayModeSchema = z.enum(['broad-leader', 'near-tie', 'no-consensus', 'shared-shortlist']);
export type GroupDisplayMode = z.infer<typeof groupDisplayModeSchema>;

export const groupInsightSchema = z
  .object({
    kind: z.enum([
      'shared-destination',
      'strong-shared-destination',
      'split-destination',
      'shared-theme',
      'contrasting-themes',
      'two-camps',
      'wild-card',
    ]),
    title: z.string().min(1),
    body: z.string().min(1),
    destinationIds: z.array(z.string().min(1)).min(1).max(2).optional(),
    users: z.array(rosterUserSchema).min(1).max(ROSTER_USERS.length),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.users).size !== value.users.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Insight users must be unique.' });
    }
  });
export type GroupInsight = z.infer<typeof groupInsightSchema>;

export const transparentGroupResultsResponseSchema = z
  .object({
    snapshotId: z.string().min(1),
    modelVersion: z.string().min(1),
    displayMode: groupDisplayModeSchema,
    group: z
      .array(transparentGroupFinalistFieldsSchema.merge(
        z.object({
          name: z.string().min(1),
          country: z.string().min(1),
          imageUrl: localMediaPathSchema,
          context: resultContextSchema,
        }).strict(),
      ).superRefine((value, context) => validateUniqueSupporters(value, context)))
      .length(5),
    members: z
      .array(
        z
          .object({
            user: rosterUserSchema,
            topFive: z
              .array(
                z
                  .object({
                    rank: z.number().int().min(1).max(5),
                    id: z.string().min(1),
                    name: z.string().min(1),
                    imageUrl: localMediaPathSchema,
                  })
                  .strict(),
              )
              .length(5),
          })
          .strict(),
      )
      .length(ROSTER_USERS.length),
    finalistRanks: z.array(transparentFinalistRankRowSchema).length(5),
    insights: z.array(groupInsightSchema).max(3),
    decisions: z.array(finalDecisionRecordSchema).max(ROSTER_USERS.length),
  })
  .strict();
export type TransparentGroupResultsResponse = z.infer<typeof transparentGroupResultsResponseSchema>;

export const modelDiagnosticsSchema = z
  .object({
    converged: z.boolean(),
    iterations: z.number().int().min(0),
    warnings: z.array(z.string().min(1)),
    drawCount: z.number().int().positive(),
  })
  .strict();

const probabilitySchema = z.number().min(0).max(1);

export const persistedDestinationModelSummarySchema = z
  .object({
    id: z.string().min(1),
    interval: intervalSchema,
    topFiveMembershipProbability: probabilitySchema,
    rankOneProbability: probabilitySchema,
    rankFiveBoundaryProbability: probabilitySchema,
  })
  .strict();
export type PersistedDestinationModelSummary = z.infer<typeof persistedDestinationModelSummarySchema>;

export const persistedUserModelSummarySchema = z
  .object({
    topFive: z.array(persistedDestinationModelSummarySchema).length(5),
    topThreeIds: z.array(z.string().min(1)).length(3),
    profile: preferenceProfileSchema,
    confidenceLabel: completionConfidenceLabelSchema,
    diagnostics: modelDiagnosticsSchema,
    // Added after the first deployed snapshot shape. It is optional so an
    // existing immutable snapshot can still be read, but every newly-created
    // reveal must contain it before personal results can be rendered.
    personalResults: z
      .object({
        confidence: resultConfidenceSchema,
        topFive: z
          .array(
            z
              .object({
                rank: z.number().int().min(1).max(5),
                id: z.string().min(1),
                fitLabel: z.enum(['strong-match', 'contender', 'close-call']),
                interval: intervalSchema,
                explanation: personalResultExplanationSchema,
              })
              .strict(),
          )
          .length(5),
      })
      .strict()
      .optional(),
  })
  .strict();
export type PersistedUserModelSummary = z.infer<typeof persistedUserModelSummarySchema>;

export const persistedGroupModelSummarySchema = z
  .object({
    topFive: z
      .array(
        persistedDestinationModelSummarySchema.extend({
          consensus: z.enum(['broad-consensus', 'mixed', 'polarized']),
        }),
      )
      .length(5),
    confidence: resultConfidenceSchema,
    diagnostics: modelDiagnosticsSchema,
  })
  .strict();
export type PersistedGroupModelSummary = z.infer<typeof persistedGroupModelSummarySchema>;

export const resultSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    modelVersion: z.string().min(1),
    seedVersion: z.string().regex(/^[a-f0-9]{64}$/i, 'Seed version must be a SHA-256 digest.'),
    inputDigest: z.string().regex(/^[a-f0-9]{64}$/i, 'Input digest must be a SHA-256 digest.'),
    createdAt: z.string().datetime({ offset: true }),
    users: z.object({
      dan: persistedUserModelSummarySchema,
      james: persistedUserModelSummarySchema,
      john: persistedUserModelSummarySchema,
      matt: persistedUserModelSummarySchema,
      peter: persistedUserModelSummarySchema,
    }),
    group: persistedGroupModelSummarySchema,
  })
  .strict();
export type ResultSnapshot = z.infer<typeof resultSnapshotSchema>;

/** Explicit name for the immutable legacy reader. New snapshots must not use it. */
export const legacyResultSnapshotSchema = resultSnapshotSchema;
export type LegacyResultSnapshot = ResultSnapshot;

export const transparentGroupBallotSchema = z
  .object({
    finalists: z.array(transparentGroupFinalistSchema).length(5),
    finalistRanks: z.array(transparentFinalistRankRowSchema).length(5),
    displayMode: groupDisplayModeSchema,
    insights: z.array(groupInsightSchema).max(3),
  })
  .strict()
  .superRefine((value, context) => {
    const finalistIds = value.finalists.map((finalist) => finalist.id);
    if (new Set(finalistIds).size !== finalistIds.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'A social ballot must store five distinct finalists.' });
    }
    const matrixIds = value.finalistRanks.map((row) => row.destinationId);
    if (matrixIds.length !== finalistIds.length || matrixIds.some((id) => !finalistIds.includes(id))) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Finalist rank rows must exactly match stored finalists.' });
    }
  });
export type TransparentGroupBallot = z.infer<typeof transparentGroupBallotSchema>;

/**
 * The only persisted shape valid for new social-ballot creation.  The legacy
 * v1 reader above is intentionally not part of this creation schema.
 */
export const transparentResultSnapshotSchema = z
  .object({
    schemaVersion: z.literal(2),
    modelVersion: z.string().min(1),
    seedVersion: z.string().regex(/^[a-f0-9]{64}$/i, 'Seed version must be a SHA-256 digest.'),
    inputDigest: z.string().regex(/^[a-f0-9]{64}$/i, 'Input digest must be a SHA-256 digest.'),
    createdAt: z.string().datetime({ offset: true }),
    users: socialBallotUsersSchema,
    group: transparentGroupBallotSchema,
  })
  .strict();
export type TransparentResultSnapshot = z.infer<typeof transparentResultSnapshotSchema>;

/** Reads an immutable snapshot of either era; callers must branch on schemaVersion. */
export const resultSnapshotReaderSchema = z.discriminatedUnion('schemaVersion', [
  legacyResultSnapshotSchema,
  transparentResultSnapshotSchema,
]);
export type VersionedResultSnapshot = z.infer<typeof resultSnapshotReaderSchema>;

/** New snapshot writes are v2-only. */
export const resultSnapshotCreationSchema = transparentResultSnapshotSchema;
export type ResultSnapshotCreation = z.infer<typeof resultSnapshotCreationSchema>;

export const apiErrorCodeSchema = z.enum([
  'unauthorized',
  'forbidden',
  'invalid-request',
  'conflict',
  'completion-required',
  'reveal-locked',
  'not-found',
  'seed-version-mismatch',
  'temporarily-unavailable',
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorSchema = z
  .object({
    code: apiErrorCodeSchema,
    error: z.string().min(1),
  })
  .strict();
export type ApiError = z.infer<typeof apiErrorSchema>;
