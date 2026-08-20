# Let's Go Somewhere — Project Origins and Intent

## Overview

**Let's Go Somewhere** began as a practical problem:

A group of five friends wanted to choose a destination for a short guys trip in November 2026.

### Related documents

- [Product specification](spec.md) turns this original problem into product requirements.
- [User journey map](ux.md) defines the experience that delivers on those requirements.
- [Architecture overview](architecture.md) defines the technical structure that supports them.

The trip parameters were fairly constrained:

- Dates: **November 11–15, 2026**
- Five travelers
- Two departing from Washington, DC
- Two departing from New York
- One departing from San Francisco
- Roughly two travel days and three full destination days
- Airfare should be reasonable from all three origin cities
- The group is not especially interested in beach- or snorkeling-centric trips
- One traveler is in AA recovery, so drinking and nightlife should not be central to the itinerary
- The group prefers places with a strong sense of place, interesting food, history, culture, outdoor activity, unusual experiences, or some combination of those things

The initial exercise was simply to generate and research a broad list of possible destinations.

That list eventually grew to approximately sixteen serious candidates, including places such as Oaxaca, Antigua, Quito, Medellín, Guanajuato, Lima, Cartagena, Puebla, Bogotá, and several less obvious options.

At that point, the problem changed.

The difficult question was no longer:

> What are some good places to go?

There were already plenty.

The question became:

> **How do five people actually figure out which of these trips they want?**

---

# The Problem with Normal Group Trip Selection

The obvious approach would be to send everyone a list of destinations and ask them to rank them.

That approach has several problems.

## Destination names carry baggage

People have pre-existing associations with places.

Someone may think:

> "I've heard Medellín is cool."

or:

> "Guatemala doesn't really interest me."

even if the actual experiences available in Guatemala are much closer to what that person enjoys.

A destination ranking therefore measures a mixture of:

- genuine trip preference;
- familiarity;
- reputation;
- marketing;
- preconceived ideas;
- prior knowledge;
- brand recognition.

The goal of this project is to isolate the first of those as much as possible.

---

## Ranking sixteen things is cognitively unpleasant

Most people cannot meaningfully answer:

> Is Quito my fourth favorite or my seventh favorite?

But people can answer much more naturally:

> Would I rather hike through volcanic highlands or explore an underground historic city?

The latter is a much easier human judgment.

---

## Group averages hide important differences

Simply averaging five rankings can also produce bad recommendations.

A destination that two people adore and two people hate may average similarly to a destination that everyone likes quite a lot.

Those are very different group dynamics.

A good group decision system should be able to distinguish:

- consensus;
- enthusiasm;
- polarization;
- veto risk;
- broadly acceptable compromises.

---

# The Core Idea

The project evolved into a destination-selection game based on **destination-blind pairwise experience comparisons**.

Instead of asking:

> Antigua or Quito?

the application asks:

> **Which sounds more fun?**
>
> Camp above the clouds beside an erupting volcano  
> **OR**  
> Ride a cable car high into the Andes and hike along a mountain ridge

The user is deliberately **not told which destination either experience belongs to**.

They simply choose the experience that sounds better.

The application repeats this process across a carefully designed set of activities.

Behind the scenes, the system uses those choices to infer:

- which individual experiences appeal to the user;
- which types of experiences appeal to the user;
- which destinations contain the strongest bundle of those experiences;
- how confident the system is about those preferences.

At the end, the destinations are revealed.

The fundamental interaction is therefore:

> **Tell us what sounds fun. We'll tell you where you want to go.**

---

# Why Activities Instead of Destinations

This was the most important conceptual shift in the project.

An early version of the idea used adaptive destination-vs-destination comparisons:

> Antigua vs. Quito  
> Medellín vs. Cartagena  
> Lima vs. Oaxaca

That was already better than manually ranking sixteen places.

But it still allowed destination reputation to influence the outcome.

The concept became significantly stronger when the comparison unit changed from **destination** to **experience**.

Now each destination is represented by several activities.

For example, Antigua might contribute experiences involving:

- an overnight volcano hike;
- historic ruins;
- mountain coffee farms;
- markets;
- highland exploration.

Quito might contribute:

- Cotopaxi;
- mountain cable-car hiking;
- historic Quito;
- cloud forest excursions;
- markets and traditional food.

A user might encounter individual examples from both places throughout the exercise without knowing how those choices are accumulating.

This creates a much cleaner preference signal.

---

# The Intended Reveal

The hidden-destination mechanic is not just methodological.

It is also the central emotional payoff of the product.

A successful session should build toward a moment like:

> **Your #1 trip is Antigua, Guatemala.**

followed by:

> That volcano hike you kept choosing?  
> That was Acatenango.

and:

> You consistently favored mountain adventure, historic places, and unusual local experiences.

The ideal reaction is:

> "Oh. Yeah. That actually makes sense."

The result should feel both **surprising and obvious in retrospect**.

---

# What the Product Is Trying to Learn

The system is designed to infer preferences at multiple levels.

## Activity preference

Which specific experience sounds more appealing?

Example:

> Volcano hike > food tour

---

## Experience-category preference

Across many choices, does the user tend to favor:

- adventure;
- nature;
- history;
- food;
- urban exploration;
- archaeology;
- unusual local experiences;
- physical activity;
- passive sightseeing;
- nightlife;
- relaxation?

These categories help explain results, but they should not replace the actual pairwise choices.

---

## Destination preference

Which destinations contain the strongest combination of experiences the user repeatedly prefers?

This becomes the user's **pure preference ranking**.

---

# Pure Preference vs. Practical Recommendation

Another important design principle is that the system should separate:

> **What trip do you want?**

from:

> **What trip should you actually book?**

During the destination-blind exercise, practical factors should generally stay hidden.

Users should not choose one experience over another because:

- its airfare is $125 cheaper;
- the flight is nonstop;
- the weather is slightly better;
- the destination is easier to reach.

Those are real considerations, but they answer a different question.

After the preference model is complete, the application can layer in:

- airfare from the group's actual origin cities;
- flight duration;
- layovers;
- ground-transfer time;
- weather;
- suitability for a three-full-day itinerary.

The application can therefore eventually show two rankings:

## Pure preference

> Where your choices suggest you most want to go.

## Practical trip fit

> What works best for this specific November 11–15 trip.

This distinction is important.

For example, someone might genuinely prefer Oaxaca but discover that Antigua offers a nearly identical preference fit with substantially easier flights for the chosen dates.

That is useful information rather than a contradiction.

---

# Why Pairwise Comparison

The system relies on repeated pairwise decisions because humans are generally better at making relative judgments than absolute ones.

It is easy to ask:

> Which of these two experiences sounds better?

It is much harder to ask:

> On a scale from 1–10, how interested are you in colonial architecture?

or:

> Rank these sixteen destinations.

Pairwise comparison also allows the system to adapt.

Early questions can explore broad preferences.

Later questions can focus on uncertainty.

For example:

If Antigua and Quito appear nearly tied, the system can deliberately show additional activities from those destinations.

If one destination is clearly near the bottom, the application does not need to keep testing it against obvious favorites.

This allows the system to derive a useful ranking without asking every possible question.

---

# Adaptive Rather Than Tournament-Based

The application is not intended to run a fixed bracket.

It should not behave like:

```text
Round 1
Round 2
Semifinal
Final
```

A bracket throws away too much information.

Instead, the ranking engine should repeatedly ask:

> **What comparison would teach us the most right now?**

That may mean:

- comparing two activities whose predicted preference is close;
- testing activities from destinations whose overall ranking is uncertain;
- reusing an activity against a different opponent;
- distinguishing whether the user likes a destination or simply likes one category of experience.

The number of destinations can therefore change without redesigning the interaction.

Adding three destinations should produce a few additional comparisons, not require an entirely new tournament structure.

---

# Group Purpose

Although the individual ranking experience is important, this project ultimately exists to solve a **group decision**.

Each traveler completes the game independently.

Only after individual preferences are established does the application aggregate them.

The group view should reveal more than a single average.

Useful outputs include:

## Consensus favorite

The strongest overall destination.

## Most universally liked

The destination with the least resistance across the group.

## Most polarizing

A destination some travelers love and others dislike.

## Dark horse

A destination that unexpectedly performs well.

## Strongest veto

A destination with meaningful support but one traveler who strongly opposes it.

## Shared preference

An experience type that repeatedly appealed to everyone.

For example:

> **Apparently all five of you want to climb a volcano.**

These observations are useful because choosing a group trip is partly analytical and partly social.

The results screen should help start the conversation rather than pretend an algorithm can make the entire decision automatically.

---

# What the Product Is Not

This application is not intended to be:

## A general travel search engine

It does not need to discover every possible destination in the world.

The organizer provides a curated candidate set.

---

## A booking engine

The immediate goal is destination selection, not airline or hotel transactions.

Booking integrations may come later, but they are not the core product.

---

## A personality test

Preference categories exist to help explain choices.

The user should never feel that they are completing a quiz about whether they are an "Adventure Explorer" or "Cultural Foodie."

The actual behavior—pairwise choices—is more important than labels.

---

## A black-box recommendation system

The reveal should explain itself.

Users should be able to see:

- which hidden experiences belonged to which destination;
- which activities they repeatedly selected;
- what patterns the model inferred.

The algorithm should create insight, not mystique.

---

# Intended User Experience

The desired emotional arc is roughly:

```text
Invitation
    ↓
"What is this?"

First comparisons
    ↓
"Oh, this is easy."

Middle comparisons
    ↓
"Damn, that's actually a hard choice."

Near completion
    ↓
"I wonder what I've been voting for."

Preference reveal
    ↓
"Yeah, that sounds like me."

Destination reveal
    ↓
"WAIT—that was Guatemala?"

Group reveal
    ↓
"Apparently we're all going to climb a volcano."
```

The reveal is part of the product, not simply a results page.

---

# Original Use Case

The first implementation is being designed for a specific group:

- five friends;
- two based in Washington, DC;
- two based in New York;
- one based in San Francisco;
- traveling November 11–15, 2026;
- three full destination days;
- reasonable airfare is important;
- beach/snorkeling activities are not a major draw;
- alcohol-focused travel is inappropriate because one member is in AA recovery.

The candidate destination set was intentionally eclectic and included both expected and unexpected options.

The application should be architected so none of those details are hard-coded.

In the future, the same basic system could be used for:

- another guys trip;
- family vacations;
- bachelor/bachelorette trips;
- friend-group weekends;
- work offsites;
- couples choosing a vacation.

The first trip is the test case, not the permanent product definition.

---

# Product Objective

The primary objective is:

> **Help a small group discover which candidate destination best matches what they actually want to do, while reducing bias from destination reputation and avoiding the cognitive burden of manually ranking many options.**

Secondary objectives are:

- make preference discovery enjoyable;
- generate useful individual insight;
- reveal areas of group consensus and disagreement;
- incorporate practical travel constraints only after preference discovery;
- make the recommendation explainable;
- keep the experience short enough that every invited traveler actually completes it.

---

# Success Criteria

The concept is successful if:

1. A participant can complete the active preference exercise in approximately 3–5 minutes.
2. The process feels more like a game than a survey.
3. Participants generally believe the final preference profile describes them accurately.
4. The top destination ranking feels plausible after the hidden activities are revealed.
5. Participants occasionally discover a destination they would not have consciously selected beforehand.
6. Five travelers can complete the exercise independently without coordinating their answers.
7. Group results reveal useful consensus and polarization.
8. The final output materially helps the group narrow the destination list.

A particularly strong success signal would be a user saying:

> "I never would have picked that place from the list, but apparently I picked everything there."

That is exactly the bias the product is intended to surface.

---

# Guiding Product Principles

## Ask easy questions; infer hard answers

The user should never be responsible for solving the ranking problem.

Their task is simply:

> Which sounds more fun?

---

## Hide information only when hiding it improves the signal

Destination names are hidden during preference collection because they create bias.

Historical product direction: a completed traveler would see only their preference profile until the whole roster completed. The current one-trip flow intentionally changes that timing: an individual may browse an unranked named atlas and privately view only their own shortlist after completion; other travelers’ and group outcomes remain sealed until all five are complete and Dan opens the reveal gate. See [implementation status](implementation-status.md).

This is not secrecy for its own sake.

---

## Preserve raw choices

The canonical data is:

```text
Activity A vs. Activity B → Activity A
```

Preference scores and destination rankings are interpretations that may improve over time.

Raw decisions should remain available so future models can recompute results.

---

## Keep pure preference separate from logistics

First learn what the user wants.

Then determine what is practical.

Do not mix those questions prematurely.

---

## Make the algorithm explainable

A result should always be traceable back to actual choices.

---

## Favor group consensus without hiding disagreement

The purpose is to help five people choose a trip together, not merely identify the mathematical mean traveler.

---

## Keep the experience lightweight

A sophisticated ranking model is valuable only if users actually complete the game.

The complexity belongs behind the interface.

---

# Design and Engineering Handoff

Anyone continuing work on this project should preserve the following conceptual boundaries:

```text
CURATED DESTINATIONS
        ↓
DESTINATION-BLIND ACTIVITIES
        ↓
PAIRWISE USER CHOICES
        ↓
INDIVIDUAL PREFERENCE MODEL
        ↓
DESTINATION REVEAL
        ↓
PRACTICAL TRAVEL FACTORS
        ↓
GROUP AGGREGATION
        ↓
DECISION SUPPORT
```

Changing technology, visual design, ranking algorithms, or infrastructure is acceptable.

Breaking this sequence should be treated as a substantive product change.

The defining insight of the project is not the specific mathematical model or implementation stack.

It is this:

> **People are much better at telling you which experience they want than telling you which destination they want.**

The application exists to turn those easy, instinctive choices into a useful and surprising group travel decision.
