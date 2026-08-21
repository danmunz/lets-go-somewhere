# One-trip UX handoff — completed traveler through final call

> **Historical handoff:** the “final call” decision interaction was retired on 2026-08-21. The current user journey ends with the shared reveal and an off-app group conversation.

**Task:** OT-01  
**Status:** Ready for implementation  
**Companion documents:** [one-trip implementation specification](one-trip-implementation-spec.md), [user journey](ux.md), [design system](design-system.md), and [roadmap](roadmap.md).

## 1. Product and visual guardrails

This is the conclusion of one shared adventure, not an account area or a travel-dashboard product. Preserve the existing cinematic, retro-adventure language: warm night surfaces, candid photography, Contrail One only for short display moments, Jost for all explanatory copy, character cutouts as the social signal, and amber / trail blue / terra / olive as purposeful accents.

The flow after a person's final blind choice is:

```text
comparison complete → profile → atlas (unranked) ↔ waiting
                                   ↓ (reveal opens)
                          verdict ↔ my take → final decision
```

- **Profile always precedes the first atlas entry.** It is destination-free.
- **The atlas is completion-gated but not result-gated.** It may name destinations, show maps, galleries, and credits, but it must say that every place is still in play and may not imply an order or fit.
- **Personal results, the crew-read matrix, final decision, and all preference explanations are post-reveal only.** The reveal is open only after all five complete and Dan opens it.
- Never expose raw cards, raw activity selections, comparison histories, model
  parameters, normalized utilities, interval values, or another person's
  individual result beyond their post-reveal top five and the permitted
  finalist-rank matrix.
- Comparison cards remain destination blind. These screens must not be repurposed to show character art on a blind card or any destination metadata before completion.

### Typography, contrast, and motion baseline

- On desktop, every visible body label, control, hint, credit, map attribution, and status string is **20px or larger**. Display type is deliberate rather than enormous: generally `clamp(46px, 5vw, 74px)`; reserve `clamp(64px, 9vw, 120px)` for the winner only.
- On mobile, body copy may reach 17–18px only where spatially necessary; controls remain at least 44×44px and primary reading copy remains 18px or larger.
- Use existing semantic tokens. Amber is the main action and active focus; olive indicates a completed, recorded state; trail blue is exploration/map context; terra is a warm emphasis or recoverable warning—not an error-only color.
- Pair color with text, icon, and/or border treatment. Meet WCAG AA contrast, including text over photography (use the existing dark wash).
- All nonessential animation has a static equivalent under `prefers-reduced-motion: reduce`. Do not use animation, color, or a toast as the only evidence of completion, selection, or changed status.

## 2. Component inventory and ownership boundaries

The app-shell task may introduce these semantic components. They must consume shared DTOs and API state only; they must not calculate ranks, confidence, or profile content locally.

| Component | Purpose | Data / gate | Required semantics |
| --- | --- | --- | --- |
| `CompletedTransition` | 1–2 second bridge after last comparison | local completion transition only | `role="status"`, `aria-live="polite"` announces one completion sentence |
| `ProfileScreen` / `ProfileTiles` | destination-free recognition beat | completed caller; `/v1/profile` | `main`, one `h1`, `ul` of 3–5 labelled tiles |
| `AtlasShell` / `AtlasFallback` | existing named, unranked discovery screen | completed caller; `/v1/atlas` | map has an accessible list equivalent; details drawer is a labelled `aside` |
| `WaitingScreen` / `CrewRoster` | completion-only social waiting room | `/v1/group-status` | `main`, roster `ul`, each traveler has text status |
| `MyTakePanel` / `PersonalResultCard` | post-gate caller-only top five | reveal open; `/v1/results/me` | tab/panel or route with labelled `section` cards |
| `VerdictExplainer` / `CrewReadMatrix` | post-gate group context | reveal open; `/v1/results/group` | `section`; matrix is a real `table` with row/column headers |
| `FinalistDetailDrawer` | group finalist context | reveal open; group finalist only | labelled `dialog` or complementary `aside`; close button first in focus order |
| `FinalDecisionSection` / `DecisionDialog` | one immutable discussion stance | reveal open; `/v1/final-decision` | equal-weight `button`s and native-like modal dialog semantics |
| `AppStateNotice` | loading, error, expired auth, and sealed-result routing | typed API error | `role="status"` for loading; `role="alert"` only for actionable error |

Use actual `<button>` elements for every card, map-list item, filmstrip image, detail trigger, refresh action, and decision. Do not create keyboard behavior with generic `div`s. Stable test IDs are appropriate only for stateful seams (for example `data-testid="group-status"`, `data-testid="final-decision-dialog"`, and map/list selection), not as a substitute for labels.

## 3. Screen specifications

### A. Completed transition and preference profile

#### Narrative and copy

After the final accepted comparison, show a short intentional bridge—not a fake calculation or a spinner with no status.

```text
Looking for the shape of your trip…
Okay. We know your type.
```

Then render the returned `profile.headline` (fallback: **Apparently, this is your kind of trip.**) and synthesis. The copy stays categorical and experiential: no score, percentage, named place, activity quote, or assertion of certainty.

#### Layout

- **Desktop (≥1024px):** narrow 840px reading column centred on a warm-night field. Heading and synthesis sit at left; 3–5 profile tiles form a 2+2 / 3+2 staggered grid below. The first tile is amber-accented, then use blue, terra, and olive in rotation—strength is shown by labelled treatment, never merely saturation. A small approved cutout may stand at the column's edge as a companion, but never competes with the profile copy.
- **Tablet (640–1023px):** one heading block; two-column tile grid; actions remain side-by-side if each fits 44px targets.
- **Mobile (<640px):** single column; tiles in source order; sticky bottom primary action. The cutout becomes a small, decorative edge image (`alt=""`) or is omitted.

Each tile contains a semantic label (for example, “Adventure — strongly drawn to”), a one-line human interpretation, and a nonnumeric state word: **Strong pull**, **Present**, or **Still open**. The visual fill may use a short bar but that bar is `aria-hidden`; the state word is the accessible representation.

#### Actions and routing

1. Primary: **Open the trip atlas** → `/v1/atlas` / atlas state.
2. Secondary: **See the crew’s progress** → waiting state.
3. A small text link: **Back to atlas** is only present when arriving from the waiting state; do not add persistent product navigation.

The heading receives focus only when navigation is user initiated. On automatic entry, leave focus on the document and announce once through the completion live region: **“Your preference profile is ready.”**

### B. Atlas continuation and map fallback

This is not a redesign of the shipped atlas. Retain its full-width map, top bar, filmstrip, and selected-destination drawer. Add the transition logic below so it behaves as a post-completion discovery surface.

#### Required cues and actions

- Top-bar status: **Your atlas · every place is still in play.** This is always text, not a color-only status.
- The drawer uses a concise title, country, description, three-photo strip, weather, and **Travel effort**. Place the permanent key directly after travel effort: **“1 = easier journey; 5 = bigger expedition. Neither is a recommendation.”**
- Include **See the crew’s progress** as the non-primary action. When reveal opens, replace it with **See the verdict**.
- Map pin, accessible destination list, and photo filmstrip stay bidirectionally synchronized. Changing selection does not imply fit or rank.

#### Map and image fallback

If WebGL or tiles fail, replace the visual map area with a calm, intentional "atlas index" surface, not a broken-map warning:

```text
The map took the scenic route.
You can still browse every destination below.
```

Render the same 24-item accessible destination list and selected-detail drawer/section, with gallery and required attribution retained. It must be possible to reach every destination and every gallery image without a canvas. Move focus to the fallback heading only after a user-triggered retry fails; otherwise preserve the currently focused control. Show **Try map again** if retry is possible.

On an image error, maintain fixed photo-box dimensions, use the warm off-white editorial placeholder with the destination name as alt text only after completion, and retain adjacent copy. Do not flash, collapse the grid, or expose source metadata in an error state.

### C. Waiting lobby

#### Narrative and layout

The lobby is a celebratory campfire pause, not a monitoring dashboard. Heading:

```text
Your calls are in.
The crew is gathering at the map.
```

Supporting copy: **“Every place is still in play. We’ll open the envelope once everyone is ready.”**

- **Desktop:** 1200px max content area. Use a shallow cinematic header (not a huge billboard), then a single five-person line-up of the approved transparent cutouts on floor shadows. Under each: colorful nameplate, visible text state, and compact status badge. The current user receives a subtle amber `You` tag, not a larger privileged card.
- **Tablet:** 3+2 line-up. Preserve roster order Dan, James, John, Matt, Peter.
- **Mobile:** 2+2+1 line-up; each member is a 44px+ tappable disclosure only if a disclosure serves a purpose. Otherwise use noninteractive `li`s; do not make decorative people fake buttons.

States use only contract information:

| State | Visible treatment and exact copy | Prohibited |
| --- | --- | --- |
| Complete | full-color art, olive check, **Ready** | count/progress/preferences |
| Incomplete | dim-but-legible art, neutral outline, **Still choosing** | “Not started,” “in progress,” timestamps, pressure language |
| All complete, Dan | amber envelope cue, **The crew is ready. Open the group reveal.** | automatic reveal |
| All complete, others | olive cue, **The crew is ready. Dan opens the envelope.** | organizer controls |
| Reveal open | olive cue, **The verdict is open.** | stale waiting CTA |

#### Waiting actions and polling

- **Refresh crew status** is always present, minimum 44px. Its accessible name becomes **Refreshing crew status** while pending; do not duplicate with a spinning-only icon.
- **Copy a nudge** copies a fixed, destination-free message (for example, “Your trip choices are waiting whenever you’re ready: [app URL]”). Announce **“Nudge copied.”** in a polite live region; avoid a browser alert.
- **Back to the atlas** is secondary and explicitly says the atlas is unranked.
- Dan gets **Open the group reveal** only after `allComplete` is true. Other members never see a disabled organizer CTA; they see the explanatory state instead.

Poll only while the route is visible and the document has focus, at 20 seconds with deterministic ±10% jitter; stop when hidden, unmounted, or `revealOpen`. On first load, establish the roster silently. On later data where an incomplete member becomes complete, show exactly one polite toast: **“Matt is ready. 4 of 5 travelers set.”** The toast must not steal focus.

### D. Post-gate personal results: “My take”

#### Placement and structure

`My take` is a peer view to **The verdict**, not an account/profile page. On desktop it is a top-bar navigation button or clearly labelled tab; on mobile it is a full-screen state with a persistent return to **The verdict**. It is unavailable, not disabled, before reveal.

Opening composition:

```text
MY TAKE
The places that fit your calls.
[confidence copy supplied by the server]
```

- **Desktop:** 1180–1280px content width. A 32% intro rail holds profile summary and confidence text. A 68% results rail contains five destination cards, initially revealed #5 → #1 on first entry only.
- **Mobile:** ordered one-column cards, no automatic sequence. The profile becomes a compact summary accordion placed before the list.
- **Card:** photo (decorative only if name/country is adjacent; otherwise descriptive alt), `#rank`, name/country, qualitative fit label, 2–4 controlled themes, weather, and travel effort with the neutral key. “Why it rose” is a closed `<details>` region or button-controlled labelled region.

Use human language such as **Strong match**, **A close contender**, and the API's confidence sentence. The explanation copy may say “Your choices often aligned with mountain days and old places,” but never “You chose this 5/6 times,” a posterior, percentage, raw interval, hidden card title, or causal certainty.

### E. Group verdict additions

The existing verdict remains a dramatic shared reveal: large cover photography, the title **The verdict**, top-five progression, and traveler cutouts. Add content in progressive layers so it stays a scene rather than turning into analytics UI.

1. **Hero / points leader:** retain the winner photo and an image wash that meets contrast. Label it **The crew's strongest shared pull** and state its points, first-place votes, and top-five supporters. A near tie never receives a false “winner” claim.
2. **How points work:** an always-visible compact key says `#1 = 5 … #5 = 1; outside a top five = 0`, followed by the two tiebreaks. Use icon + label + text; do not use color-only meaning.
3. **Top five:** retain image-led cards. Each shows points, first-place votes, and supporter cutouts; an unresolved tie is visibly shared. Selecting a card opens the finalist-detail drawer without rearranging the list or suggesting voting.
4. **Crew read:** place after top five as a card-like `table`, not a decorative grid. Rows are finalists in tally order; column headers contain each traveler cutout and visible name; cells read `#1`–`#5` or `outside top five`. A screen-reader caption states: **“How each traveler ranked the crew's scored destinations after the reveal.”** Never put a color scale alone in cells.
5. **Everyone's maps:** show five personal top-five cards, with each traveler's cutout, rank, place, and cover image. These are post-gate only.
6. **Decision call:** follows the matrix and detail content, never precedes the top five.

#### Finalist detail drawer

Use a `<dialog>` when opening from a list item; use an `aside aria-label="Details for [destination]"` only when the desktop map-like layout keeps it persistently visible. It contains cover photo, group rank, consensus label, returned insight if present, November/weather, travel effort and its neutral key, gallery/photo credits, and **Close details**.

It must **not** contain airfare, a calculated practical score, booking CTA, a claim that every person agrees, or activity-by-activity evidence. Focus enters the heading/close control in a dialog, is trapped until close, and returns to the originating finalist button.

### F. Immutable final decision

This is a discussion stance, not a second ranking round. It appears only after the verdict's top-five and context.

```text
NOW THAT YOU KNOW THE PLACES
What should the crew investigate next?
Your answer records a conversation stance. It will not change the blind result.
```

- Render the five finalists and **Need more research** as six equal-weight buttons. No option is preselected, more saturated, or marked “recommended.” Each destination option includes name/country and the same photo treatment; the research option uses a neutral illustrated compass/paper-map treatment, not a danger style.
- **Desktop:** a six-card responsive grid (3+3 or 5+1 depending on card minimum width), following the same editorial image rhythm as the verdict.
- **Mobile:** one column, with 16px gaps and a sticky action only after an option is selected.
- Selection changes border, check icon, and “Selected: [option]” text. It does **not** submit.
- **Record my stance** opens confirmation dialog. Dialog title: **“Lock in your take?”** Body: **“This records what you want the crew to investigate next. It does not change the trip ranking, and it can’t be edited.”** Buttons: **Not yet** (secondary, default focus) and **Record [choice]** (primary).
- After 201 success—or a 409 response returning the existing decision—lock the grid, announce **“Your stance is recorded: [choice].”**, and show an olive status banner. A roster summary may then display each person’s recorded destination or **Research**, but no further detail. Never offer edit, undo, or a retry that creates a second vote.

## 4. State, error, and gate behavior

| Situation | UI response | Live announcement / focus behavior |
| --- | --- | --- |
| Initial profile/atlas/status/result load | fixed-size skeleton using current surfaces; text “Preparing your atlas/crew read” | `role="status" aria-live="polite"`; announce once, never move focus |
| Completed comparison transition | brief topographic loader then profile | polite: “Your choices are saved. Your profile is ready.” |
| Network failure, retryable | inline warm-terra notice: “We couldn’t reach the trail. Your saved choices are safe.” + **Try again** | `role="alert"`; focus the notice only if it followed an action; retry restores previous focus |
| Authentication expired | “Sign back in to continue. Your progress is saved.” + **Sign in with Google** | alert; primary receives focus only after a user action fails |
| `409` duplicate/stale decision | treat returned stored decision as success; lock and render it | polite recorded-decision announcement; no error treatment |
| `409` stale comparison elsewhere | return to game/resume state with “That choice was already saved. Here’s your next call.” | polite status; no data-loss dialog |
| `423` sealed group result or reveal | route to waiting, not an error page: “The envelope is still sealed. See who’s ready.” A completed caller’s own shortlist remains available. | polite announcement; focus `WaitingScreen h1` on an intentional direct navigation |
| `403` profile/atlas pre-completion | return to comparison/resume: “Finish your current round to unlock this.” | alert after attempted navigation; focus primary resume action |
| `403` non-Dan reveal attempt | waiting with “The crew is ready. Dan opens the envelope.” | polite, no disabled reveal button |
| map/WebGL/tile failure | `AtlasFallback` list + drawer, attribution, **Try map again** | status; preserve focus unless retry explicitly fails |
| image failure | stable placeholder in same frame; surrounding details remain usable | no live announcement for decorative image; announce only if image was the sole way to identify content |
| zero/invalid seed configuration | plain recoverable system notice: “This trip needs a quick setup check.” | `role="alert"`; no invented organizer UI |

All loading treatment is a visual courtesy, not a timing gate. Respect reduced motion with static topographic rings/texture and visible text. Errors must retain the user’s completed screen content whenever possible rather than blanking the application.

## 5. Keyboard, focus, and announcements

### Focus order

1. Top-bar back/logo only when it is interactive, then primary screen action.
2. Profile: heading → profile tiles (only if interactive) → Open atlas → See crew progress.
3. Atlas: map controls → destination list → selected detail actions → gallery filmstrip → status / waiting action. The accessible list is never hidden behind a canvas-only interaction.
4. Waiting: Refresh → Copy a nudge → Back to atlas → Dan-only reveal action (when legal). Roster items enter tab order only when they expose real, useful content.
5. Verdict: My take / verdict switcher → finalist buttons → detail drawer triggers → crew-read table → final-decision choices.
6. Decision: selected choice → Record my stance → dialog: close/Not yet → confirmation. Escape closes an unsubmitted dialog.

Use a 3–4px amber focus outline with at least 3px offset, including against photo cards. Do not remove outlines on pointer use. At 200% zoom, content must reflow without horizontal page scrolling (except an explicitly labelled, horizontally scrollable data table with its instructions visible).

### Exact live-region use

- **One global polite `role="status"`:** saved-comparison completion, initial loading sentence, refreshed crew state, a later completion transition, copied nudge, map retry success, and recorded final decision. Each event is one concise sentence. Do not announce skeletons, every poll, or decorative animation.
- **One assertive `role="alert"` mounted only when needed:** failed action, expired auth, an access/error state that changes the available path. It must contain both reason and next action.
- **No live region:** hover states, destination/map selection, result card sequencing, gallery swaps, decorative loaders, and the initial waiting roster.

## 6. Interaction and reduced-motion contract

| Interaction | Standard motion | Reduced-motion equivalent |
| --- | --- | --- |
| Complete → profile | 600–1200ms topo/dot transition, then 180ms content entrance | instant profile with status text |
| Waiting member completes | 180–220ms olive check/pop, one toast | static olive check and status text; same polite toast |
| Atlas pin/list selection | 350–600ms map fly-to and drawer crossfade | immediate selection, no map camera animation |
| First verdict view | ordered 5→1 reveal with 180–250ms intervals | full stable list in final order, no autoplay |
| Open detail / decision dialog | 160–220ms opacity/translate | immediate rendered dialog, focus unchanged in behavior |
| Final decision record | 180ms lock-in check and olive banner | immediate lock, olive banner, status announcement |

No automatic animation may delay a CTA, obscure text, or prevent reading a result. Do not add WebGL effects to the profile, waiting, or decision flows; reserve current ambient treatments for decorative background only and provide CSS fallback.

## 7. Acceptance checklist for OT-11 through OT-18

- [ ] Profile appears after completion before the first atlas entry, contains 3–5 destination-free categorical tiles, and has the stated live confirmation.
- [ ] Atlas clearly says it is unranked, has a keyboard-usable list/detail/gallery fallback, and retains map/photo attribution after completion only.
- [ ] Waiting exposes exactly five names and complete booleans only; polling and post-load transition toast follow the defined privacy behavior.
- [ ] Direct pre-gate result access reaches waiting via the 423 state without result leakage.
- [ ] My take, crew matrix, detail drawer, and final-decision UI appear only after a reveal snapshot is open; none render raw card choices or numeric/posterior claims.
- [ ] Crew matrix uses table semantics and only `#1`–`#5` / `6+`; traveler artwork and names label its columns.
- [ ] Final decision offers exactly five current finalists plus `Need more research`, requires confirmation, and treats a returned 409 decision as already-recorded success.
- [ ] Desktop visible text honours the 20px floor; mobile meets readable-body and 44px target requirements.
- [ ] Keyboard focus is conspicuous; dialogs trap and restore focus; all dynamic state has the specified live-region treatment.
- [ ] Reduced-motion, network, auth, 403/409/423, map, and image fallback states preserve a useful path forward.
