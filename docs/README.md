# Documentation index

Use these documents together; each addresses a different source of truth for **Let's Go Somewhere**.

| Document | Use it for |
| --- | --- |
| [Product specification](spec.md) | Product promise, activity data model, ranking behavior, and reveal requirements. |
| [User journey map](ux.md) | Required V1 participant screens and post-MVP organizer flows. |
| [Architecture overview](architecture.md) | Repository layout, system boundaries, persistence, ranking services, and testing strategy. |
| [Project origins and intent](project-origins-background.md) | The original trip constraints, why destination blindness matters, and reusable product principles. |
| [Design system](design-system.md) | Visual foundations, component contracts, accessibility, and frontend integration rules. |
| [`adr/`](adr/) | Accepted or proposed architectural decisions. |

When a product change affects multiple documents, update them in the same change set. Precedence is: product specification, user journey map, architecture, design system, then project origins (background only). The product specification defines **what** the app must do; the journey map describes **how it should feel and flow**; the architecture describes **where the implementation belongs**.
