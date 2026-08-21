import type { RosterUser, TransparentGroupResultsResponse } from '@lgs/shared';

type Props = {
  finalists: TransparentGroupResultsResponse['group'];
  ranks: TransparentGroupResultsResponse['finalistRanks'];
  travelerName: (user: RosterUser) => string;
  currentUser?: RosterUser;
  onSelect: (destinationId: string) => void;
};

/**
 * A compact, post-gate reading of the published finalists. Outside top five
 * never implies a negative vote or exposes activity-by-activity history.
 */
export function FinalistMatrix({ finalists, ranks, travelerName, currentUser, onSelect }: Props) {
  const roster = ranks[0]?.ranks.map(({ user }) => user) ?? [];

  return (
    <section className="finalist-matrix" aria-labelledby="finalist-matrix-title">
      <div className="finalist-matrix__heading">
        <div>
          <p className="eyebrow">Everyone’s picks</p>
          <h2 id="finalist-matrix-title">Where each person put these five places.</h2>
        </div>
        <p>#1–#5 are personal placements. <strong>Outside top five</strong> means that place did not make someone’s top five—it is not a no vote.</p>
      </div>
      <div className="finalist-matrix__scroll" tabIndex={0} aria-label="Scrollable group ranking table">
        <table>
          <caption>Each person’s placement for these five places.</caption>
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
                  const rank = row?.ranks.find((entry) => entry.user === user)?.rank ?? 'outside-top-five';
                  return <td key={user} className={currentUser === user ? 'is-current-user' : undefined}>{typeof rank === 'number' ? `#${rank}` : 'Outside top five'}</td>;
                })}
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
