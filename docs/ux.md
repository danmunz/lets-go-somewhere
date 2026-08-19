# Let's Go Somewhere — User Journey Map

## 1. Purpose

This journey map defines the end-to-end experience for **Let's Go Somewhere**, the destination-blind trip preference application.

Its main purpose is to produce a concrete inventory of:

- screens that need to exist;
- information each screen must contain;
- actions available on each screen;
- application states and edge cases;
- transitions between screens;
- moments of delight and friction;
- post-MVP organizer/admin journeys;
- metrics that indicate whether each stage is working.

V1 has one participant role: an approved member of the fixed five-person roster. The organizer journey below is retained as a post-MVP reference; V1 uses the checked-in trip configuration and Dan may only end the study to open the reveal gate.

## Current implementation note

The shipped V3/V4 path is **welcome → choose character → Google OAuth → comparisons → completion-gated named atlas → group reveal**. The local one-trip checkpoint additionally implements the profile, waiting roster, personal-results, detailed rationale, and final gut-check surfaces described below. Those additions are committed but remain unreleased until the model and rehearsal gates pass; see [implementation status](implementation-status.md).

The broader product has two primary roles:

1. **Participant** — one of the travelers completing the preference exercise.
2. **Organizer** — creates the trip, chooses destinations, invites participants, and ultimately views group results.

A person may be both.

---

# 2. Core User Promise

The participant should understand the product as:

> **Pick the experiences that sound more fun. We'll figure out where you should go.**

They should **not** need to:

- know all the destinations;
- consciously rank cities;
- understand the algorithm;
- fill out a conventional survey;
- think about airfare while expressing pure preference.

The experience should feel like a short interactive game whose answer is revealed at the end.

### Related documents

- [Product specification](spec.md) defines the comparison, ranking, and reveal behavior behind these screens.
- [Architecture overview](architecture.md) defines the frontend, backend, and persistence responsibilities.
- [Project origins and intent](project-origins-background.md) provides the constraints that shaped the initial experience.
- [Design system](design-system.md) defines the tokens and reusable UI contracts used by these screens.

---

# 3. Journey Overview

```text
INVITATION
    ↓
LANDING / SIGN IN
    ↓
JOIN TRIP
    ↓
HOW IT WORKS
    ↓
ACTIVITY COMPARISONS
    ↕
OPTIONAL MICRO-QUESTIONS
    ↓
ANALYSIS / REVEAL SETUP
    ↓
PREFERENCE PROFILE
    ↓
WAITING FOR GROUP
    ↓
GROUP REVEAL
    ↓
DESTINATION DETAIL / "WHY"
    ↓
FINAL GUT CHECK
    ↓
RESULTS
```

Post-MVP organizer journey:

```text
SIGN IN
    ↓
DASHBOARD
    ↓
CREATE TRIP
    ↓
DEFINE DATES / ORIGINS
    ↓
SELECT DESTINATIONS
    ↓
REVIEW / EDIT ACTIVITY CARDS
    ↓
INVITE PARTICIPANTS
    ↓
MONITOR COMPLETION
    ↓
GROUP RESULTS
```

---

# 4. Experience Principles

## Destination blindness

Until the reveal, do not expose:

- destination names;
- countries;
- flags;
- airport codes;
- airfare;
- maps;
- destination-specific terminology that trivially gives away location.

The participant is evaluating **experiences**, not brands. Activity-specific photography may create geographic recognition; this is an accepted V3/V4 tradeoff. Explicit destination metadata and outcome signals remain embargoed during comparison.

---

## Low cognitive load

Each comparison asks one question:

> **Which sounds more fun?**

Avoid asking users to:

- score;
- rank;
- estimate likelihood;
- compare five dimensions;
- justify every answer.

---

## Fast rhythm

Most comparison decisions should take roughly 5–10 seconds.

The interaction loop should be:

```text
Read
 ↓
Choose
 ↓
Immediate feedback
 ↓
Next pair
```

No unnecessary confirmation step.

---

## Suspense

Do not expose interim destination rankings.

The system should gradually indicate progress without spoiling the result.

---

## Explainability after the fact

Once destinations are revealed, the system should make the result understandable:

> "You consistently chose mountain adventures, archaeological sites, and historic cities. Those experience types beat their opponents often enough to put this destination in your top five."

The model should feel insightful, not arbitrary.

---

# 5. Primary Participant Journey

---

## Stage 1 — Receive Invitation

### User goal

Understand what this thing is and decide whether it is worth opening.

### Touchpoints

- text message;
- group chat;
- email;
- copied invite URL.

### Likely user mindset

> "Dan sent me another weird thing."

### Emotion

**Curious / mildly skeptical**

The concept itself should create enough curiosity to earn a click.

### Pain points

- Invite sounds like homework.
- User assumes this is another survey.
- User thinks they need to research destinations first.
- User does not understand why Google sign-in is required.

### Opportunity

Make the invitation playful and extremely low commitment.

Example positioning:

> We're picking the November trip without telling you what you're voting for.  
> Pick which experiences sound better. Takes ~3 minutes.

### Metrics

- Invite → landing conversion
- Invite link opens per participant
- Time between invitation and first session

### Required product screen

None — this is primarily an external touchpoint.

---

# 6. Screen P01 — Public Landing

## Purpose

Explain the idea in seconds and get the user into the experience.

## Required information

### Product headline

> **Where should we actually go?**

### Supporting copy

> Pick between things you could do on the trip.  
> We won't tell you where they are until the end.

### Primary CTA

**Continue with Google**

### Secondary information

- "Usually 28–35 quick choices"
- "Your progress is saved"
- Trip name if reached via invite:
  - **Guys Trip — Nov. 11–15**

### Optional visual

Two fake activity cards demonstrating the mechanic.

Do not use actual trip activities if doing so could bias later choices.

## Actions

- Continue with Google
- Privacy/help link

## Entry points

- invitation link;
- root homepage;
- returning session with expired auth.

## Exits

```text
Google OAuth success
        ↓
P02 Join Trip

Already member
        ↓
P04 Resume / Comparison

No trip context
        ↓
P03 My Trips
```

## Emotion

**Curiosity → confidence**

## Major risk

Too much explanation makes the experience feel complicated.

## Design opportunity

The landing page should communicate the entire premise visually before the user finishes reading.

---

# 7. Screen P02 — Join Trip & "Choose Your Character"

## Purpose

Let a participant choose their intended traveler before authentication, then verify that selection against the approved Google roster mapping.

## Required information

> **You've been invited to:**  
> Guys Trip 2026  
> Nov. 11–15

### Character Selection Prompt

> **Choose the traveler who matches your Google account.**

### Character Selection Grid (5-Traveler Roster)

Interactive character cards for the 5 trip participants:

1. **Dan** — *Trip wrangler*
2. **James** — *Curiosity engine*
3. **John** — *Good-times scout*
4. **Matt** — *Trail negotiator*
5. **Peter** — *Wildcard energy*

#### Interactive 3D Card States & Micro-animations:

- **Initial State**: Free-standing transparent cutout with a floor shadow and nameplate; no enclosing card.
- **Hover State**: Gentle lift and playful 3D wiggle (`scale(1.12) rotateZ(±4deg) rotateY(±8deg)`) with a softened floor shadow.
- **Click / Selection State**: One 750 ms 360° lock-in spin, checkmark, and live selection confirmation; reduced motion uses color and shadow only.
- **Verification State**: Google OAuth verifies that the selected character matches the approved roster account; a mismatch is rejected rather than silently switching identity.

### Primary CTA

**Continue as [Selected Character Name]** (e.g. *Continue as Dan*)

### Secondary CTA

**Not your trip?**

## Actions

- Hover and preview character cards
- Confirm the assigned character
- Cancel / return to trips

## System behavior

On confirmation:

- verify the Firebase identity;
- map the verified account to its approved fixed-roster `characterId` (e.g. `"dan"`);
- reject a selected-character/identity mismatch.

## Exit

```text
Join as [Character]
       ↓
P04 Comparison
```

## Emotion

**Playful / engaged / oriented**

## Pain point

Google identity could expose a display name the user does not normally use socially.

## Opportunity

Character selection bypasses awkward email/display names and instantly grounds the experience in the social group dynamic.

---

# 8. Screen P03 — How It Works

**Implementation status:** the onboarding explanation is currently integrated into the welcome and character-select screens rather than shipped as this standalone screen. Retain the content intent when extracting it later.

## Purpose

Teach the mechanic without teaching the algorithm.

## Required information

### Headline

> **Don't overthink it.**

### Instructions

1. You'll see two things you could do.
2. Pick whichever sounds more fun.
3. We hide where they are.
4. At the end, we'll tell you what trips fit you.

### Explicit reassurance

> There are no wrong answers.

### Approximate duration

> Usually 28–35 choices · about 3–5 minutes

### Primary CTA

**Let's go**

## Optional

A one-step interactive demonstration:

```text
Explore ancient ruins
        OR
Hike through a mountain reserve
```

The demo answer should not be recorded.

## Exits

```text
Let's go
 ↓
P04 Comparison
```

## Emotion

**Anticipation**

## Pain point

Explaining adaptive ranking or mathematical confidence here would create unnecessary cognitive load.

## Opportunity

Keep methodology accessible through a small "How does this work?" link elsewhere, but not in the primary flow.

---

# 9. Screen P04 — Activity Comparison

This is the application's core screen.

It will represent the overwhelming majority of participant interactions.

## User goal

Make one effortless preference decision.

## Required information

### Prompt

> **Which sounds more fun?**

### Activity A

- short activity title;
- 1–2 sentence description;
- opaque, activity-specific editorial photograph with no visible destination metadata or credits;
- entire card selectable.

### Activity B

Same structure and visual weight.

### Separator

**OR**

### Progress indicator & Active Traveler Badge

- **Active Traveler Avatar**: The selected transparent character art is displayed at approximately 150 px in the header.
- **Progress bar / text**:
  ```text
  18 answered · 24 minimum · up to 40
  ```

### Milestone Micro-Toasts (Gamified Feedback)

Progress copy moves from “Finding your trip rhythm” to “You’re on a roll” and “Almost there — just a few gut calls left.” The live counter and bar express the real minimum/maximum envelope rather than a fixed total.

## Example

### OPTION A

**Explore a vast underground complex carved beneath an ancient city**

Walk through chambers, tunnels, and ceremonial spaces while learning how the site was used centuries ago.

### OPTION B

**Ride high above a mountain city and hike along the ridge**

Take a cable car into the mountains, then follow trails overlooking the city and surrounding peaks.

## Actions

- choose Activity A;
- choose Activity B;
- optionally exit and resume later.

## Immediate feedback

On selection:

1. selected card acknowledges input;
2. losing card recedes;
3. progress subtly advances;
4. next comparison appears.

No "Are you sure?"

The hover/focus cue reads **“I’d rather…”**; selection acknowledgement is short (about 180 ms) and never blocks the next answer.

## Transitions

Normally:

```text
P04
 ↓
P04 next comparison
```

Occasionally:

```text
P04
 ↓
P05 Reason Micro-question
 ↓
P04
```

At stopping threshold:

```text
P04
 ↓
P06 Analysis Transition
```

## Emotion

Ideal emotional pattern:

```text
Curious
  ↓
Decisive
  ↓
"Oh, that's a hard one"
  ↓
Engaged
```

The occasional difficult comparison is desirable. Every question being obvious would suggest weak pair selection.

## Pain points

### Ambiguous comparisons

User thinks:

> "It depends."

### Unequal descriptions

One activity sounds dramatically better because of copywriting, not substance.

### Hidden practical constraints

User may think:

> "I'd love that, but probably not on this particular trip."

### Repetition

The same activity reappears and feels like an error.

### Fatigue

25 decisions may feel longer than expected.

## Opportunities

- Keep cards consistently concise.
- Use equivalent writing intensity.
- Explain once that some activities may return because comparisons become more specific.
- Allow a rare **"Neither / no preference"** option only if research shows forced choices are producing junk data.

### Recommendation on "neither"

Do **not** include it in MVP.

Forced pairwise choice is the product's simplicity.

Test whether users genuinely struggle before adding another branch.

## Metrics

- median decision time;
- comparisons/session;
- abandonment comparison number;
- repeated-pair response consistency;
- percentage completing in one session;
- activity-card selection imbalance;
- average session duration.

---

# 10. Screen P05 — Optional "What Tipped It?" Micro-question

## Purpose

Gather occasional explicit preference information without turning the experience into a survey.

## Frequency

Approximately 3–5 times per complete session.

Not after every comparison.

## Trigger

Useful moments include:

- first strong cross-category choice;
- surprising choice relative to inferred profile;
- especially close destination comparison;
- category ambiguity.

## Required information

> **What tipped that one for you?**

Quick choices:

- Adventure
- Food
- History / culture
- Nature / scenery
- Weird / unusual
- Active / outdoors
- City exploration
- It just sounds more fun

### Secondary action

**Skip**

## Interaction

Single tap.

Immediately return to comparison loop.

## Transition

```text
P04
 ↓
P05
 ↓
P04
```

## Emotion

**Reflective but not interrupted**

## Pain point

If this appears too frequently, the magic disappears and the user realizes they are filling out a conventional preference survey.

## Opportunity

Animate this as a lightweight interstitial rather than a new "form screen."

## Metrics

- completion vs. skip rate;
- added time;
- whether reason answers improve predictive consistency.

---

# 11. Screen P06 — Analysis Transition

## Purpose

Create suspense and hide any short processing delay.

## Required information

Minimal.

Example:

> **Okay. We have a read on you.**

Animated sequence could progress through:

```text
Looking for patterns…
Comparing your choices…
Finding your strongest matches…
```

Duration should be short even if results are already available.

## Actions

None.

Potentially allow **Continue** once animation finishes.

## Exit

```text
P06
 ↓
P07 Preference Profile
```

## Emotion

**Anticipation**

## Opportunity

This is a theatrical beat, not a technical loading screen.

Even instantaneous calculations may deserve ~1–2 seconds of intentional transition.

---

# 12. Screen P07 — Preference Profile Reveal

## Purpose

Reveal what the system learned **before** revealing destinations.

This makes the destination result feel causally grounded.

## Required information

### Headline

Possibilities:

> **Apparently, this is your kind of trip.**

### Strong preferences

Example:

```text
Adventure & mountains     █████
History & old places      █████
Unusual local experiences ████
Food                      ███
City exploration          ███
```

### Short synthesis

> You consistently favored active, distinctive experiences over lower-intensity urban experiences.

### Primary CTA

**See my preference profile**

## Actions

- Continue to destination reveal
- Optional "How did you get this?"

## Transition

```text
See my preference profile
 ↓
P07 Waiting for group reveal
```

## Emotion

**Recognition / surprise**

The ideal response is:

> "Yeah, that actually sounds like me."

## Pain point

The profile could feel generic or horoscope-like.

## Opportunity

Support every statement with actual comparison evidence.

Avoid generic personality language that could describe anybody.

---

# 13. Screen P08 — Destination Ranking Reveal

## Purpose

Deliver the principal payoff after the entire roster completes the blind exercise and Dan opens the reveal gate. There is no early-reveal path in the fixed-roster V1 study.

## Required information

### Intro

> **Here's where you actually want to go.**

### Ranked destinations

Animate destinations into place rather than presenting a static table immediately.

Example:

```text
1. Antigua, Guatemala
2. Quito, Ecuador
3. Guanajuato, Mexico
4. Medellín, Colombia
5. Puebla, Mexico
```

### Each V1 row/card should include

- rank;
- destination;
- country;
- preference score;
- expand/detail action.

Historical V1 note: thumbnails were post-MVP. Current comparisons may use opaque destination photography as an intentionally accepted soft cue, with no identifying metadata.

### Primary emphasis

Top 3.

Show the confident top five; do not imply a reliable complete ordering of all active destinations.

## Actions

- expand destination;
- compare top choices;
- continue;

## Transition

```text
Tap destination
 ↓
P09 Destination Detail
```

or:

```text
Continue
 ↓
P10 Final Gut Check
```

## Emotion

**Surprise / delight**

This should be the highest emotional point of the individual journey.

## Design opportunity

Reveal the destinations sequentially:

```text
#5
#4
#3
#2
#1
```

or rapidly animate the full list into order.

Do not overextend the reveal into a game-show parody.

---

# 14. Screen P09 — Destination Detail / Why It Ranked

## Purpose

Explain the model result and reconnect hidden activities to actual locations.

## Required information

### Destination

**Antigua, Guatemala**

### Rank

**Your #1 match**

### Why it fits

> You consistently favored:
>
> - dramatic mountain experiences;
> - historic environments;
> - active day trips;
> - distinctive local experiences.

### Hidden activity reveal

> **Remember this?**
>
> "Camp above the clouds beside an erupting volcano"
>
> That's **Acatenango**, outside Antigua.

Show all activity cards from the destination with:

- whether the user encountered them;
- whether they chose them;
- how strongly those responses contributed.

### Preference evidence

Example:

> Antigua activities won 5 of their 6 appearances.

### Practical trip information

Only now introduce:

- airfare;
- flight duration;
- weather;
- transfer friction;
- suitability for 3 full days.

Example:

```text
Preference match     92
Flights              Good
Travel friction      Low
November fit         Excellent
3-day fit            Excellent
```

### Actions

- next ranked destination;
- compare;
- back to ranking.

## Entry

From P08.

## Emotion

**Discovery / understanding**

## Opportunity

This screen completes the trick:

> "Oh! THAT volcano thing was Guatemala."

That connection should be prominently designed.

---

# 15. Screen P10 — Final Gut Check

## Purpose

Give conscious preference the final word after the blind experiment.

## Required information

> **Now that you know what they are…**

### Top Choice A

Antigua

### Top Choice B

Quito

> Which would you actually book?

## Actions

- Pick A
- Pick B
- **Stick with my ranking**

Potential optional choice:

> "Something else"

but this is probably unnecessary for MVP.

## System behavior

Record the gut-check response separately.

Do not overwrite raw comparisons.

Possible fields:

```text
modelTopDestination
gutCheckDestination
gutCheckMatchesModel
```

## Exit

```text
Choose
 ↓
P11 Personal Results
```

## Emotion

**Agency**

## Pain point

User may interpret this as "the algorithm was wrong."

## Opportunity

Frame it as intentional:

> Blind preference is one input. Now your actual destination knowledge gets a vote.

---

# 16. Screen P11 — Personal Results

## Purpose

Create a stable, returnable summary without leaking destination information before the group reveal gate opens.

## Required information

### Preference profile

Compact, destination-free summary of observed attribute preferences.

### Notable insights

Examples:

- **Strongest preference:** Adventure
- **Most consistent theme:** Outdoors
- **Closest choice:** two anonymous activity cards

### Practical context

V1 can show a short note that logistics will be reviewed after the group reveal. It must not calculate or present a practical ranking.

### Group status

> **3 of 5 have finished**

### Primary CTA before everyone finishes

**See group progress**

### Secondary

- Review comparisons

## Transition

If group incomplete:

```text
P11
 ↓
P12 Waiting for Group
```

Before the group gate, do not show destination rankings, destination details tied to any participant’s responses, or sharing. After finishing, a participant may browse an unranked destination atlas with names, general trip context, map placement, and credited editorial photography. During comparisons, destination photography is allowed as an intentional soft cue, but destination names, countries, flags, map UI, ranking signals, and photo-credit metadata remain hidden. After the gate opens, P11 can link to P13 Group Reveal.

If complete:

```text
P11
 ↓
P13 Group Reveal
```

---

# 17. Screen P12 — Waiting for Group

**Implementation status:** `/v1/group-status` provides completion-only roster data and the dedicated waiting lobby is implemented in the local one-trip checkpoint. It remains unreleased pending the model, emulator/E2E, and final quality gates.

## Purpose

Handle the period between individual completion and group completion.

## Required information

> **You're done. Now we need the other degenerates.**

Tone can obviously be adjusted.

### Completion Status — Live 5-Traveler Roster (`CharacterRoster`)

The waiting lobby displays an interactive 5-traveler token roster:

```text
[ Dan 🎒 ]     [ James 🧭 ]     [ John 🗺️ ]     [ Matt 🏔️ ]     [ Peter 📷 ]
✓ Complete      ✓ Complete       In Progress     ✓ Complete       Not Started
```

#### Real-time Animation & Micro-toasts:

1. **Live Token State Transitions**:
   - **Completed**: Fully illuminated 3D token with a green checkmark badge (`✓ Complete`).
   - **In Progress**: Pulsing subtle amber ring.
   - **Not Started**: Softly dimmed token with a "Prod" or "Copy Invite" action.
2. **Real-time Submission Event**:
   - When a friend finishes their comparisons, their token executes a 360° celebratory spin and transitions to the `✓ Complete` state.
   - A real-time toast notification (`CharacterToast`) slides in:
     > 🔔 **Matt just finished his rankings!** (4 of 5 travelers ready)

Potential privacy consideration:

Do not reveal another person's partial preferences. Only participation status.

### Primary action

**Copy invite link** / **Nudge [Traveler Name]**

Organizer only, or perhaps available to all.

### Secondary action

**View my results**

### Optional future action

**Notify me when everyone's done**

Could use email/push later.

## Transitions

```text
My results
 ↓
P11

All users complete
 ↓
P13 Group Reveal
```

## Emotion

**Satisfied → impatient**

## Pain point

The group reveal depends on the slowest participant.

## Opportunity

Make the waiting screen itself socially useful by making it easy to prod the holdout.

---

# 18. Screen P13 — Group Reveal

## Purpose

Provide the second major payoff: what the five people collectively prefer.

**Implementation status:** the current local verdict is being replaced by the
transparent points reveal below. It will show all five travelers' personal top
fives, the published tally, social overlap/divergence notes, and the immutable
post-reveal decision. Raw activity choices remain private.

## Required information

### Headline

> **The verdict**

### Crew points leader

Large visual treatment.

> **#1 Antigua, Guatemala**

### Crew scoreboard

Show the five destinations with the highest fixed top-five tally, their point
total, first-place-vote count, and supporter avatars. Explain the rule in
place: `#1 = 5 points … #5 = 1 point; outside a top five = 0`.

### Per-person rankings (with Micro-Avatars)

For the five-scoreboard destinations, display each traveler's ordinal placement
(`#1` through `#5`, or `outside top five`) with a micro-avatar badge. Also show
each traveler's complete personal top five as an image-led character card.

| Traveler | Antigua | Quito | Guanajuato |
|---|---:|---:|---:|
| 🎒 **Dan** | #1 | #2 | #3 |
| 🧭 **James** | #2 | #1 | #5 |
| 🗺️ **John** | #4 | #3 | #1 |
| 🏔️ **Matt** | #1 | #4 | #2 |
| 📷 **Peter** | #3 | #2 | #6 |

### Shared threads and divergences

Generate only evidence-backed observations. The reveal may identify a shared
destination (two or more top-five placements), a strong shared destination
(three or more), a split destination (at least two top-five placements and at
least two people outside the top five), or shared/contrasting profile themes.
It must show the named ranks that support the statement and omit a category
when no evidence exists.

Preference-shape presentation is a success criterion:

- A broad leader is framed as “the crew's strongest shared pull.”
- Near leaders are presented as a “shared shortlist,” not visually exaggerated
  as decisive ranks.
- A personal #1 with no support is celebrated as that traveler's “personal
  wild card,” without inflating its group standing.
- Two camps are shown as two trip moods with their supporting avatars.
- No top-five overlap is framed as “a true group decision”; show every #1 and
  center the final discussion action rather than inventing consensus.
- An unresolved published tally tie stays a tie and receives side-by-side
  treatment.

### Practical constraints

Show group-level airfare/logistical context for top destinations.

### Actions

- open destination;
- compare finalists;
- share result;
- organizer: advance to decision/finalist stage.

## Emotion

**Shared surprise / conversation**

## Opportunity

This page should be screenshot-worthy.

The group results are as much a social artifact as an analytical one.

---

# 19. Screen P14 — Group Destination Detail

## Purpose

Allow the group to understand why a particular destination ranks where it does.

## Required information

For a destination:

### Crew tally placement

### Each user's individual rank

### Visible rank distribution

Example:

```text
Dan       94
Mike      91
Chris     82
Alex      95
Sam       88
```

### Social read

Show supporter avatars and the plain-language rank pattern, such as “ranked
#1 by Dan and James; outside Peter's top five.” Do not calculate or display a
polarization score.

### Activities

Which destination activities appealed to the group most.

### Practical information

- airfare by origin;
- average airfare;
- travel times;
- weather;
- transfer friction;
- example three-day itinerary.

### Actions

- compare against another destination;
- mark as finalist;
- return to group ranking.

---

# 20. Screen P15 — Head-to-Head Finalist Comparison

Explicitly out of scope for this one-trip build. The final gut check is the required decision action.

## Purpose

Move from preference discovery into actual trip decision-making.

Example:

```text
ANTIGUA
vs.
QUITO
```

Now destination blindness is over.

Compare:

- preference score;
- group rank;
- lowest individual rank;
- airfare;
- travel time;
- weather;
- key activities;
- practical three-day itinerary.

## Actions

- choose finalist;
- vote;
- return.

This is where the app can transition from:

> **What do we like?**

to:

> **What are we booking?**

---

# 21. Returning Participant Journey

Users may leave before completing the activity exercise.

## Entry

Authenticated user returns to app.

### Routing logic

```text
Not in group
    ↓
P02 Join

Joined, 0 responses
    ↓
P03 How It Works

Joined, incomplete
    ↓
P16 Resume

Individual complete, group incomplete
    ↓
P11 / P12

Group complete
    ↓
P13
```

---

# 22. Screen P16 — Resume

## Purpose

Reorient a returning user quickly.

## Required information

> **Welcome back, Mike.**

> You made 14 choices. We have a few more.

### Primary CTA

**Keep going**

### Secondary CTA

**Start over**

Start over should require confirmation.

## Exit

```text
Keep going
 ↓
P04
```

## Emotion

**Reassured**

## Opportunity

Persistence should feel effortless. The user should never wonder whether previous choices were saved.

---

# 23. Global Participant States

Every participant-facing screen must also account for:

## Loading

- authentication loading;
- group loading;
- next-comparison calculation;
- results computation.

## Network error

Offer:

**Try again**

Do not lose prior selections.

## Authentication expired

Refresh token silently when possible.

Otherwise:

> Sign back in to continue. Your progress is saved.

## Removed from group

Explain clearly.

## Trip closed

Show results if allowed; disable further comparisons.

## No active destinations

Organizer configuration error.

## Insufficient activities

Organizer configuration error.

## Duplicate / stale comparison submission

Handle idempotently.

## User changes device

Resume seamlessly after Google sign-in.

---

# 24. Organizer Journey (post-MVP reference)

These screens are intentionally out of V1 scope. The V1 build uses the fixed seeded trip, roster, and configuration described in the product specification; do not create organizer routes, CRUD interfaces, or multi-trip authorization to satisfy this section.

---

## Stage O1 — Organizer Dashboard

### User goal

Create or manage a trip-selection exercise.

### Screen O01 — Dashboard

## Required information

### Existing trips

Cards showing:

- trip name;
- dates;
- number of participants;
- completion status;
- status:
  - Draft
  - Active
  - Complete

### Primary CTA

**Create a trip**

## Actions

- create;
- open existing;
- duplicate later;
- archive later.

---

# 25. Screen O02 — Create Trip

## Purpose

Establish minimum trip context.

## Required fields

- Trip name
- Start date
- End date

Potentially:

- short description

Example:

```text
Guys Trip 2026
Nov. 11–15, 2026
```

### Primary CTA

**Continue**

## Exit

```text
Continue
 ↓
O03 Travelers & Origins
```

---

# 26. Screen O03 — Travelers & Origins

## Purpose

Capture practical travel context used later for airfare/logistics.

## Required information

Participants do not necessarily need to exist yet.

Organizer can define origin groups:

```text
2 travelers — Washington, DC
2 travelers — New York
1 traveler — San Francisco
```

## Actions

- add origin;
- traveler count;
- remove origin.

Potential future:

- map actual participants to origins.

### Primary CTA

**Continue**

## Exit

```text
O03
 ↓
O04 Destinations
```

---

# 27. Screen O04 — Destination Selection

## Purpose

Define the active candidate set.

## Required information

Grid/list of available destinations:

- destination;
- country;
- short hook;
- activity count;
- practical trip information;
- active toggle.

### Actions

- activate/deactivate;
- add destination;
- edit;
- preview activities.

### Summary

> **[Active destination count] destinations selected**

### Validation

Require minimum destination count.

Recommendation:

At least **4**.

## Primary CTA

**Review experiences**

## Exit

```text
O04
 ↓
O05 Activity Library
```

---

# 28. Screen O05 — Activity Library

This is one of the most important organizer screens.

## Purpose

Ensure destination-blind activity cards are balanced and usable.

## Structure

Grouped by destination:

```text
ANTIGUA
6 activities

□ Camp above the clouds beside an erupting volcano
□ Explore centuries-old ruined churches
□ Visit a mountain coffee farm
...
```

## Each activity displays

- title;
- description;
- attributes;
- image status;
- active/inactive;
- "blindness risk" if manually tagged later.

## Actions

- create;
- edit;
- deactivate;
- duplicate;
- preview;
- change attributes.

## Quality indicators

Potential warnings:

> Only 3 activities — recommended 5–8

> Activity contains destination name

> Activity description is substantially longer than average

> Portfolio heavily overrepresents "food"

These are out of scope for this one-trip build.

## Primary CTA

**Preview the game**

---

# 29. Screen O06 — Activity Editor

## Required fields

- title;
- description;
- destination;
- active status.

### Attribute ratings

For example:

```text
Adventure          0–5
Nature             0–5
History            0–5
Culture            0–5
Food               0–5
Urban               0–5
Novelty             0–5
Physical intensity  0–5
```

Potential metadata:

- image;
- source/reference;
- organizer notes.

### Destination-blind warning

The interface should remind the organizer:

> Don't reveal the destination in the card.

## Actions

- save;
- delete;
- preview;
- cancel.

---

# 30. Screen O07 — Game Preview

## Purpose

Let organizer experience cards exactly as participants will.

## Required information

Standard P04 comparison UI but in **preview mode**.

Persistent banner:

> PREVIEW — responses aren't recorded

## Actions

- cycle comparisons;
- inspect cards;
- return to edit.

## Opportunity

This is the best place to catch wildly unequal card copy before launch.

---

# 31. Screen O08 — Invite Participants

## Purpose

Launch the exercise.

## Required information

### Invite URL

Copy button.

### Optional participant invitation

Future:

- email addresses;
- names;
- assigned origin city.

MVP can simply use one join link.

### Suggested message

> We're picking the trip without telling you what you're voting for. Takes ~3 minutes.

## Actions

- copy link;
- share link;
- activate trip.

### Primary CTA

**Launch**

## Exit

```text
Launch
 ↓
O09 Trip Status
```

---

# 32. Screen O09 — Trip Status / Completion Dashboard

## Purpose

Monitor progress without exposing individual answers prematurely.

## Required information

### Participants

```text
Dan       Complete
Mike      Complete
Chris     17 choices
Alex      Not started
Sam       Complete
```

### Overall progress

> 3 of 5 complete

### Trip settings

- active destination count;
- dates;
- current status.

## Actions

- copy invite link;
- edit content;
- pause trip;
- remove participant;
- reset participant;
- view own results.

### Important privacy rule

Do not show organizer another participant's interim destination scores before completion unless explicitly designed that way.

## Exit

When everyone finishes:

```text
O09
 ↓
P13 Group Reveal
```

---

# 33. Screen O10 — Trip Settings

## Purpose

Manage configuration after creation.

## Sections

### Basics

- name;
- dates;
- status.

### Participants

- membership;
- roles;
- origins.

### Destinations

- active candidate set.

### Algorithm

Potentially later:

- minimum comparisons;
- maximum comparisons;
- model version.

Avoid exposing algorithm configuration in MVP unless necessary.

### Danger zone

- reset all responses;
- delete trip.

---

# 34. Organizer Edge Cases

## Destination added after participants start

System must decide whether:

- new destination enters unfinished participants' comparisons;
- completed participants must answer supplemental comparisons;
- results remain incomparable.

### Recommendation

For MVP:

**Lock destination set once the first participant begins.**

To change it:

> Reset the exercise or duplicate the trip.

This eliminates substantial complexity.

Incremental destination additions are out of scope for this fixed study.

---

## Activity edited mid-study

Same concern.

Recommendation:

Once first comparison is submitted:

- allow typo/minor copy fixes;
- prevent changing destination association or core meaning;
- version major edits.

---

## Participant accidentally resets

Require confirmation.

Raw comparisons could optionally be soft-deleted rather than destroyed.

---

# 35. Navigation Architecture

Participant navigation should be intentionally minimal.

## During quiz

No full application navigation.

Only:

```text
Logo / trip name
Progress
Exit
```

The comparison is the experience.

---

## After completion

Standard app navigation may appear:

```text
My Result
Group Result
Destinations
Trip
Profile
```

---

## Organizer

Additional:

```text
Overview
Destinations
Experiences
Participants
Settings
```

---

# 36. Screen Inventory

## Participant Screens

| ID | Screen | Required for MVP? | Primary purpose |
|---|---|---:|---|
| P01 | Public Landing / Sign In | Yes | Explain concept and authenticate |
| P02 | Join Trip | Yes | Confirm membership |
| P03 | How It Works | Yes | Teach mechanic |
| P04 | Activity Comparison | Yes | Core pairwise choice |
| P05 | Reason Micro-question | Maybe | Capture occasional explicit rationale |
| P06 | Analysis Transition | Yes | Create reveal beat |
| P07 | Preference Profile | Yes | Explain inferred tastes |
| P08 | Destination Reveal | Yes | Reveal ranking |
| P09 | Destination Detail / Why | Yes | Explain result |
| P10 | Final Gut Check | Recommended | Capture conscious finalist preference |
| P11 | Personal Results | Yes | Persistent summary |
| P12 | Waiting for Group | Yes | Handle incomplete group |
| P13 | Group Reveal | Yes | Group ranking/payoff |
| P14 | Group Destination Detail | Recommended | Explain group result |
| P15 | Finalist Comparison | Out of scope | The final gut check handles the required group decision action. |
| P16 | Resume | Yes | Continue incomplete session |

**MVP participant screens: approximately 13–14.**

Several can be implemented as states or overlays rather than distinct routes.

---

# 37. Organizer Screens (post-MVP)

| ID | Screen | Required for MVP? | Primary purpose |
|---|---|---:|---|
| O01 | Organizer Dashboard | Post-MVP | View/create trips |
| O02 | Create Trip | Post-MVP | Name and dates |
| O03 | Travelers & Origins | Post-MVP | Logistics context |
| O04 | Destination Selection | Post-MVP | Define candidate pool |
| O05 | Activity Library | Post-MVP | Manage experience cards |
| O06 | Activity Editor | Post-MVP | Create/edit one card |
| O07 | Game Preview | Post-MVP | QA destination blindness |
| O08 | Invite Participants | Post-MVP | Launch |
| O09 | Trip Status | Post-MVP | Monitor completion |
| O10 | Trip Settings | Post-MVP | Manage configuration |

**V1 organizer screens: none.**

---

# 38. Route Proposal

A clean URL structure could look like:

```text
/
 /login
 /trips

 /join/:inviteCode

 /trip/:groupId
 /trip/:groupId/play
 /trip/:groupId/results
 /trip/:groupId/group-results
 /trip/:groupId/destinations/:destinationId

 /trip/:groupId/admin
 /trip/:groupId/admin/destinations
 /trip/:groupId/admin/activities
 /trip/:groupId/admin/activities/:activityId
 /trip/:groupId/admin/participants
 /trip/:groupId/admin/settings
```

Some screens should remain internal state rather than routes:

- P05 reason question;
- P06 analysis transition;
- P10 gut check.

---

# 39. Primary State Machine

```text
UNAUTHENTICATED
      │
      ▼
AUTHENTICATED
      │
      ├── no membership ───────► JOIN
      │
      └── member
             │
             ▼
        NOT_STARTED
             │
             ▼
         IN_PROGRESS
             │
             ├── comparison
             ├── micro-question
             └── resume
             │
             ▼
      INDIVIDUAL_COMPLETE
             │
             ├── destination-free personal profile
             │
             ▼
       GROUP_INCOMPLETE
             │
             ▼
        GROUP_COMPLETE
             │
             ▼
         GROUP_RESULTS
```

---

# 40. Information Architecture Summary

There are really **three product modes**.

## Mode 1 — Discover

Destination-blind.

```text
How it works
Comparison
Micro-question
Progress
```

The user knows activities but not destinations.

---

## Mode 2 — Reveal

Destination-aware.

```text
Preference profile (destination-free)
Waiting for group
Why this destination
Hidden activity reveals
Gut check
```

The trick is explained.

---

## Mode 3 — Decide

Practical.

```text
Group results
Airfare
Travel friction
Weather
Finalists
```

The application moves from preference psychology to real trip planning.

This separation is important.

Do not mix Mode 3 logistical information into Mode 1.

---

# 41. Emotional Journey

Ideal participant emotional curve:

```text
Invite
  🤨
"What's this?"

Landing
  🙂
"Okay, kinda clever."

Early comparisons
  😄
"This is easy."

Middle comparisons
  🤔
"Oh damn, that's hard."

Near completion
  👀
"I wonder what I'm picking."

Preference reveal
  😮
"That's actually pretty accurate."

Destination reveal
  🤯
"Wait—that was GUATEMALA?"

Results
  😏
"Okay, this is cool."

Group reveal
  😂
"Apparently we all want to climb a volcano."
```

The highest-value emotional moments are:

1. **first realization that the comparisons are genuinely hard;**
2. **preference-profile recognition;**
3. **hidden activity → destination reveal;**
4. **group consensus / disagreement reveal.**

Design effort should concentrate disproportionately on these moments.

---

# 42. Primary Friction Risks

## 1. Sign-in before value

Google OAuth adds persistence but creates friction before the user experiences the gimmick.

### Potential test

Allow the demo comparison before sign-in, then request authentication.

---

## 2. Biased activity copy

Probably the greatest product-quality risk.

Poorly balanced descriptions undermine the ranking model even if the math is perfect.

### Mitigation

- normalized writing templates;
- activity portfolio review;
- preview mode;
- future automated content-quality checks.

---

## 3. Survey fatigue

Adaptive comparisons must actually converge.

If users consistently reach 35–40 questions, the experience may become tedious.

### Target

Median completion under approximately 4 minutes.

---

## 4. Destination leakage

If users identify destinations mid-test, brand bias returns.

### Mitigation

- no flags;
- no proper nouns;
- non-iconic imagery;
- card-writing review;
- activity-blindness QA.

---

## 5. Results that feel arbitrary

A sophisticated model is useless if the user does not understand its output.

### Mitigation

Reveal evidence:

> You picked activities from Antigua 5/6 times.

> Mountain experiences beat city-nightlife experiences 8/9 times.

---

## 6. Slow group completion

Social experiences are vulnerable to the least-engaged participant.

### Mitigation

- persistent progress;
- short completion time;
- easy invite reminders;
- useful destination-free preference profiles before group completion.

---

# 43. Success Metrics

## Acquisition / onboarding

- invite open rate;
- sign-in completion;
- join completion;
- start rate.

## Comparison experience

- median comparison time;
- comparisons completed;
- abandonment point;
- session completion rate;
- completion time.

## Model quality

- repeated-comparison consistency;
- final gut-check agreement;
- top-3 stability;
- user-rated result accuracy.

Potential post-result question:

> **How much does this ranking feel like you?**

1–5.

## Social/group

- percentage of groups reaching full completion;
- time from first participant start to final participant completion;
- group-result views;
- shares/screenshots;
- finalist interactions.

## Organizer

- trip creation completion;
- destinations/activity validation errors;
- invite creation rate;
- time to launch.

---

# 44. MVP Golden Path

The absolute minimum participant experience should feel like this:

```text
Invite link
   ↓
Google sign-in
   ↓
Join trip
   ↓
10-second explanation
   ↓
Usually 28–35 rapid comparisons (24 minimum; 40 maximum)
   ↓
Preference profile
   ↓
Waiting for group
   ↓
Group destination reveal
   ↓
Why the top five ranked highly
   ↓
Final gut check
   ↓
Results
```

The participant should be able to complete the entire active portion in one short phone session.

---

# 45. MVP Build Inventory

If implementation simplicity matters, several conceptual screens can share components/routes.

## Unique major UI templates actually required

### 1. Auth / landing template

Supports:

- P01
- P02
- P16

### 2. Setup/instruction template

Supports:

- P03

### 3. Comparison engine

Supports:

- P04
- P05
- O07

### 4. Reveal/results template

Supports:

- P06
- P07
- P08
- P10

### 5. Destination detail template

Supports:

- P09
- P14

### 6. Results dashboard template

Supports:

- P11
- P12
- P13

The organizer shell and form/editor are post-MVP. V1 needs only the six participant templates above.

---

# 46. Recommended Next UX Artifacts

This journey map should feed directly into:

1. **Information architecture / route map**
2. **Screen-level requirements**
3. **Comparison interaction design**
4. **Low-fidelity wireframes**
5. **Results/reveal interaction storyboard**
6. **Activity-card content design system**
7. **Organizer workflow**
8. **Usability-test plan**

The first design problem to solve in depth should be **P04 — Activity Comparison**, because the quality and rhythm of that one screen determine whether the entire concept works.
