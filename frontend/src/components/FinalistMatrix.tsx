import type { GroupResultsResponse, RosterUser } from '@lgs/shared';

type Props = {
  finalists: GroupResultsResponse['group'];
  ranks: GroupResultsResponse['finalistRanks'];
  travelerName: (user: RosterUser) => string;
  currentUser?: RosterUser;
  onSelect: (destinationId: string) => void;
};

/**
 * A compact, post-gate reading of the five finalists. A 6+ says only that a
 * finalist did not make that traveler's individual top five; it never implies
 * a negative vote or exposes activity-by-activity history.
 */
export function FinalistMatrix({ finalists, ranks, travelerName, currentUser, onSelect }: Props) {
  const roster = ranks[0]?.ranks.map(({ user }) => user) ?? [];

  return (
    <section className="finalist-matrix" aria-labelledby="finalist-matrix-title">
      <div className="finalist-matrix__heading">
        <div>
          <p className="eyebrow">Five ways to read the room</p>
          <h2 id="finalist-matrix-title">The crew’s finalist map</h2>
        </div>
        <p>Each number is that traveler’s personal place order. <strong>6+</strong> means it landed outside their top five.</p>
      </div>
      <div className="finalist-matrix__scroll">
        <table>
          <caption>Each traveler’s rank for the five group finalists.</caption>
          <thead>
            <tr>
              <th scope="col">Finalist</th>
              {roster.map((user) => <th key={user} scope="col" className={currentUser === user ? 'is-current-user' : undefined}>
                {travelerName(user)}{currentUser === user ? ' (you)' : ''}
              </th>)}
            </tr>
          </thead>
          <tbody>
            {finalists.map((finalist) => {
              const row = ranks.find((item) => item.destinationId === finalist.id);
              return <tr key={finalist.id}>
                <th scope="row">
                  <button onClick={() => onSelect(finalist.id)} aria-label={`Open details for ${finalist.name}`}>
                    <span aria-hidden="true">#{finalist.rank}</span>{finalist.name}
                  </button>
                </th>
                {roster.map((user) => {
                  const rank = row?.ranks.find((entry) => entry.user === user)?.rank ?? '6+';
                  return <td key={user} className={currentUser === user ? 'is-current-user' : undefined}>{typeof rank === 'number' ? `#${rank}` : rank}</td>;
                })}
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
