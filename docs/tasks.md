# V1 delivery backlog — historical baseline

The original V1 delivery backlog is complete. Current, unresolved product work is maintained in [implementation status](implementation-status.md) and [the sprint roadmap](roadmap.md).

| ID | Type | Description | Status |
| --- | --- | --- | --- |
| TASK-001 | Foundation | TypeScript workspace, shared schemas, seed validation | Complete |
| TASK-002 | Design | Responsive, accessible participant-screen contract | Complete; later refined in V3/V4 |
| TASK-003 | Implementation | Deterministic ranking, pair selection, stopping, result model | Complete |
| TASK-004 | Implementation | Presentation-safe API and local development adapter | Complete |
| TASK-005 | Implementation | Destination-blind React game flow | Complete; V1 completion UX remains tracked separately |
| TASK-006 | Infrastructure | CI quality workflow and deployment handoff | Complete |
| TASK-007 | Review | Unit tests, typecheck, build, security/spec/accessibility review | Complete; Firestore/E2E hardening remains |
| TASK-008 | Deployment | Firebase, Auth, Firestore, Cloud Run, approved roster mapping | Complete and deployed |

## Critical path

`TASK-001 → TASK-003 → TASK-004 → TASK-005 → TASK-007 → TASK-008`.

This table is retained for delivery history. It must not be used as the current release-readiness checklist.
