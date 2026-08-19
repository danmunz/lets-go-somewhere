# Let's Go Somewhere — Architecture Overview

This document describes the architecture for **Let's Go Somewhere**, separating the implemented V1 foundation, the committed but unreleased one-trip journey checkpoint, and the remaining release gates.

**Current checkpoint (2026-08-19):** the local source includes the profile, completion-only waiting lobby, immutable v2 transparent social-ballot results, snapshot-bound final decisions, seed-version sealing, emulator configuration, and guarded count-only preflight/reset tooling described by the one-trip specification. The social snapshot is cross-field validated and independently audited; its seven-case Firestore Emulator proof and fixture-based visual review also pass locally. Those safeguards do not prove a production preflight or five-identity browser rehearsal. Production still uses `elo-coverage-v1`; the advanced hierarchical candidate remains offline-only because its OT-19 evaluation is explicitly fail-closed in [model-evaluation.md](model-evaluation.md). Do not infer production promotion from the presence of the model modules or additive DTOs.

The application presents users with repeated destination-blind, pairwise activity choices such as:

> Hike to a ridge overlooking an erupting volcano  
> **vs.**  
> Explore tunnels beneath a historic mountain city

The system uses those choices to infer:

- individual activity preferences;
- broader experience-category preferences;
- individual top-five destination results;
- display-only practical context in V1 (with practical rankings deferred);
- aggregate group preferences.

The architecture is intentionally simple for the MVP while preserving clear seams for more sophisticated ranking models, airfare integrations, admin tooling, richer analytics, and multi-group use later.

The preferred platform is **GitHub + Google Cloud / Firebase**.

## Current implementation boundary

The deployed V1 foundation is intentionally smaller than the aspirational tree below: a React/Vite/TypeScript SPA, a Hono API on Cloud Run, shared Zod contracts, checked-in seed content, Firebase Auth with Google, and Firestore. The large component, route, organizer, and multi-group sketches in this document remain target architecture rather than a claim about current source layout.

The current frontend uses the Firebase Web SDK, MapLibre, NumberFlow, Paper Shaders, and local CSS. It does not use React Router, Tailwind, or Framer Motion. GitHub Actions runs quality checks; it is not the production deployment mechanism.

### One-trip shared contract boundary

`shared/src/index.ts` owns the runtime Zod schemas and inferred types for the one-trip API boundary: destination-blind comparison DTOs, roster/progress/completion state, profile and group-status data, post-reveal results, immutable snapshot summaries, final decisions, and typed API errors. Route handlers remain responsible for intentionally constructing and validating those DTOs; the shared comparison serializer is strict so destination, credit, score, rank, and model fields cannot be introduced through an object spread. These contracts are additive while the current deployed routes retain their legacy DTOs; no unfinished UI is implied by their presence.

The one-trip repository persists the first opened reveal in `lgsV4ResultSnapshots/{snapshotId}` and records that ID in `lgsV4State/reveal` atomically. A v2 snapshot stores the transparent `5/4/3/2/1` tally, personal top fives, matrix, tie state, and evidence-backed social insights; the persisted reader validates those cross-field facts before a result DTO is built. Later reads return the stored document rather than recomputing it. Each `lgsV4FinalDecisions/{rosterUser}` document is a create-once, snapshot-bound discussion stance; reads and repeat writes fail closed if it no longer matches the open snapshot. Valid v1 snapshots remain read-only and return the safe legacy-unavailable state. These repository capabilities do not by themselves authorize a release.

---

## 1. Project Structure

The application should use a single GitHub repository with a lightweight monorepo structure.

```text
lets-go-somewhere/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── character/
│   │   │   │   ├── CharacterCard.tsx
│   │   │   │   ├── CharacterAvatar.tsx
│   │   │   │   ├── CharacterToast.tsx
│   │   │   │   ├── CharacterRoster.tsx
│   │   │   │   └── character.css
│   │   │   ├── comparison/
│   │   │   ├── results/
│   │   │   ├── group/
│   │   │   └── admin/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   └── auth.ts
│   │   ├── auth/
│   │   └── app/
│   ├── public/
│   │   └── media/
│   │       ├── cards/
│   │       └── destinations/
│   ├── tests/
│   └── package.json
├── design-system/
│   ├── tokens.css
│   ├── base.css
│   ├── components.css
│   └── assets/
│
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── groups/
│   │   │   ├── users/
│   │   │   ├── comparisons/
│   │   │   ├── results/
│   │   │   └── admin/
│   │   ├── auth/
│   │   ├── ranking/
│   │   │   ├── model.ts
│   │   │   ├── activityScores.ts
│   │   │   ├── destinationScores.ts
│   │   │   ├── attributeScores.ts
│   │   │   ├── selectPair.ts
│   │   │   └── stoppingRule.ts
│   │   ├── repositories/
│   │   ├── services/
│   │   └── utils/
│   ├── tests/
│   ├── Dockerfile
│   └── package.json
│
├── shared/
│   ├── types/
│   ├── schemas/
│   └── constants/
│
├── seed/
│   ├── destinations.json
│   ├── activities.json
│   └── activity-media.json
│
├── scripts/
│   └── seed-firestore.ts
│
├── docs/
│   ├── adr/
│   ├── README.md
│   ├── architecture.md
│   ├── project-origins-background.md
│   ├── spec.md
│   └── ux.md
│
├── assets/
│   ├── components/
│   ├── images/
│   └── contours.json
│
├── .github/
│   └── workflows/
│       ├── frontend.yml
│       └── backend.yml
│
├── firebase.json
├── AGENTS.md
├── CHANGELOG.md
├── README.md
└── .gitignore
```

The main architectural separation is:

```text
Presentation
    ↓
API
    ↓
Ranking / business logic
    ↓
Persistence
```

The frontend should never contain the canonical ranking algorithm.

### Related documents

- [Product specification](spec.md) defines the data model and product behavior implemented by these components.
- [User journey map](ux.md) defines the screens and states the frontend must support.
- [Project origins and intent](project-origins-background.md) explains the product constraints that inform the architecture.
- [Design system](design-system.md) defines the frontend’s tokens, component contracts, and accessibility baseline.

---

## 2. High-Level System Diagram

```text
                           ┌──────────────────┐
                           │      GitHub      │
                           │ Source + Actions │
                           └────────┬─────────┘
                                    │
                         quality checks / manual release
                                    │
                     ┌──────────────┴──────────────┐
                     ▼                             ▼
             ┌───────────────┐             ┌───────────────┐
             │   Firebase    │             │   Cloud Run   │
             │    Hosting    │             │      API      │
             │               │             │               │
             │ React / Vite  │◄───────────►│ TypeScript    │
             └───────┬───────┘   HTTPS     └───────┬───────┘
                     │                               │
                     │                               │
             ┌───────▼────────┐              ┌──────▼───────┐
             │ Firebase Auth  │              │  Firestore   │
             │ Google OAuth   │              │              │
             └───────┬────────┘              └──────────────┘
                     │
              Firebase ID token
                     │
                     └──────────────► Cloud Run API
```

Typical request flow:

```text
User signs in with Google
        ↓
Firebase Authentication issues ID token
        ↓
Frontend requests next comparison
        ↓
Cloud Run verifies token
        ↓
API loads user's existing choices
        ↓
Ranking engine selects highest-value next pair
        ↓
Frontend displays two destination-blind activities
        ↓
User chooses one
        ↓
Raw comparison is persisted to Firestore
        ↓
Scores are recalculated or updated
```

---

## 3. Core Components

### 3.1 Frontend Web Application

**Name:** Let's Go Somewhere Web App

**Purpose:**  
Provides the complete user-facing experience, including:

- Google sign-in;
- joining a trip group;
- destination-blind activity comparisons;
- progress feedback;
- preference-profile reveal;
- gated individual top-five result;
- display-only practical context after the reveal;
- group results;
- post-MVP organizer/admin functionality.

**Technologies:**

- React
- TypeScript
- Vite
- React Router
- Firebase Web SDK
- Motion / Framer Motion
- Tailwind CSS or similarly lightweight styling

A large client-side state library is not necessary initially.

Server state should preferably be handled through a thin API layer, optionally using TanStack Query if caching/retry behavior becomes useful.

**Deployment:** Firebase Hosting

Firebase Hosting serves the compiled static SPA. Source code remains hosted in GitHub.

---

### 3.2 Authentication

**Name:** Firebase Authentication

**Purpose:**  
Provides persistent user identity across devices and browser sessions.

Initial authentication method:

```text
Continue with Google
```

Google sign-in creates a stable Firebase `uid`, which becomes the canonical application user identifier.

Authentication is separate from group membership.

A signed-in user may eventually participate in multiple trip groups; V1 admits only the fixed five-person roster.

Example:

```text
User
├── Guys Trip 2026
├── Family Vacation
└── Work Offsite
```

**Technology:** Firebase Authentication with Google as OAuth identity provider.

---

### 3.3 Application API

**Name:** Let's Go Somewhere API

**Purpose:**  
Provides the trusted application boundary between the frontend and persistent data.

Responsibilities include:

- verifying user identity;
- authorizing group access;
- reading and writing comparison data;
- selecting the next activity pair;
- calculating user rankings;
- calculating group rankings;
- reading V1 seed-backed destinations and activities (management is post-MVP);
- exposing practical-trip metadata;
- supporting future external integrations.

**Technology:**

- Node.js
- TypeScript
- lightweight HTTP framework such as Hono or Fastify

**Deployment:** Google Cloud Run

Cloud Run is preferred because the backend remains a conventional HTTP application while requiring minimal infrastructure management.

The service may scale to zero when unused.

---

### 3.4 Ranking Engine

**Name:** Preference Ranking Engine

**Purpose:**  
Encapsulates all preference-modeling logic independently from API transport and persistence.

The API should interact with it through interfaces such as:

```ts
rankUser({
  destinations,
  activities,
  comparisons
});
```

and:

```ts
selectNextComparison({
  destinations,
  activities,
  comparisons
});
```

The rest of the application should not depend on the specific ranking algorithm.

This boundary allows the system to move from:

```text
simple Elo / Bradley-Terry
```

to:

```text
hierarchical Bradley-Terry
```

to:

```text
Bayesian preference model
```

without rewriting the frontend or data layer.

#### MVP responsibilities

- score activities;
- aggregate activity scores into destination scores;
- infer activity-category preferences;
- identify uncertain destination relationships;
- select useful next comparisons;
- determine when enough evidence exists to stop.

#### Required one-trip inference responsibilities

Before the actual group run, add:

- confidence intervals;
- hierarchical models;
- Bayesian inference;
- explicit destination and activity latent effects;
- uncertainty-driven information gain;
- model versioning.

---

## 4. Data Stores

### 4.1 Primary Application Database

**Name:** Firestore

**Type:** Google Cloud Firestore

**Purpose:**  
Stores application state, configuration, identity mappings, trip membership, raw preference choices, and derived results.

Firestore fits the MVP because the data is naturally document-oriented and the required query patterns are straightforward.

---

### 4.2 Current V1 Firestore layout

The deployed fixed-roster study uses a deliberately compact layout:

```text
lgsV4Users/{rosterId}
  comparisons: Comparison[]
  pending: [activityId, activityId] | null
  updatedAt: ISO timestamp

lgsV4State/reveal
  open: boolean
  openedAt: ISO timestamp
```

The backend loads destinations, activities, activity-media metadata, coordinates, and galleries from checked-in seed files; they are not Firestore collections. Firebase identities are verified and then mapped to a fixed roster ID. The roster ID—not the Firebase UID—is the persisted V1 key.

### 4.2.1 Future multi-group collection shape

A practical initial structure:

```text
users/{uid}

groups/{groupId}

groups/{groupId}/members/{uid}

destinations/{destinationId}

destinations/{destinationId}/activities/{activityId}

groups/{groupId}/comparisons/{comparisonId}

groups/{groupId}/results/{uid}
```

Alternative collection layouts are acceptable as query requirements emerge.

---

### 4.3 Users

Example:

```json
{
  "uid": "firebase-uid",
  "displayName": "Mike",
  "email": "mike@example.com",
  "photoUrl": "...",
  "createdAt": "..."
}
```

The Firebase `uid` is the canonical user identifier.

---

### 4.4 Groups

Example:

```json
{
  "name": "Guys Trip 2026",
  "startDate": "2026-11-11",
  "endDate": "2026-11-15",
  "ownerUid": "...",
  "activeDestinationIds": [
    "antigua",
    "quito",
    "guanajuato"
  ]
}
```

Groups establish the scope of a particular ranking exercise.

---

### 4.5 Group Membership

Example:

```json
{
  "uid": "...",
  "role": "member",
  "joinedAt": "...",
  "status": "in_progress"
}
```

Supported roles initially:

```text
owner
member
```

More granular roles can be added later if needed.

---

### 4.6 Destinations

Example:

```json
{
  "id": "antigua",
  "name": "Antigua",
  "country": "Guatemala",
  "tagline": "Colonial highland city surrounded by volcanoes",
  "active": true,
  "airfare": {
    "nyc": 450,
    "dc": 475,
    "sfo": 575
  },
  "travelFriction": 2,
  "novemberWeather": "Dry season; mild days and cool nights"
}
```

Practical travel metadata should remain separate from the user's pure preference responses.

---

### 4.7 Activities

Example:

```json
{
  "id": "antigua-volcano-camp",
  "destinationId": "antigua",
  "title": "Camp above the clouds beside an erupting volcano",
  "description": "Hike into the mountains, spend the night on a ridge, and watch a neighboring volcano erupt after dark.",
  "imageUrl": "/media/cards/001.webp",
  "attributes": {
    "adventure": 5,
    "nature": 5,
    "culture": 1,
    "food": 0,
    "history": 0,
    "urban": 0,
    "novelty": 5,
    "physicalIntensity": 5
  }
}
```

Each destination should generally have 5–8 activities.

---

### 4.8 Comparisons

Raw comparison records are the most important analytical data in the system.

Example:

```json
{
  "userId": "firebase-uid",
  "groupId": "guys-trip-2026",
  "activityA": "antigua-volcano-camp",
  "activityB": "quito-ridge",
  "winner": "antigua-volcano-camp",
  "shownAt": "...",
  "answeredAt": "...",
  "modelVersion": "1"
}
```

**Raw comparisons are canonical.**

Calculated rankings are derived data.

This is critical because future model improvements should be able to rerun historical comparisons without asking users to complete the exercise again.

---

### 4.9 Derived Results

Results may be cached for performance:

```json
{
  "userId": "...",
  "groupId": "...",
  "modelVersion": "1",
  "comparisonCount": 27,
  "destinationScores": {
    "antigua": 0.92,
    "quito": 0.87,
    "guanajuato": 0.82
  },
  "attributeScores": {
    "adventure": 1.4,
    "history": 0.8,
    "food": 0.3
  },
  "completed": true,
  "updatedAt": "..."
}
```

These records should always be reconstructable from raw comparisons.

---

## 5. Authentication and Authorization

### 5.1 Authentication Flow

```text
User visits application
        ↓
Continue with Google
        ↓
Firebase Authentication
        ↓
Firebase issues ID token
        ↓
Frontend sends token with API request
```

API requests include:

```http
Authorization: Bearer <firebase-id-token>
```

Cloud Run verifies the ID token using the Firebase Admin SDK.

Conceptually:

```ts
const decoded = await admin.auth().verifyIdToken(token);
const userId = decoded.uid;
```

The API should trust the verified `uid`, not user identifiers supplied independently by the browser.

---

### 5.2 Group Join Flow

Authentication and trip membership are separate.

For V1, there is one fixed five-person roster: Dan, John, Matt, Peter, and James. Google-authenticated users are mapped to their assigned roster profile; group creation, multiple groups, and multiple administrators are post-MVP concerns.

Example:

```text
/trips/8FY3K/join
```

Flow:

```text
Open group invite
        ↓
Authenticate with Google if needed
        ↓
API validates invitation
        ↓
Create group membership
        ↓
Redirect to comparison experience
```

The membership model can support multiple groups later, but V1 does not expose that capability.

---

### 5.3 Authorization

Authorization is enforced by the Cloud Run API.

Examples:

A `member` may:

- complete comparisons;
- view their results;
- view group results when permitted.

An `owner` may additionally:

- edit destinations;
- edit activities;
- manage participants;
- update trip metadata;
- reset results;
- control group visibility.

The frontend may hide unauthorized controls, but frontend checks are not considered security boundaries.

---

## 6. API Surface

### Current deployed V1 routes

```text
GET  /v1/session
GET  /v1/comparison/next
POST /v1/comparisons
GET  /v1/profile
GET  /v1/atlas
GET  /v1/group-status
POST /v1/reveal
GET  /v1/results/me
GET  /v1/results/group
GET  /v1/final-decision
POST /v1/final-decision
```

`/v1/profile`, `/v1/group-status`, and `/v1/results/me` are implemented backend contracts with local frontend payoff surfaces in the one-trip checkpoint. Comparison responses expose only activity ID, title, description, and opaque local card image path. Atlas and result routes are completion/reveal gated as appropriate. These surfaces are not yet a production release claim until the model, emulator/E2E, visual QA, and deployment gates pass.

`POST /v1/reveal` creates (or returns) the one immutable result snapshot. `GET /v1/results/group` reads that stored snapshot rather than recalculating live comparisons; it exposes only post-reveal finalists, qualitative insight copy, member top threes, ranks on those finalists, and recorded discussion stances. `POST /v1/final-decision` accepts one snapshot-finalist ID or `need-more-research` and is create-once: repeat submissions return `409` with the existing public decision. `GET /v1/final-decision` returns the caller’s decision plus the post-reveal roster summary. Neither endpoint exposes raw comparisons, posterior covariance, or activity-by-activity votes.

### Target multi-group API surface

Initial API design might include:

```text
GET  /me

GET  /groups/:groupId
POST /groups/:groupId/join

GET  /groups/:groupId/comparison/next
POST /groups/:groupId/comparisons

GET  /groups/:groupId/results/me
GET  /groups/:groupId/results

GET  /groups/:groupId/destinations

POST   /groups/:groupId/admin/destinations
PUT    /groups/:groupId/admin/destinations/:destinationId
DELETE /groups/:groupId/admin/destinations/:destinationId

POST   /groups/:groupId/admin/activities
PUT    /groups/:groupId/admin/activities/:activityId
DELETE /groups/:groupId/admin/activities/:activityId
```

The exact REST structure may change, but the frontend should access it through a centralized client rather than directly coupling pages to fetch calls.

---

## 7. Core Comparison Flow

### Request next comparison

```text
GET /groups/:id/comparison/next
```

Backend:

1. Verify Firebase token.
2. Confirm user belongs to group.
3. Load active destinations.
4. Load associated activities.
5. Load user's prior comparisons.
6. Run ranking model.
7. Determine whether the stopping condition is met.
8. If not complete, select highest-value next pair.
9. Return presentation-safe activity data.

Example response:

```json
{
  "progress": {
    "comparisons": 18,
    "estimatedCompletion": 0.7
  },
  "activityA": {
    "id": "a1",
    "title": "Camp above the clouds beside an erupting volcano",
    "description": "..."
  },
  "activityB": {
    "id": "b7",
    "title": "Explore tunnels beneath a colorful historic city",
    "description": "..."
  }
}
```

Destination IDs should not be exposed unnecessarily on the comparison screen.

---

### Submit comparison

```text
POST /groups/:id/comparisons
```

Example:

```json
{
  "activityA": "a1",
  "activityB": "b7",
  "winner": "a1"
}
```

Backend:

1. Authenticate user.
2. Validate both activities.
3. Validate that pair was actually offered.
4. Persist choice.
5. Recalculate or invalidate cached results.
6. Select next state.

The API may immediately return the next pair to reduce round trips.

---

## 8. Ranking Architecture

The ranking implementation should be treated as its own domain module.

```text
backend/src/ranking/
├── model.ts
├── scoreActivities.ts
├── scoreDestinations.ts
├── scoreAttributes.ts
├── selectPair.ts
├── stoppingRule.ts
└── versions/
    ├── v1.ts
    └── v2.ts
```

### V1

A practical initial approach:

```text
Pairwise choices
      ↓
Bradley-Terry / Elo-like activity scores
      ↓
Aggregate activities by destination
      ↓
Destination preference scores
```

Separately:

```text
Winning activity attributes
       -
Losing activity attributes
       ↓
User experience-category preferences
```

---

### Required one-trip inference upgrade

Conceptually:

```text
Utility(activity)
=
destination effect
+
activity effect
+
Σ(user category preference × activity attribute)
```

Pairwise probability:

```text
P(A wins)
=
exp(U(A))
/
(exp(U(A)) + exp(U(B)))
```

This model is required before the fixed roster makes its one-shot trip decision. It should retain a versioned deterministic baseline for replay, but production selection and results must use calibrated uncertainty rather than raw Elo-style scores alone.

---

## 9. Adaptive Comparison Selection

The system should not sample random pairs indefinitely.

The current coverage heuristic is a deployed foundation. Before the actual group run, it must be replaced with the information-gain policy and confidence-aware bounded stopping contract in [the one-trip roadmap](roadmap.md).

For every candidate pair, calculate an approximate information value.

Conceptually:

```text
comparisonValue
=
uncertainty
× destinationImportance
× coverageNeed
× novelty
```

Prefer comparisons where:

- predicted outcome is close to 50/50;
- destination rankings remain uncertain;
- one or both activities lack observations;
- the comparison distinguishes between similar preferences.

Avoid comparisons where:

- the exact pair has already appeared;
- one activity overwhelmingly dominates;
- both destinations are confidently irrelevant;
- the pair is redundant.

The selection policy should be encapsulated entirely within `selectPair.ts`.

---

## 10. Pure Preference and Practical Context

The system should preserve two distinct concepts.

### Pure preference

Answers:

> What destination bundle best matches the experiences this user actually wants?

Based only on activity choices.

### Practical context (V1)

V1 shows approximate, curated airfare, weather, and friction notes alongside revealed finalists. It does not compute a practical score or a second ranking because the current logistics data is not sufficiently complete or fresh.

The eventual practical-ranking extension would look like:

```text
Preference Model
        ↓
Pure Destination Score
        │
        ├── Airfare
        ├── Travel friction
        ├── Weather
        └── Trip-length suitability
                    ↓
            Practical Trip Score
```

Practical factors should not contaminate destination-blind comparison questions.

---

## 11. Group Reveal Tally

The individual inference engine produces each roster member's ordered top five.
The immutable reveal snapshot converts those five ballots into the sole group
ordering: rank one through five receive `5, 4, 3, 2, 1` points and every other
destination receives zero. The API persists each finalist's point total,
first-place count, top-five supporters, the visible per-member placements, and
evidence-backed social insights. Equal totals resolve by first-place votes,
then top-five appearances; otherwise the shared rank is retained.

This boundary is intentional: individual Bayesian/uncertainty-aware modeling
is retained for efficient personal preference elicitation, while the group
result is a readable social ballot rather than normalized utility aggregation,
variance, or a polarization penalty.

---

## 12. External Integrations / APIs

### Firebase Authentication

**Purpose:** Google OAuth and persistent user identity.

**Integration:** Firebase Web SDK + Firebase Admin SDK.

---

### Future airfare provider

Not required for MVP.

Potential capability:

```text
Scheduled airfare refresh
        ↓
Flight API
        ↓
Normalize prices by origin
        ↓
Store snapshot
        ↓
Practical ranking
```

Airfare data should be treated as externally sourced and time-sensitive.

---

### Explicitly out-of-scope AI services

These are not needed for the fixed trip:

- generate activity descriptions;
- normalize activity tone;
- identify duplicate activities;
- suggest experience attributes;
- generate group-result explanations;
- generate destination-blind illustrations.

These functions should live behind backend service abstractions rather than be called directly from the browser.

---

## 13. Deployment & Infrastructure

**Cloud Provider:** Google Cloud / Firebase

**Key services:**

- Firebase Hosting
- Firebase Authentication
- Cloud Run
- Firestore

Potential future services:

- Cloud Storage
- Cloud Scheduler
- Cloud Run Jobs
- Secret Manager
- Cloud Logging
- Firebase App Check

---

### CI/CD

GitHub Actions should manage deployments.

Suggested flow:

```text
Pull Request
    ↓
lint
type-check
unit tests
build
```

On merge to `main`:

```text
frontend build
      ↓
Firebase Hosting deploy

backend build
      ↓
Docker container
      ↓
Cloud Run deploy
```

Production secrets should not be stored in GitHub source.

Use GitHub Actions secrets and preferably workload identity federation / Google-managed credentials for deployments.

---

## 14. Monitoring & Logging

MVP requirements are small.

Use:

- Cloud Run request logs;
- Cloud Logging;
- structured application logs;
- Firebase Hosting analytics if useful;
- frontend error reporting optionally later.

Important backend events should include:

```text
group_created
group_joined
comparison_served
comparison_answered
ranking_completed
ranking_failed
admin_destination_updated
```

Do not log Firebase ID tokens or sensitive authentication material.

---

## 15. Security Considerations

### Authentication

Firebase Authentication using Google OAuth.

### Authorization

Application-level group RBAC enforced by Cloud Run.

### Transport

HTTPS for all browser/API traffic.

### Database access

The browser should generally access application data through Cloud Run rather than directly manipulating Firestore.

This keeps:

- ranking logic;
- authorization;
- validation;
- model internals

inside a trusted backend boundary.

### Secrets

API keys and external-service credentials should be stored in Secret Manager or secured deployment configuration.

Never embed privileged credentials in frontend code.

### Data minimization

The application requires little personal information.

Store only what is useful:

- Firebase uid;
- display name;
- email;
- profile picture URL;
- group membership;
- comparison history.

Avoid unnecessary user-profile data.

---

## 16. Development & Testing Environment

### Local development

Recommended local services:

```text
Frontend
Vite dev server
        │
        ▼
Local backend
        │
        ▼
Firebase Emulator Suite
```

Use Firebase emulators where practical for:

- Authentication;
- Firestore.

The backend can run locally through Node or Docker.

---

### Testing

Suggested tools:

**Frontend**

- Vitest
- React Testing Library

**Backend**

- Vitest
- Supertest or framework equivalent

**End-to-end**

- Playwright

**Code quality**

- ESLint
- Prettier
- TypeScript strict mode

---

### High-priority ranking tests

Ranking logic deserves particularly strong automated coverage.

Test cases should include:

- deterministic pair selections from fixed seeds;
- obvious preference orderings;
- repeated activity appearances;
- cycles such as `A > B > C > A`;
- destination addition/removal;
- incomplete user sessions;
- score normalization;
- group polarization;
- model version migration.

---

## 17. Seed Data and Content Management

MVP destination/activity data should remain version-controlled.

```text
seed/
├── destinations.json
└── activities.json
```

A script populates Firestore:

```text
npm run seed
```

Benefits:

- easy review through GitHub;
- reproducible environments;
- straightforward rollback;
- clean initial content authoring workflow.

Once the admin UI matures, Firestore may become the primary operational source.

Seed files can remain useful for fixtures and development environments.

---

## 18. Image Storage

### MVP

Activity comparisons may include an opaque local destination-photo asset as an intentionally accepted soft visual cue. The comparison-safe payload must exclude destination IDs, names, countries, coordinates, ranks, scores, gallery data, and photo-credit metadata. Coordinates and credited galleries are atlas-only fields, available after completion.

### Out of scope for this trip

If organizers can create or upload their own activities:

```text
Cloud Storage
      ↓
activity.imageUrl
```

The activity data model already supports this migration.

---

## 19. Scaling Characteristics

The architecture is deliberately optimized for simplicity rather than massive scale, but every major component can scale substantially without redesign.

### Frontend

Firebase Hosting serves static assets through Google's infrastructure.

### Backend

Cloud Run automatically scales stateless API containers.

### Database

Firestore supports substantially more traffic than this application initially requires.

### Ranking

For a small number of destinations, ranking calculations can occur synchronously inside API requests.

For example:

```text
24 destinations
×
5 activities
≈
120 activities
```

Even though many theoretical pairs exist, only a small subset needs evaluation.

If generalized usage eventually makes inference computationally expensive, the ranking interface permits migration to:

- background jobs;
- cached model state;
- Python numerical service;
- Pub/Sub-driven processing

without changing frontend behavior.

Do not introduce those components preemptively.

---

## 20. Architectural Principles

### Keep the frontend dumb about ranking

The browser presents experiences and results.

It does not determine which comparison comes next or calculate authoritative rankings.

### Raw choices are permanent; scores are disposable

Persist:

```text
A vs. B → A
```

Everything else can be regenerated.

### Model versions are explicit

Every calculated result should identify the ranking model version.

```json
{
  "modelVersion": "1"
}
```

This allows historical results to be recomputed later.

### Practical constraints remain separate from psychological preference

Do not let airfare or destination recognition contaminate the destination-blind preference experiment.

### Prefer managed services

This project does not need Kubernetes, Redis, Kafka, or multiple microservices.

Start with:

```text
Firebase Hosting
Firebase Auth
Cloud Run
Firestore
```

Add infrastructure only when a demonstrated requirement justifies it.

---

## 21. One-trip completion boundary

### V1

- Google sign-in
- persistent users
- one fixed five-person trip roster
- destination-blind pairwise comparisons
- adaptive comparison selection
- activity scoring
- destination scoring
- experience-category preferences
- gated individual top-five results
- group rankings

### Required before the actual trip

- hierarchical or regularized preference model;
- calibrated uncertainty intervals;
- information-gain comparison selection and a confidence-aware bounded stopping rule;
- versioned result snapshots, deterministic simulations, Firestore-emulator, and five-person E2E rehearsal.

### Explicitly out of scope

- multiple trips, organizer workflows, invitations, and content-editing UI;
- live airfare or travel-time integration and a second practical ranking;
- public sharing, exports, and generalized analytics.

### Optional later extraction

If ranking becomes computationally sophisticated:

```text
Cloud Run API
       │
       ▼
Dedicated Ranking Service
Python / numerical stack
```

The current ranking-module interface is intended to make this optional extraction straightforward.

---

## 22. Technology Decisions

| Concern | Choice | Rationale |
|---|---|---|
| Source control | GitHub | Preferred development environment and CI/CD source |
| Frontend | React + Vite + TypeScript | Simple static SPA; no SSR requirement |
| Frontend hosting | Firebase Hosting | Natural fit with Firebase/GCP stack |
| Authentication | Firebase Auth + Google | Persistent user identity with minimal custom auth code |
| Backend | TypeScript HTTP API | Shared language/types with frontend |
| Backend hosting | Cloud Run | Managed, conventional server runtime, scale-to-zero |
| Database | Firestore | Simple document-oriented application state |
| Initial activity imagery | Opaque local activity-specific photo | A deliberately accepted soft cue; all explicit geographic metadata stays embargoed |
| Future user-authored images | Cloud Storage or static hosting | Post-MVP; current curated media is locally hosted and credit-validated |
| CI/CD | GitHub Actions | Natural GitHub integration |
| Ranking | Isolated domain module | Allows algorithms to evolve independently |
| Source of truth | Raw comparisons | Allows complete model recomputation |

---

## 23. Explicit Non-Goals for MVP

Do not initially build:

- microservices;
- Kubernetes;
- GraphQL;
- Redis;
- event streaming;
- a dedicated analytics warehouse;
- custom OAuth infrastructure;
- native mobile applications;
- server-side rendered frontend;
- complex real-time synchronization;
- direct client-controlled Firestore business logic.
- self-serve trip creation, organizer content management, or multi-group administration.

These can be reconsidered only if actual requirements emerge.

---

## 24. Project Identification

**Project Name:** Let's Go Somewhere

**Repository:** `lets-go-somewhere`

**Primary Platform:** Google Cloud / Firebase

**Initial Use Case:** Five-person group selecting a Nov. 11–15, 2026 guys trip through destination-blind activity preferences.

**Architecture Status:** Proposed

**Last Updated:** 2026-08-17

---

## 25. Glossary

**Activity**  
A destination-blind experience shown to users during pairwise comparison.

**Attribute**  
A characteristic attached to an activity, such as adventure, history, food, nature, or urban exploration.

**Comparison**  
A user's choice between two activities.

**Destination Score**  
An inferred measure of how strongly a user's activity choices support a destination.

**Pure Preference Ranking**  
Destination ranking derived only from destination-blind experience choices.

**Practical Ranking**  
Destination ranking adjusted for real-world constraints such as airfare, travel friction, weather, and trip length.

**Group**  
A set of users participating in the same destination-selection exercise.

**Ranking Engine**  
The isolated application module responsible for scoring preferences, selecting comparisons, and determining completion.

**Model Version**  
Identifier for the specific ranking algorithm used to compute a result.

**Travel Friction**  
A practical measure of logistical difficulty such as flight duration, layovers, transfers, and ground travel.
