# OT-17 visual QA fixtures

Run these after the app-shell route integration (OT-18), at 1440px and 390px widths.

| Fixture | Required evidence |
| --- | --- |
| Atlas — successful map | All 24 destinations are represented by high-contrast pins or clusters; map/list/drawer selection stays synchronized; MapLibre attribution is readable. |
| Atlas — tile/WebGL fallback | “The map took the scenic route.” is visible with **Try map again**, OpenFreeMap/OpenStreetMap attribution, the full named destination list, and the selected gallery/drawer. |
| Atlas — failed gallery image | Image frame retains its dimensions and uses the warm editorial placeholder; adjacent destination detail and credit remain usable. |
| Group result while sealed | A 423 response enters the waiting lobby with the envelope-sealed copy, never a blank/error result screen. |
| Motion | `prefers-reduced-motion: reduce` removes animated map flight/loader treatment while state and text remain available. |
| Desktop font floor | Run `auditVisualAccessibility` against visible text/control measurements; no desktop visible app text, map labels, credits, or attribution is under 20px. |
| Mobile targets/focus | Run the same audit at 390px; controls are at least 44×44px and keyboard focus is visible. |

The source-level policy and unit tests live in `frontend/src/visualAccessibility.ts` and `frontend/src/visualAccessibility.test.ts`. The final browser-harness artifact belongs to OT-24/OT-25, after the scaffold is composed into `main.tsx`.
