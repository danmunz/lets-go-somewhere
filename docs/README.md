# Documentation index

Use these documents together; each addresses a different source of truth for **Let's Go Somewhere**.

| Document | Use it for |
| --- | --- |
| [Product specification](spec.md) | Product promise, activity data model, ranking behavior, and reveal requirements. |
| [User journey map](ux.md) | Required V1 participant screens and post-MVP organizer flows. |
| [Architecture overview](architecture.md) | Repository layout, system boundaries, persistence, ranking services, and testing strategy. |
| [Project origins and intent](project-origins-background.md) | The original trip constraints, why destination blindness matters, and reusable product principles. |
| [Design system](design-system.md) | Visual foundations, component contracts, accessibility, and frontend integration rules. |
| [Implementation status](implementation-status.md) | Shipped scope, intentional V3/V4 decisions, and remaining one-trip release gaps. |
| [One-trip delivery roadmap](roadmap.md) | Sprint-by-sprint plan from V1 beta to the actual five-person trip decision. |
| [Content management guide](content-management.md) | Where copy, seed content, media, credits, roster art, and model language live, plus the validation workflow. |
| [One-trip implementation specification](one-trip-implementation-spec.md) | Detailed target contract for the remaining one-shot journey and release gates. |
| [One-trip task board](one-trip-tasks.md) | Dependency-aware implementation tasks and acceptance criteria. |
| [Model evaluation](model-evaluation.md) | Current synthetic evidence and explicit promotion decision for advanced inference. |
| [One-trip operator runbook](one-trip-runbook.md) | Preflight, emulator rehearsal, deployment, reset, recovery, and reveal procedures. |
| [`adr/`](adr/) | Accepted or proposed architectural decisions. |

When a product change affects multiple documents, update them in the same change set. Precedence is: product specification, user journey map, architecture, design system, then project origins (background only). The product specification defines **what** the app must do; the journey map describes **how it should feel and flow**; the architecture describes **where the implementation belongs**.

The implementation-status document does not override those sources of truth; it makes implementation variance and release readiness explicit.
