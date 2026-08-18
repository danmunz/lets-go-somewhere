# V1 delivery backlog

| ID | Type | Description | Depends on | Status |
| --- | --- | --- | --- | --- |
| TASK-001 | Foundation | TypeScript workspace, scripts, shared schemas, seed validation | — | Complete |
| TASK-002 | Design | Responsive, accessible comparison/profile/waiting screen contract | — | Complete |
| TASK-003 | Implementation | Deterministic backend ranking, pair selection, stopping, result model | TASK-001 | Complete |
| TASK-004 | Implementation | Presentation-safe HTTP API and local development identity adapter | TASK-001, TASK-003 | Complete |
| TASK-005 | Implementation | Destination-blind React game flow | TASK-002, TASK-004 | Complete |
| TASK-006 | Infrastructure | Local environment template, CI quality workflow, deployment handoff | TASK-001 | Complete |
| TASK-007 | Review | Unit tests, typecheck, build, security/spec/accessibility review | TASK-003–006 | Complete |
| TASK-008 | Deployment | Firebase project, web app, Firestore, Cloud Run, approved roster mapping | TASK-006 | Partial: deployed; Google provider and Firestore persistence remain |

## Critical path

`TASK-001 → TASK-003 → TASK-004 → TASK-005 → TASK-007`.

## Delivery note

TASK-008 deliberately is not implemented: no Firebase project configuration, service account, or approved account mapping is in scope. The local adapter is hard-disabled in production.
