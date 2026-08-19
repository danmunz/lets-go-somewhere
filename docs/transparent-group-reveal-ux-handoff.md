# Transparent Group Reveal — UX Handoff

**For:** TGR-06 frontend implementation
**Authority:** [transparent group reveal specification](transparent-group-reveal-spec.md), then the design system. This handoff controls composition and behavior only; it does not alter the server tally, stored display mode, insight order, or immutable decision flow.

## Experience intent

The open-envelope moment is a lively, transparent group conversation—not an algorithmic verdict. The individual model has already done its private job. The page now makes the social evidence easy to read: what each traveler liked, where the crew overlaps, and what to discuss next.

Never call a destination “the winner,” “best,” “objective,” “consensus,” or a “group fit.” Use *shared pull*, *shortlist*, *dead heat*, *conversation starter*, and *next place to investigate*. The tally is always explained as the crew’s published top-five ballot.

Use the existing warm, dark, tactile adventure system: `--surface-base`, `--surface-card`, amber for ballot/action, trail blue for evidence/read-the-room, olive for saved decisions, and terra for split/conversation-starter accents. Jost handles all reading copy; reserve uppercase Contrail One for compact section headings and the one hero destination title. Desktop visible body/interface copy is at least 20px; mobile may use 18px only for supporting copy, never controls or rank values.

## Page architecture

At `>= 1024px`, use a full-bleed reveal hero followed by a `min(100% - 48px, 1280px)` content column. Sections have 72px vertical separation. At `640–1023px`, retain the hero and use two/three-column card grids. At `<640px`, stack every content card in reading order; tables receive a labelled horizontal-scroll region instead of compression.

1. **Reveal hero / opening read** — image-led, 640–680px tall on desktop and at least 580px on mobile. The hero must be immediately readable; do not stagger essential words or hide it behind an intro animation.
2. **Always-visible ballot key** — immediately below the hero, before score interpretation. It remains in the normal document flow, not a tooltip or drawer.
3. **Crew scoreboard** — five image-led, equal-weight finalist cards. This is the main shared evidence and must appear before insight narration.
4. **Read the room** — up to three controlled insight cards from the server, rendered as evidence-backed observations.
5. **Everyone’s map** — five full personal top-five cards, one per roster member, with character art and five named destinations.
6. **Rank matrix** — accessible compact evidence table for the published finalist set.
7. **Decision panel** — existing immutable final discussion choice, reworded as a next action rather than a vote rerun.

The detail drawer remains a non-modal fixed/floating sheet triggered by any scoreboard card or matrix row. It contains named post-gate context and the existing travel-effort key; it never changes the ballot order. Escape and the close button return focus to the triggering item.

## Exact content and component behavior

### 1. Opening hero

Use the leading finalist's cover image as a full-bleed backdrop with a high-contrast night gradient. Do **not** label the first ordered item as a winner outside the `broad-leader` mode.

| Stored mode | Eyebrow | H1 | Supporting copy | Visual emphasis |
| --- | --- | --- | --- | --- |
| `broad-leader` | `The envelope is open` | `The crew has a clear shared pull: <Destination>.` | `<N> of 5 travelers placed it in their top five. It leads the crew ballot with <P> points.` | One large cover image, amber point chip, and the supporting travelers’ cutouts. The other four remain directly reachable below. |
| `near-tie`, ordinary | `The envelope is open` | `The crew has a real shortlist.` | `<Destination A> and <Destination B> are separated by <gap> point(s). See how the room reads before calling it.` | Split hero: the two cover images occupy equal halves; two equal point chips; no left/right visual priority. |
| `near-tie`, shared first | `The envelope is open` | `A dead heat.` | `<Destination A> and <Destination B> share first place after the crew’s published tiebreaks.` | Same equal split hero; each card reads `#1 · <P> points`; never visually number one as first and the other second. |
| `no-consensus` | `The envelope is open` | `No automatic consensus—this is a true group decision.` | `Everyone brought a different first instinct. The points table is a conversation starter, not an answer.` | Five small #1 destination tiles with named traveler labels replace a dominant hero destination. No "leader" label. |
| `shared-shortlist` | `The envelope is open` | `Here’s where the crew is leaning.` | `<Destination> leads the published top-five ballot with <P> points. The full shortlist shows the tradeoffs.` | One lead cover; its `#<rank>` and points are factual, not celebratory winner language. |

Hero CTA order: `Explore the shortlist` moves focus/scrolls to the scoreboard; `See my own results` retains the existing personal-results route. In broad/shared modes, selecting the lead photo opens its detail drawer. In no-consensus, each of the five #1 tiles opens its own drawer.

### 2. Always-visible “How points work” key

Place a full-width, amber-edged card directly after the hero. Heading: `How the crew ballot works`. Body: `Each traveler’s personal top five becomes a simple ballot. First place earns 5 points, then 4, 3, 2, and 1. Places outside a traveler’s top five earn 0.`

Render a semantic ordered mini-scale: `#1 — 5 points`, `#2 — 4`, `#3 — 3`, `#4 — 2`, `#5 — 1`, `Outside top five — 0`. Finish with: `Points order the shortlist; they do not decide the trip for you.` Use text and borders, not just colored bars. On desktop this is a six-column row; below 640px it is a 2×3 grid. Add an adjacent text note: `Ties use first-place votes, then how many travelers included the place; a remaining tie stays a tie.`

### 3. Crew scoreboard

Heading: eyebrow `The short list`; H2 `Five places to talk about.` In no-consensus, H2 is `Five different first instincts.`

Render exactly five stored finalists in a responsive grid: five columns at desktop, 3+2 at tablet, two columns then one final full-width card on mobile. All cards are buttons with the destination photo as a darkened backdrop. Use fixed `min-height: 300px` desktop / `236px` mobile; no card gains size from its rank.

Each card contains, in this reading order:

1. `#<displayed rank>` (or `#1 · tied`) in monospace/display type;
2. destination name and country;
3. `<P> points` (large, textual);
4. `<F> first-place vote(s) · <S> top-five supporter(s)`;
5. supporter avatar strip with visually-hidden text, e.g. `Top-five supporters: Dan, John, Matt`.

Hover/focus: 180ms `translateY(-4px)`, amber border, modest photo brightness/saturation increase. No rank-dependent motion. `Enter`/`Space` opens the detail drawer; focus state is a 3px amber outline plus the same image treatment. Make cards consistently discoverable with a visible desktop label `Open place details` that appears on hover/focus and is permanently visible on touch.

### 4. Read-the-room insights

Heading: eyebrow `The room`; H2 `What showed up in the ballot.` Render at most the server-supplied three cards, in supplied order. Use a two/three-column equal card grid. Each card includes a non-decorative leading label/icon, title, body, and the named character avatars supplied by `insight.users`.

Use these controlled visual treatments without altering meaning:

- **Strong/shared destination:** olive top edge; title remains the server title; avatar cluster identifies supporters.
- **Split destination:** terra top edge; prepend the visible kicker `A conversation starter`; show evidence, e.g. `Dan and James placed Oaxaca in their top five; 3 travelers did not.` Never say *polarized*, *penalty*, *failure*, or imply a negative vote.
- **Two camps:** trail-blue top edge; headline `Two trip moods emerged`; show the two named destinations side-by-side inside the card and a labeled supporter group below each. Do not visually divide the crew into opposing teams outside the factual supporter sets.
- **Wild card:** amber top edge; headline `<Name>’s personal wild card`; show the traveler cutout and the named #1 destination with: `A personal favorite worth keeping in the room.` It can reference a place outside the crew’s five finalists.
- **Themes:** use trail-blue (shared) or terra (contrasting); use only server-controlled profile-theme wording. Do not infer motivation from activity choices.

If the server returns no insights, omit the entire section; never render empty-state apologetics.

### 5. Personal top-five cards

Heading: eyebrow `The party’s maps`; H2 `Everyone’s top five.` Supporting text: `Every first place stays visible, even when the crew did not share it.`

Render the fixed five roster members in canonical roster order (Dan, James, John, Matt, Peter), not by group score. Desktop is a five-column lineup; tablet is 3+2; mobile is a single-column, horizontally full card. A card has:

- free-standing 150px–170px transparent traveler cutout, anchored above the upper-right edge with floor/drop shadow; meaningful text heading `<Name>’s map` (append `· you` for current user);
- a 5-row ordered list with `#1`–`#5`, 44px square cover thumbnail, destination name, country, and a `personal wild card` badge only when a matching server insight identifies this person's #1;
- each list row is a 44px-or-larger button which opens that destination drawer; no points shown in personal rows, because these are individual ranks;
- tinted top rule chosen by stable traveler accent; all text meets contrast on the dark surface.

Do not collapse to top three. Do not use a generic avatar when a supplied cutout exists. Decorative image alt is empty because the card heading supplies the person’s identity; where a cutout is the only identity cue, alt must be `<Name>'s traveler character`.

### 6. Finalist-rank matrix

Heading: eyebrow `The evidence`; H2 `How every traveler placed the shared shortlist.` Supporting text: `#1–#5 are personal placements. “Outside top five” means only that the place did not make that traveler’s shortlist—it is not a no vote.`

Use a real `<table>` inside a focusable horizontal-scroll wrapper (`tabindex=0`, `aria-label="Scrollable crew rank table"`) with a visible gradient/fade affordance on narrow screens. Caption: `Each traveler’s personal placement for the five published group finalists.`

Columns: Finalist; Dan; James; John; Matt; Peter. Rows: the five stored finalists in stored order. The first cell is a detail button showing `#<display rank> <name>`; data cells show either `#<rank>` or precisely `Outside top five`—not `6+`. Current user column gets a subtle trail-blue background **and** `(you)` text in its header. In desktop data cells, include the numeric point total under the finalist name only if it does not duplicate visual clutter; never encode rank just by a color scale.

Use row hover to link the row to its corresponding scoreboard card via nonessential outline, and never reorder. Selecting a matrix row opens its detail drawer.

### 7. Final conversation decision

Heading: eyebrow `One last call`; H2 `What should the crew investigate next?` Body: `Choose one place you want to champion, or say you need more research. This records the next conversation step. It does not change anyone’s ballot.`

Keep exactly five stored finalist buttons plus `Need more research`; do not offer non-finalist wild cards as a final-decision option. Button labels: `Champion <Destination>` and `Need more research`. Preserve the native-dialog confirmation. Dialog title: `Lock in your next step?`; body: `This saves what you want the crew to investigate next. It does not rerank the places, and it cannot be edited.`

Saved state: olive keyline and readable status: `Locked in: champion <Destination>.` / `Locked in: need more research.` Then: `Saved after the reveal. This one stays put, even after a refresh.` Use `role=status`; do not treat a saved decision as a completion of group consensus.

## State-specific rules and edge cases

| Preference shape | Required presentation beyond the primary mode |
| --- | --- |
| One clear shared favorite | Broad-leader hero plus scoreboard. Lead photo may be celebratory; never hide four alternatives. |
| Close leaders or exact shared first | Near-tie split hero and equal-card treatment. At exact tie, both receive displayed `#1`; no “runner-up.” |
| Everybody likes different places / no overlap | No-consensus hero shows all five #1 tiles. Scoreboard remains factual; hero explicitly refuses to crown its arithmetic leader. |
| Personal favorite no one else ranked | Wild-card insight and badge in that traveler’s personal card. It remains in their #1 row even if not in the shared scoreboard. |
| Two smaller camps | Two-camps insight side-by-side comparison with labeled avatar groups. Do not derive camps in the browser or recolor the entire page by camp. |
| Loved by some, absent for others | Split-destination insight with actual supporter/outside-top-five evidence. The scoreboard retains its normal published order. |
| No qualifying insight | Omit “Read the room”; scoreboard, personal cards, matrix, and decision remain complete. |
| Photo failure | Keep card dimension and dark gradient; replace image with a text-visible `Photo unavailable` state. Never omit the destination name, points, ranks, or action. |
| Tied fifth cutoff | Render exactly five server-stored finalists. If the fifth has a shared displayed rank, show the shared rank verbatim and do not imply a hidden sixth. |

## Accessibility, motion, and implementation checks

- Use one `h1` in the hero; each primary section has one `h2`; individual traveler/destination cards use `h3` or strong labels without skipping heading hierarchy.
- Maintain AA contrast: `--text-primary` on night surfaces; amber is never body text on white; terra is paired with text/labels, not color-only state. Do not place light text on unmodified photography—always retain the night overlay.
- Every interactive card/row/drawer trigger has button semantics, an accessible name containing the destination, 44px minimum target, and 3px `:focus-visible` outline. Native dialog traps focus and Escape cancels when not saving.
- Support 200% browser zoom without clipping hero CTAs, avatar labels, point values, or the decision panel. Tables scroll rather than shrink below readable text.
- Screen readers announce the result title immediately through the page `h1`; do not use automatic assertive announcements for sequential decorative reveals. The drawer uses `role=region`/`aria-labelledby`; return focus to trigger on close.
- Optional reveal choreography: hero content fade/translate 250ms, scoreboard cards 60ms stagger capped at 300ms total, and insight cards fade in 200ms. All cards are immediately in the DOM and keyboard operable; no sequence delays reading or final decisions.
- Under `prefers-reduced-motion: reduce`, disable fades, staggers, transforms, image zoom, and drawer transitions. Render all hero, scoreboard, insights, personal cards, matrix, and choices immediately. Hover/focus remains a static border/background change.

## Frontend acceptance fixtures

TGR-06 must add/render fixtures for: broad leader; ordinary near tie; exact shared first; no consensus/all-different #1s; shared shortlist; one personal wild card; two camps; split destination; no insights; saved final decision; image fallback; and current-user matrix column. Assertions should confirm the following strings/semantics rather than implementation classes:

- the 5/4/3/2/1/0 key and its explanatory copy are present before the scoreboard;
- exact ties render both names with shared `#1` and no winner phrasing;
- no-consensus shows all five #1 cards and never calls the points leader an answer;
- every member exposes five ordered places; matrix renders `Outside top five`, headers, and caption;
- the decision controls expose only server-stored finalists plus `Need more research`;
- no old normalized score, confidence, consensus/polarization, raw-comparison, or `6+` copy remains.
