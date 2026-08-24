# Let’s Go Somewhere Design System

This is the implementation source of truth for Let’s Go Somewhere’s visual language. It adapts the supplied design-system package for the production repository.

## Foundations

- **Mood:** warm, dark, tactile adventure—not generic travel-tech.
- **Color:** amber is the primary action color; olive means completed/success; terracotta is destructive or cautionary; trail blue is secondary only.
- **Type:** Contrail One for uppercase display headings, Jost for UI and body copy, Nanum Gothic Coding for data and scores.
- **Layout:** 4px spacing grid; generous radii; dark surfaces with white-alpha borders.
- **Accessibility:** primary buttons use dark text on amber; all interactive controls have visible keyboard focus and honor reduced motion.

## Files

- `tokens.css` — design tokens and local `@font-face` declarations.
- `base.css` — reset, defaults, keyboard focus, and reduced-motion behavior.
- `components.css` — CSS contracts for Button, Card, Activity Card, Badge, Progress Bar, Avatar, Toast, and Input.
- `assets/logo.png` — approved product logo. Existing traveler artwork remains in [`../assets/images/`](../assets/images/).
- `assets/fonts/` — local Jost, Contrail One, and Nanum Gothic Coding files with their OFL licenses; no external font request is required.

## Product rules

- Activity cards may use opaque, activity-specific destination photography as an accepted soft geographic cue. They must never reveal destination names, countries, map UI, credits, scores, ranks, or identifiers while the game is in progress. Character art remains limited to roster, progress, waiting, and celebratory UI.
- Use sentence case for labels and CTAs; display headings are uppercase through the display face.
- Keep comparison cards visually symmetric. Never use color, imagery, size, or motion to imply a preferred option.
- Motion is purposeful: 150ms feedback, 250ms component transitions, 400–600ms comparison/reveal transitions. Do not animate essential information only through motion.

## Component contracts

| Component | Required behavior |
| --- | --- |
| Button | 44px minimum hit area; primary uses amber with dark text. |
| Activity Card | Whole card is the control; use button semantics or `aria-pressed`; preserve equal visual weight. |
| Progress Bar | Shows the truthful fixed 32-choice count; it never implies certainty or a hidden adaptive stopping threshold. |
| Avatar | Decorative character imagery gets meaningful alt text only when it conveys participant identity. |
| Toast | Non-blocking status; do not use it for errors that require action. |
| Input | Visible label, error text, and keyboard focus. |
| Round navigation | Round 1's post-completion navigator renders only after all 32 choices. Once its envelope is open it offers an explicit two-option round switcher. Lightning uses a 72px sticky navigator only after its required veto save; its intro, direct cards, and unsaved-veto state use a compact focus header with progress and a Round 1 exit. Full navigators use a 64px header and accessible navigation sheet below 1200px, avoiding a crowded two-round desktop row. Use plain labels, a visible active state, 44px targets, and never surface sealed results or player-switching controls. |

Import `base.css` once at the frontend entry point, then `components.css` where component contracts are needed.
