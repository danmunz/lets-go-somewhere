import {
  ROSTER_USERS,
  socialBallotTopFiveSchema,
  type GroupDisplayMode,
  type GroupInsight,
  type RosterUser,
  type SocialBallotRank,
  type TransparentFinalistRankRow,
  type TransparentGroupBallot,
  type TransparentGroupFinalist,
} from '@lgs/shared';

const POINTS_BY_RANK = [5, 4, 3, 2, 1] as const;

const ROSTER_NAMES: Record<RosterUser, string> = {
  dan: 'Dan',
  james: 'James',
  john: 'John',
  matt: 'Matt',
  peter: 'Peter',
};

export type SocialBallotInput = Readonly<{
  ballots: Readonly<Record<RosterUser, readonly string[]>>;
  /** Existing controlled profile-theme labels, ordered strongest first. */
  profileThemes: Readonly<Record<RosterUser, readonly string[]>>;
  /** Seed presentation data used solely for evidence-bound copy templates. */
  destinationNames: Readonly<Record<string, string>>;
}>;

type Tally = Readonly<{
  id: string;
  points: number;
  firstPlaceVotes: number;
  supporters: RosterUser[];
}>;

type ResolvedInput = Readonly<{
  ballots: Record<RosterUser, readonly string[]>;
  profileThemes: Record<RosterUser, readonly string[]>;
  destinationNames: Readonly<Record<string, string>>;
}>;

function resolveInput(input: SocialBallotInput): ResolvedInput {
  const ballots = {} as Record<RosterUser, readonly string[]>;
  const profileThemes = {} as Record<RosterUser, readonly string[]>;
  for (const user of ROSTER_USERS) {
    const ballot = socialBallotTopFiveSchema.parse(input.ballots[user]);
    const themes = input.profileThemes[user];
    if (!themes || themes.length === 0 || themes.some((theme) => !theme.trim())) {
      throw new Error(`Social ballot requires at least one controlled profile theme for ${user}.`);
    }
    ballots[user] = ballot;
    profileThemes[user] = themes;
    for (const id of ballot) {
      if (!input.destinationNames[id]) throw new Error(`Social ballot is missing a destination name for ${id}.`);
    }
  }
  return { ballots, profileThemes, destinationNames: input.destinationNames };
}

function compareTallies(left: Tally, right: Tally): number {
  return right.points - left.points
    || right.firstPlaceVotes - left.firstPlaceVotes
    || right.supporters.length - left.supporters.length
    || left.id.localeCompare(right.id);
}

function samePublishedTally(left: Tally, right: Tally): boolean {
  return left.points === right.points
    && left.firstPlaceVotes === right.firstPlaceVotes
    && left.supporters.length === right.supporters.length;
}

function userList(users: readonly RosterUser[]): string {
  const names = users.map((user) => ROSTER_NAMES[user]);
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`;
}

function talliesFor(input: ResolvedInput): Tally[] {
  const tallies = new Map<string, { points: number; firstPlaceVotes: number; supporters: RosterUser[] }>();
  for (const user of ROSTER_USERS) {
    input.ballots[user].forEach((id, index) => {
      const tally = tallies.get(id) ?? { points: 0, firstPlaceVotes: 0, supporters: [] };
      tally.points += POINTS_BY_RANK[index]!;
      if (index === 0) tally.firstPlaceVotes += 1;
      tally.supporters.push(user);
      tallies.set(id, tally);
    });
  }
  return [...tallies].map(([id, tally]) => ({ id, ...tally })).sort(compareTallies);
}

function displayedRank(tallies: readonly Tally[], index: number): number {
  let rank = 1;
  for (let current = 1; current <= index; current += 1) {
    if (!samePublishedTally(tallies[current - 1]!, tallies[current]!)) rank = current + 1;
  }
  return rank;
}

function displayModeFor(tallies: readonly Tally[]): GroupDisplayMode {
  const [first, second] = tallies;
  if (!first || !second) return 'shared-shortlist';
  if (first.supporters.length >= 3 && first.points - second.points >= 3) return 'broad-leader';
  if (tallies.every((tally) => tally.supporters.length < 3)) return 'no-consensus';
  // A close pair that each has broad support is more useful to frame as a
  // shared shortlist than as a hair-splitting race. This deliberately also
  // covers an unresolved shared first-place tie.
  if (first.supporters.length >= 3 && second.supporters.length >= 3 && first.points - second.points <= 2) {
    return 'shared-shortlist';
  }
  if (first.points - second.points <= 2) return 'near-tie';
  return 'shared-shortlist';
}

function rankFor(id: string, ballot: readonly string[]): SocialBallotRank {
  const index = ballot.indexOf(id);
  return index === -1 ? 'outside-top-five' : index + 1;
}

function strongestBySupport(candidates: readonly Tally[], order: ReadonlyMap<string, number>): Tally | undefined {
  return [...candidates].sort((left, right) => right.supporters.length - left.supporters.length
    || (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.id) ?? Number.MAX_SAFE_INTEGER)
    || left.id.localeCompare(right.id))[0];
}

function chooseTwoCamps(finalists: readonly Tally[]): [Tally, Tally] | undefined {
  const pairs: Array<[Tally, Tally]> = [];
  for (let left = 0; left < finalists.length; left += 1) {
    for (let right = left + 1; right < finalists.length; right += 1) {
      const first = finalists[left]!;
      const second = finalists[right]!;
      const distinctSupporters = new Set([...first.supporters, ...second.supporters]);
      const disjoint = first.supporters.every((user) => !second.supporters.includes(user));
      if (disjoint && first.supporters.length >= 2 && second.supporters.length >= 2 && distinctSupporters.size >= 4) {
        pairs.push([first, second]);
      }
    }
  }
  return pairs.sort(([leftA, rightA], [leftB, rightB]) => (rightB.points + leftB.points) - (rightA.points + leftA.points)
    || `${leftA.id}:${rightA.id}`.localeCompare(`${leftB.id}:${rightB.id}`))[0];
}

function socialInsights(
  input: ResolvedInput,
  allTallies: readonly Tally[],
  finalists: readonly Tally[],
): GroupInsight[] {
  const order = new Map(allTallies.map((tally, index) => [tally.id, index]));
  const destinationName = (id: string) => input.destinationNames[id]!;
  const insights: Partial<Record<GroupInsight['kind'], GroupInsight>> = {};
  const strong = strongestBySupport(allTallies.filter((tally) => tally.supporters.length >= 3), order);
  if (strong) {
    insights['strong-shared-destination'] = {
      kind: 'strong-shared-destination',
      title: 'A crew favorite',
      body: `${destinationName(strong.id)} appears in ${strong.supporters.length} crew shortlists: ${userList(strong.supporters)}.`,
      destinationIds: [strong.id],
      users: strong.supporters,
    };
  }

  const split = strongestBySupport(
    allTallies.filter((tally) => tally.supporters.length >= 2 && ROSTER_USERS.length - tally.supporters.length >= 2),
    order,
  );
  if (split) {
    const outside = ROSTER_USERS.filter((user) => !split.supporters.includes(user));
    insights['split-destination'] = {
      kind: 'split-destination',
      title: 'A conversation starter',
      body: `${destinationName(split.id)} made ${userList(split.supporters)}’s shortlists, while ${userList(outside)} kept it outside their top five.`,
      destinationIds: [split.id],
      users: [...split.supporters, ...outside],
    };
  }

  const camps = chooseTwoCamps(finalists);
  if (camps) {
    const [first, second] = camps;
    insights['two-camps'] = {
      kind: 'two-camps',
      title: 'Two trip moods emerged',
      body: `${destinationName(first.id)} connected with ${userList(first.supporters)}; ${destinationName(second.id)} connected with ${userList(second.supporters)}.`,
      destinationIds: [first.id, second.id],
      users: [...first.supporters, ...second.supporters],
    };
  }

  const wildCards = ROSTER_USERS.flatMap((user) => {
    const id = input.ballots[user][0]!;
    const tally = allTallies.find((candidate) => candidate.id === id)!;
    return tally.supporters.length === 1 ? [{ user, tally }] : [];
  }).sort((left, right) => (order.get(left.tally.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.tally.id) ?? Number.MAX_SAFE_INTEGER)
    || left.user.localeCompare(right.user));
  const wild = wildCards[0];
  if (wild) {
    insights['wild-card'] = {
      kind: 'wild-card',
      title: `${ROSTER_NAMES[wild.user]}’s personal wild card`,
      body: `${destinationName(wild.tally.id)} is ${ROSTER_NAMES[wild.user]}’s #1 and no one else placed it in their top five.`,
      destinationIds: [wild.tally.id],
      users: [wild.user],
    };
  }

  const shared = strongestBySupport(allTallies.filter((tally) => tally.supporters.length === 2), order);
  if (shared) {
    insights['shared-destination'] = {
      kind: 'shared-destination',
      title: 'A shared stop',
      body: `${destinationName(shared.id)} appears in both ${userList(shared.supporters)}’s top fives.`,
      destinationIds: [shared.id],
      users: shared.supporters,
    };
  }

  const leadingThemeGroups = new Map<string, RosterUser[]>();
  for (const user of ROSTER_USERS) {
    const theme = input.profileThemes[user][0]!;
    const group = leadingThemeGroups.get(theme) ?? [];
    group.push(user);
    leadingThemeGroups.set(theme, group);
  }
  const themeGroups = [...leadingThemeGroups.entries()]
    .filter(([, users]) => users.length >= 2)
    .sort(([leftTheme, leftUsers], [rightTheme, rightUsers]) => rightUsers.length - leftUsers.length || leftTheme.localeCompare(rightTheme));
  const sharedTheme = themeGroups[0];
  if (sharedTheme) {
    const [theme, users] = sharedTheme;
    insights['shared-theme'] = {
      kind: 'shared-theme',
      title: 'A shared travel pull',
      body: `${userList(users)} all leaned toward ${theme.toLowerCase()}.`,
      users,
    };
  }
  const contrasting = themeGroups.find(([theme]) => theme !== sharedTheme?.[0]);
  if (sharedTheme && contrasting) {
    const [firstTheme, firstUsers] = sharedTheme;
    const [secondTheme, secondUsers] = contrasting;
    insights['contrasting-themes'] = {
      kind: 'contrasting-themes',
      title: 'Two travel instincts',
      body: `${userList(firstUsers)} leaned toward ${firstTheme.toLowerCase()}, while ${userList(secondUsers)} leaned toward ${secondTheme.toLowerCase()}.`,
      users: [...firstUsers, ...secondUsers],
    };
  }

  const priority: GroupInsight['kind'][] = [
    'strong-shared-destination',
    'split-destination',
    'two-camps',
    'wild-card',
    'shared-destination',
    'shared-theme',
    'contrasting-themes',
  ];
  return priority.flatMap((kind) => insights[kind] ? [insights[kind]!] : []).slice(0, 3);
}

/**
 * Creates the complete, deterministic social ballot stored in a v2 reveal.
 * The function intentionally operates only on ordered top fives and controlled
 * profile labels; raw comparisons and model utilities never enter this layer.
 */
export function buildTransparentSocialBallot(input: SocialBallotInput): TransparentGroupBallot {
  const resolved = resolveInput(input);
  const allTallies = talliesFor(resolved);
  const selected = allTallies.slice(0, 5);
  if (selected.length !== 5) throw new Error('A social ballot requires at least five distinct ranked destinations.');
  const finalists: TransparentGroupFinalist[] = selected.map((tally, index) => ({
    rank: displayedRank(allTallies, index),
    id: tally.id,
    points: tally.points,
    firstPlaceVotes: tally.firstPlaceVotes,
    topFiveSupporters: tally.supporters,
  }));
  const finalistRanks: TransparentFinalistRankRow[] = selected.map((tally) => ({
    destinationId: tally.id,
    ranks: ROSTER_USERS.map((user) => ({ user, rank: rankFor(tally.id, resolved.ballots[user]) })),
  }));

  return {
    finalists,
    finalistRanks,
    displayMode: displayModeFor(allTallies),
    insights: socialInsights(resolved, allTallies, selected),
  };
}
