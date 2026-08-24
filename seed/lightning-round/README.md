# Lightning Round candidate briefs

`destination-briefs.json` is the versioned, direct-comparison content set for the post-reveal Lightning Round. It is deliberately separate from `seed/destinations.json` and `seed/activities.json`, which remain the canonical content for the original destination-blind experience.

Each of the 24 records uses the existing destination ID and gallery lead image, but may reveal the place name, country, practical travel details, and researched experience detail. The records assume the fixed Nov. 11–15, 2026 trip window and a group departing from DC, NYC, and SF.

Required fields:

- identity and direct-card content: `id`, `name`, `country`, `photoPath`, `shortPitch`, and exactly three `highlights`;
- planning context: `weather`, `airfare`, `travel`, and `caveat`;
- provenance: non-empty `sources` with a title and URL, plus an ISO `researchedAt` date.

Airfare values are planning estimates in USD, not live quotes. They must be presented with their qualifier and treated as a prompt to verify the exact itinerary before booking. Sources are a concise starting point for research, not a claim of live availability or conditions.
