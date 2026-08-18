# Let's Go Somewhere — Product Specification

## 1. Concept

**Let's Go Somewhere** is a lightweight interactive site that helps each traveler discover which trip destinations they actually prefer.

The key mechanic is intentionally **destination-blind**.

Instead of asking:

> **Antigua or Quito?**

the site asks:

> **Which sounds more fun?**
>
> Hike to a ridge overlooking an erupting volcano and camp above the clouds  
> **OR**  
> Explore a labyrinth of tunnels beneath a colorful colonial mountain city

Users repeatedly choose between **specific experiences**, without being told which destinations those experiences belong to.

Behind the scenes, each activity is associated with a destination and one or more experience categories. The system learns:

1. Which kinds of experiences the user prefers
2. Which individual activities they find appealing
3. Which destinations contain the strongest overall bundle of those experiences

After the group reveal gate opens, the site reveals each user's inferred top-five destinations and the group result.

The central product idea becomes:

> **Tell us what sounds fun. We'll tell you where you should go.**

### Related documents

- [User journey map](ux.md) translates this product specification into participant and organizer flows.
- [Architecture overview](architecture.md) defines the implementation boundaries and persistence model.
- [Project origins and intent](project-origins-background.md) explains why destination blindness is central to the product.
- [Design system](design-system.md) defines the visual rules that keep comparisons fair and accessible.

---

# 2. Product Goals

The experience should:

- Avoid destination-name recognition and preconceived opinions
- Avoid forcing users to manually rank 16+ places
- Produce a reasonably stable individual ranking from a manageable number of choices
- Work whether there are 10, 16, 25, or more destinations
- Reveal not just *where* someone wants to go, but *why*
- Combine five individual preference models into a useful group recommendation
- Feel like a game rather than a survey

---

# 3. Core Data Model

The ranking system now has three important layers:

```text
Destination
    ↓
Activities
    ↓
Attributes / Experience Categories
```

A user never needs to see this structure while playing.

---

# 4. Destination Data

Each destination needs basic trip-level information.

Example:

```json
{
  "id": "antigua",
  "name": "Antigua",
  "country": "Guatemala",
  "tagline": "Colonial highland city surrounded by volcanoes",
  "coordinates": { "longitude": -90.733, "latitude": 14.558 },
  "gallery": [
    { "path": "/media/destinations/antigua-01.webp", "alt": "Editorial travel photograph", "photographerName": "…", "photographerUrl": "…", "sourceUrl": "…" },
    { "path": "/media/destinations/antigua-02.webp", "alt": "Editorial travel photograph", "photographerName": "…", "photographerUrl": "…", "sourceUrl": "…" },
    { "path": "/media/destinations/antigua-03.webp", "alt": "Editorial travel photograph", "photographerName": "…", "photographerUrl": "…", "sourceUrl": "…" }
  ],
  "airfare": {
    "nyc": 450,
    "dc": 475,
    "sfo": 575
  },
  "travelFriction": 2,
  "novemberWeather": "Dry season; mild days and cool nights"
}
```

Coordinates, galleries, airfare, and travel friction are **destination metadata**, not necessarily something shown during activity comparisons. Every destination has three locally hosted, credited gallery photos; this metadata is atlas/reveal-only.

Travel context can be displayed after completion/reveal but must not alter the blind ranking without an explicit later practical-ranking model.

---

# 5. Activity Data

Each destination should have roughly **5–8 activity cards**.

Example:

```json
{
  "id": "antigua-volcano-camp",
  "destinationId": "antigua",
  "title": "Camp above the clouds beside an erupting volcano",
  "description": "Hike into the highlands, spend the night on a ridge, and watch a neighboring volcano erupt after dark.",
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

Every activity has an opaque local card path. The private `seed/activity-media.json` catalog records that card's source URL, photographer, profile URL, and descriptive alt text; those credit fields never cross the comparison API boundary.

Another activity from the same destination:

```json
{
  "id": "antigua-coffee",
  "destinationId": "antigua",
  "title": "Visit a working coffee farm in the mountains",
  "description": "Walk through coffee fields, learn how the beans are grown and processed, and taste coffee where it is produced.",
  "attributes": {
    "adventure": 1,
    "nature": 3,
    "culture": 4,
    "food": 4,
    "history": 2,
    "urban": 0,
    "novelty": 3,
    "physicalIntensity": 1
  }
}
```

The system therefore does not learn merely:

> Dan likes Antigua.

It can learn:

> Dan likes Antigua **because several different experiences available there consistently match his preferences.**

---

# 6. Activity Portfolio Design

Every destination should have a reasonably balanced portfolio of experiences.

A useful target is:

- **Signature experience**
- **Outdoor/adventure experience**
- **History/culture experience**
- **Food/market experience**
- **Urban/wandering experience**
- **Distinctive/weird/local experience**

Not every destination needs all six categories.

The goal is not artificial symmetry. The goal is to avoid accidentally making one place sound much more exciting merely because its activities were written more dramatically.

For example, avoid comparisons like:

> **Camp beside an ERUPTING VOLCANO!!!**

versus:

> Visit a museum.

Activity descriptions should have similar:

- Length
- Specificity
- Energy
- Tone
- Level of detail

---

# 7. User Data

Very little is required:

```json
{
  "userId": "firebase-uid",
  "displayName": "Dan",
  "characterId": "dan",
  "groupId": "november-guys-trip"
}
```

Google authentication is required for the MVP. Each approved Google identity is assigned one roster profile for this one trip; the character is a display layer, not an identity or authorization mechanism.

### 7.1. Character Profile & Animation Schema

Each traveler profile maps to an illustrated character asset with defined 3D micro-animation states:

| `characterId` | Name | Default Role | Canonical roster asset |
|---|---|---|---|
| `"dan"` | Dan | Trip wrangler | `dan_cutout.png` |
| `"james"` | James | Curiosity engine | `james_cutout.png` |
| `"john"` | John | Good-times scout | `john_cutout.png` |
| `"matt"` | Matt | Trail negotiator | `matt_cutout.png` |
| `"peter"` | Peter | Wildcard energy | `peter_cutout.png` |

Legacy rendered variants are retained under `assets/images/old/`; they are not part of the production roster contract.

#### Client-side Animation Triggers:

- `CHARACTER_HOVER`: Enlarges to $1.12\times$ with playful 3D tilt/wiggle (`wiggle3D`).
- `CHARACTER_SELECT`: Triggers one 750 ms 360° lock-in spin and a live selection confirmation. Under reduced motion, color and shadow convey the same state without the spin.
- `PROGRESS_MILESTONE`: Fires micro-toast with animated avatar badge (at 25%, 50%, 75% complete).
- `GROUP_MEMBER_COMPLETE`: Triggers lobby token 360° spin + real-time toast alert.

---

# 8. Comparison Data

Every answer generates a record:

```json
{
  "userId": "dan",
  "activityA": "antigua-volcano-camp",
  "activityB": "quito-ridge",
  "winner": "antigua-volcano-camp",
  "timestamp": "..."
}
```

Optionally record:

```json
{
  "reason": "adventure"
}
```

if the user is occasionally asked what drove a particular decision.

---

# 9. The Ranking Math

## V1 approach

Use regularized Bradley–Terry/Elo-like activity scores, then derive destination scores from an equal-weighted, shrinkage-adjusted activity portfolio. Calculate preference signals only from the eight canonical activity attributes.

V1 must not estimate a free destination effect and a free activity effect for every card from a short session; that model is not identifiable at this data scale.

---

# 10. What V1 Can Explain

Suppose the user chooses:

```text
Antigua volcano hike
>
Cartagena fortress
```

That is evidence for Antigua, but it may mainly indicate a preference for outdoor adventure.

Then:

```text
Quito volcano excursion
>
Antigua market tour
```

Now we learn something more nuanced.

The system can infer both:

### Destination-level preference

```text
Antigua      +1.3
Quito        +1.2
Guanajuato   +0.8
Cartagena   -0.1
```

and:

### Experience preferences

```text
Adventure       +1.5
Nature          +1.2
History         +0.7
Food            +0.4
Urban exploring +0.2
```

This lets the final recommendation explain itself.

---

# 11. Portfolio Scoring Rules

V1 uses every card in a destination portfolio equally, with unobserved cards shrunk toward the population baseline. Do not overweight a destination’s strongest card: the result should reflect its bundle of experiences, not one unusually vivid activity.

Before the fixed roster uses the app for its one-shot decision, the portfolio scoring model must graduate to the hierarchical or regularized model with uncertainty and information-gain selection defined in the [one-trip roadmap](roadmap.md). Simulation and calibration must demonstrate improved top-five stability before it becomes the production default.

---

# 12. Avoiding a Mathematical Trap

Do **not** simply say:

> Antigua has six activities and the user picked four, therefore Antigua scored 67%.

Different activities will appear different numbers of times and against different opponents.

The model should consider:

- Strength of opponent
- Repeated comparisons
- Confidence
- Number of observations
- Attribute overlap

An activity beating another highly rated activity should mean more than beating an activity the user consistently rejects.

---

# 13. Choosing the Next Comparison

The adaptive comparison algorithm is the heart of the product.

It should balance three goals:

1. Learn broad experience preferences
2. Learn which destinations contain attractive bundles
3. Resolve uncertainty between destinations whose scores are close

---

# 14. Phase 1 — Broad Exploration

For the first several questions, compare experiences with very different attributes.

Examples:

> Volcano hike  
> **vs.**  
> Historic food market

> Underground mine tour  
> **vs.**  
> Street-art neighborhood exploration

> Ancient archaeological site  
> **vs.**  
> Mountain cable-car hike

This quickly establishes broad taste.

The system might infer:

```text
Adventure ↑
History ↑
Food ↔
Urban ↓
```

---

# 15. Phase 2 — Attribute Refinement

Then compare experiences that share a category.

Example:

> Explore a huge Maya archaeological complex in the jungle  
> **vs.**  
> Explore mountaintop pre-Columbian ruins overlooking a valley

Both are archaeology.

The comparison therefore tells us more about the **specific experiences and destinations** rather than merely establishing that the user likes archaeology.

Another:

> Hike to an active volcano crater  
> **vs.**  
> Hike through a mountain reserve overlooking a huge modern city

Both are outdoors/adventure.

---

# 16. Phase 3 — Destination Refinement

Once the system believes two destinations are close, deliberately sample more activities from each.

Internally:

```text
Antigua: 1.31 ± 0.20
Quito:   1.28 ± 0.24
```

The system might then compare:

```text
Antigua coffee farm
vs.
Quito cloud forest
```

and later:

```text
Antigua colonial ruins
vs.
Quito historic center
```

This provides enough evidence to separate the overall destination bundles.

---

# 17. Repeated Activities

Activities may appear more than once.

This is desirable.

Example:

```text
Acatenango > Cartagena fortress
Acatenango > Lima food market
Cotopaxi > Acatenango
```

The model now has a much better idea where the Acatenango experience sits relative to the rest of the field.

Repeats should be selective.

The user should not feel like the game is simply asking the same questions again.

---

# 18. Comparison Selection Algorithm

For every possible pair of activities, calculate an approximate **information value**.

Higher priority if:

- Predicted choice is near 50/50
- Activities belong to destinations whose rankings are uncertain
- One or both activities have insufficient comparisons
- The comparison helps distinguish between similar preference categories

Lower priority if:

- The same pair has already appeared
- The outcome appears extremely obvious
- Both destinations are already confidently near the bottom
- The two cards are nearly identical experiences

Conceptually:

```text
comparisonValue
=
uncertainty
× destinationImportance
× novelty
× coverageNeed
```

Pick from the highest-value comparisons.

---

# 19. How Many Questions?

Because there are multiple experiences per destination, there are many possible comparisons.

That is fine.

The entire point of adaptive testing is that users never need to see most of them.

For the current 24-destination, five-card portfolio:

```text
120 activities
7,140 possible activity pairs
```

Nobody answers 4,560 questions.

A useful target might be:

- Minimum: **24 comparisons**
- Typical: **28–35**
- Maximum: **40**

At ~5–8 seconds each, that still feels like a short game.

The system should stop when destination-ranking uncertainty falls below a useful threshold.

---

# 20. Scaling When Destinations Change

The system should never depend on a fixed tournament bracket.

Adding or removing destinations changes only the active dataset.

## Removing destinations

If the list drops from 16 to 12 destinations:

- Fewer destination scores need to be estimated
- Fewer comparisons are generally required
- Nothing else changes

## Adding destinations

If the list grows to 20 or 25 destinations:

- Add their activity portfolios
- Include them in adaptive comparison selection
- The system naturally asks a few more questions

Approximate UX expectations:

| Destinations | Activities each | Likely comparisons |
|---:|---:|---:|
| 8 | 5–6 | 15–20 |
| 12 | 5–6 | 20–25 |
| 20 | 5–8 | 28–35 |
| 24 | 5 | 28–35 |
| 30 | 5–8 | 35–45 |

The number of theoretical pairs explodes.

The number of **useful questions** does not.

---

# 21. UX Flow

## Screen 1 — Intro

> # What kind of trip do you actually want?
>
> We're picking a guys trip for Nov. 11–15.
>
> We'll show you two things you could do.
>
> Pick whichever sounds more fun.
>
> You won't know where they are until the end.
>
> **Usually 28–35 quick choices.**
>
> **Start**

This establishes the gimmick immediately.

---

# 22. Comparison Screen

The primary screen is extremely simple.

### Example

> ## WHICH SOUNDS BETTER?

### OPTION A

**Camp above the clouds beside an erupting volcano**

Hike into the mountains, spend the night on a ridge, and watch a neighboring volcano erupt after dark.

Historical V1 note: no image. Current comparisons may use opaque, activity-specific editorial photography as an intentionally accepted soft cue, without names or geographic metadata.

**I'D RATHER…** (shown on hover or keyboard focus)

### OR

### OPTION B

**Explore a surreal network of tunnels beneath a colorful mountain city**

Walk through old mining tunnels and underground roads before emerging into plazas and hillside neighborhoods.

Historical V1 note: no image. Current comparisons may use opaque, activity-specific editorial photography as an intentionally accepted soft cue, without names or geographic metadata.

**I'D RATHER…** (shown on hover or keyboard focus)

Destination names, countries, flags, airport codes, airfare, and overt destination labels should be hidden. Activity writing may retain authentic cultural and environmental detail; the goal is to reduce brand bias, not guarantee total geographic anonymity.

---

# 23. Images

Images can improve the experience, but they are risky.

A photograph may immediately reveal:

- Famous architecture
- A recognizable skyline
- Country-specific signs
- Flags
- Famous monuments

### Current product policy

The current product intentionally accepts locally hosted, activity-specific editorial photography as a soft cue, while holding back all explicit destination metadata and credit information until the completion-gated atlas. Each card image is selected to match the described activity, even when that makes geographic recognition more likely.

Examples:

- Hiking boots on volcanic terrain
- Market food
- Tunnel interior
- Cable car silhouette

Future image work must retain the same redaction boundary and credit policy; it is not a reason to move destination metadata into comparison responses.

Avoid iconic landmarks.

### V3
Use stylized illustrations generated specifically for each activity.

This may provide the most visually appealing experience while preserving destination blindness.

---

# 24. What Not to Show During Comparisons

Do not show:

- Destination
- Country
- Flag
- Airfare
- Flight time
- Weather
- Currency
- Language
- Famous landmark names
- Destination ranking

Those factors can be introduced later.

During the game, the question should remain:

> **Which experience sounds more appealing?**

---

# 25. Optional Reason Questions

Only occasionally—perhaps 3–5 times total—ask:

> ## What tipped that one for you?

Possible responses:

- Adventure
- Food
- History/culture
- Nature/scenery
- Weird/unusual
- Active/outdoors
- City exploration
- Just sounds more fun

These answers improve explanatory power but are not required for the core ranking.

A user should be able to skip them instantly.

---

# 26. Interaction Design

The experience should feel fast and tactile.

On selection:

1. Selected card lifts slightly
2. Losing card fades/slides away
3. Winner briefly occupies center
4. Progress advances
5. New pair enters

Target transition:

```text
400–600 ms
```

No confirmation dialog.

---

# 27. Progress

Avoid:

```text
Question 13 of 27
```

because the exact number may change.

Instead:

> **Learning your trip…**

```text
████████████░░░░░
About 70% there
```

or:

```text
18 choices made
```

Users do not need to know the algorithm's stopping condition.

---

# 28. Stopping Condition

Stop when the system can support a confident **top-five** destination set, not a complete ordering of every active destination.

Potential criteria:

- Every active destination has appeared at least twice
- Each current top-five destination has appeared at least three times
- The fifth-place boundary is stable under the V1 score model
- Remaining uncertainty is unlikely to change the top five

Hybrid rule:

```text
minimum comparisons: 24
target: 28–35
maximum: 40
```

If the system remains uncertain between two destinations, ask another comparison involving those destinations.

---

# 29. First Reveal: Preference Profile

The intended V1 profile is a destination-free recognition beat that explains what the system learned.

The accepted V3/V4 flow permits a completed participant to open the unranked named atlas before the group reveal. That does not retire this profile requirement: it should be added before or alongside atlas entry without implying a destination ranking. See [implementation status](implementation-status.md) for the current gap.

Example:

> # Okay. We know your type.

### You kept choosing:

```text
Mountains & adventure   █████
History & old places    ████
Strange local stuff     ████
Food                    ███
Urban exploration       ███
```

This builds anticipation before revealing where those preferences lead.

---

# 30. Group Reveal Gate

After a participant finishes, show an unranked destination atlas. The atlas may show every candidate destination’s name, general trip context, real map placement, and credited editorial photography, but must not expose personal or group scores, ranks, activity-response evidence, or another participant’s choices. Named results, destination details tied to a participant’s preferences, and sharing remain embargoed until all five roster members have finished and Dan opens the reveal gate.

# 31. Destination Reveal

Then:

> # Here's where you actually want to go.

Animate destination names into ranked positions.

Example:

```text
1  ANTIGUA, GUATEMALA
2  QUITO, ECUADOR
3  GUANAJUATO, MEXICO
4  MEDELLÍN, COLOMBIA
5  PUEBLA, MEXICO
...
```

Each destination can include a preference score:

```text
Antigua        91
Quito          87
Guanajuato     81
```

Do not present these as statistical percentages unless they actually represent probability.

Use labels such as:

> **Match score**

or:

> **Preference score**

---

# 31. Explain the Result

Each top destination should show evidence.

Example:

## 1. Antigua, Guatemala

**Why it fits you**

You repeatedly chose:

- Volcano hiking
- Highland exploration
- Colonial history
- Local food experiences

Activities from Antigua won **5 of 7 appearances**.

You also strongly preferred adventure and history experiences overall.

This makes the result feel earned rather than arbitrary.

---

# 32. Reveal the Hidden Activities

This is an important payoff.

Show:

> **That volcano hike you picked three times?**
>
> Acatenango, Guatemala.

> **The underground city you kept choosing?**
>
> Guanajuato, Mexico.

The user can suddenly see how all their prior decisions mapped onto the destinations.

This is likely one of the most entertaining moments in the product.

---

# 34. Display Practical Context After Preference Discovery

Pure preference and practical travel feasibility should be distinct.

First calculate:

> **What trip do you want?**

For V1, show curated, approximate context beside the revealed finalists:

```text
Preference score       92
Airfare                Good
Travel time            Good
November conditions    Excellent
Trip-length fit        Excellent
```

Do not calculate or label an overall practical score in V1. Airfare figures are display-only estimates and must be labeled approximate; flight duration, transfers, and dynamic fare feeds are deferred.

---

# 35. Final Gut Check

After the group reveal, show the five finalists and let each participant name the one they would actually book, or choose “need more research.” This is a discussion input, not a hidden recalculation of the blind ranking.

> # Final question.
>
> Now that you know what they are:
>
> **Which finalist would you actually book?**

Record this separately from blind comparisons and show it to the group as an explicit post-reveal preference.

---

# 36. Individual Result

Example:

> # Dan's trip ranking
>
> 1. Antigua
> 2. Quito
> 3. Guanajuato
> 4. Medellín
> 5. Puebla
>
> **Your trip type:**  
> Active + culturally distinctive + history-heavy.
>
> **Your surprise pick:** Guanajuato
>
> **Experience you liked most:** Overnight volcano hike
>
> **Hardest call:** Cotopaxi vs. Acatenango

---

# 37. Group Ranking

After all five travelers complete the game, aggregate their models.

Each user should first have their destination scores normalized.

Example:

```text
Dan
Antigua  1.00
Quito    0.91
Lima     0.63
...

Alex
Quito    1.00
Antigua  0.95
Lima     0.72
...
```

Then compute group metrics.

---

# 38. Group Scoring

Recommended group calculations:

### Mean preference score

Overall appeal.

### Average rank

Simple and understandable.

### Worst individual rank

Useful for identifying veto risk.

### Variance

Useful for identifying polarization.

The group winner should favor destinations that everyone likes rather than destinations that two people love and two people hate.

A possible group score:

```text
Group score
=
Mean preference
-
Polarization penalty
```

The penalty can be tuned.

---

# 39. Group Results

Example:

> # THE VERDICT

## 🥇 Antigua

**Everyone ranked it in their top 4.**

```text
Dan       #1
Mike      #2
Chris     #4
Alex      #1
Sam       #3
```

Then:

```text
1. Antigua
2. Quito
3. Guanajuato
4. Medellín
5. Lima
...
```

---

# 40. Group Awards

The system can generate entertaining secondary findings.

### Consensus Favorite

Highest combined score.

### Most Universally Liked

Lowest worst-person ranking.

### Most Polarizing

Highest variance.

### Dark Horse

Destination that ranked much higher than expected given initial recognition/familiarity.

### Strongest Veto

Destination with otherwise good scores but one extremely negative traveler.

### Shared Experience

Activity type everyone consistently liked.

Example:

> **Apparently all five of you want to climb a volcano.**

These are useful both socially and analytically.

---

# 41. Organizer Controls (post-MVP)

V1 has no organizer UI: its fixed trip configuration is loaded from version-controlled seed data. Any future organizer change must create or select a new immutable study snapshot; never modify a candidate set after the first response or silently rewrite a historical result.

A lightweight organizer interface should allow:

- Add destination
- Remove destination
- Add activity
- Remove activity
- Edit activity description
- Edit activity attributes
- Upload/change activity image
- Edit airfare
- Edit flight time/friction
- Change trip dates
- Activate/deactivate destinations
- See who has completed the game
- Reset individual results
- Reset entire group

No algorithm changes should be needed when destinations change.

---

# 42. Adding a New Destination

To add a destination:

1. Create destination record
2. Create 5–8 activity cards
3. Tag activity attributes
4. Add practical trip data
5. Activate destination

The adaptive model automatically incorporates it.

---

# 43. Removing a Destination

Set:

```json
{
  "active": false
}
```

Its activities are removed from future comparisons.

If results have already been collected, preserve the original snapshot and results. A changed candidate set must become a new study rather than altering historical comparisons or rankings.

---

# 44. Suggested Database Structure

Core tables:

```text
groups
users
destinations
activities
activity_attributes
comparisons
reason_responses
user_destination_scores
user_attribute_scores
```

Optional:

```text
flight_data
result_snapshots
```

---

# 45. MVP

The MVP needs:

- 24 destinations
- 5–8 activities per destination
- Destination-blind activity comparisons
- Activity attribute tags
- Information-gain-driven adaptive pair selection with coverage and fatigue safeguards
- Hierarchical or regularized Bradley–Terry activity scoring with calibrated uncertainty
- Destination aggregation
- 5 named users
- Individual top-five result set
- Basic group ranking
- Simple preference-profile reveal

V1 is a fixed seeded study for the five named roster members. It does **not** include self-serve trip creation, content editing, invitations, or an organizer dashboard.

That alone is enough to make the concept work.

---

# 46. Explicitly Out of Scope for This Trip

Activity-specific editorial photography and restrained selection/loading/reveal motion were deliberately shipped in V3/V4. Hierarchical preference modeling, uncertainty intervals, and information-gain selection are required before this fixed group uses the app; they are not deferred feature work.

The following are intentionally excluded because this is a one-trip experience, not a product platform:

- practical-versus-pure preference rankings and automatic airfare refresh;
- shareable result pages and comparison-history visualizations;
- organizer dashboard, invitations, content-editing UI, and multi-trip management;
- generalized group awards or platform analytics beyond the evidence needed for the group’s decision.

---

# 47. Key Design Principle

The user should never feel like they are evaluating destinations.

Their job is only:

> **Which of these two things sounds more fun?**

The software's job is to infer the complicated part:

> Given everything you chose, what experiences do you value, and which destination offers the strongest overall bundle?

That separation is the core of the product.

It removes brand recognition, reduces cognitive load, makes the result more surprising, and turns the final destination reveal into the payoff rather than the premise.
