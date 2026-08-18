import type { GroupResultsResponse, RosterUser } from '@lgs/shared';
import { CrewReadMatrix } from '../components/CrewReadMatrix.js';
import { VerdictExplainer } from '../components/VerdictExplainer.js';

type Props = { results: GroupResultsResponse; travelerName: (user: RosterUser) => string };

/** Semantic post-gate additions that can be composed into the existing verdict scene. */
export function VerdictAdditions({ results, travelerName }: Props) {
  return <>
    <VerdictExplainer confidence={results.confidence} />
    <CrewReadMatrix finalists={results.group} ranks={results.finalistRanks} travelerName={travelerName} />
  </>;
}
