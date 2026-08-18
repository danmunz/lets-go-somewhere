import type { GroupResultsResponse, RosterUser } from '@lgs/shared';

type Props = {
  finalists: GroupResultsResponse['group'];
  ranks: GroupResultsResponse['finalistRanks'];
  travelerName: (user: RosterUser) => string;
};

/** The post-gate rank matrix is a real table, never a decorative color grid. */
export function CrewReadMatrix({ finalists, ranks, travelerName }: Props) {
  return (
    <section className="crew-read-matrix" aria-labelledby="crew-read-title">
      <h2 id="crew-read-title">Crew read</h2>
      <table>
        <caption>How each traveler ranked the group’s five finalists after the reveal.</caption>
        <thead>
          <tr>
            <th scope="col">Finalist</th>
            {ranks[0]?.ranks.map(({ user }) => <th key={user} scope="col">{travelerName(user)}</th>)}
          </tr>
        </thead>
        <tbody>
          {finalists.map((finalist) => {
            const row = ranks.find((item) => item.destinationId === finalist.id);
            return <tr key={finalist.id}><th scope="row">#{finalist.rank} {finalist.name}</th>{row?.ranks.map(({ user, rank }) => <td key={user}>{typeof rank === 'number' ? `#${rank}` : rank}</td>)}</tr>;
          })}
        </tbody>
      </table>
    </section>
  );
}
