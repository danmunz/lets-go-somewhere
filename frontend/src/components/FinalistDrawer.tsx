import type { TransparentGroupResultsResponse } from '@lgs/shared';
import { MediaImage } from './MediaImage.js';

type Props = {
  finalist: TransparentGroupResultsResponse['group'][number] | undefined;
  onClose: () => void;
  onChoose: (destinationId: string) => void;
  decisionRecorded: boolean;
};

/** Post-gate detail sheet; it uses only named finalist data from the reveal DTO. */
export function FinalistDrawer({ finalist, onClose, onChoose, decisionRecorded }: Props) {
  if (!finalist) return null;
  return (
    <aside className="finalist-drawer" role="region" aria-labelledby="finalist-drawer-title">
      <button className="finalist-drawer__close" onClick={onClose} aria-label="Close finalist details">×</button>
      <MediaImage className="finalist-drawer__image" src={finalist.imageUrl} alt={`A view from ${finalist.name}`} fallbackLabel="Photo unavailable" />
      <div className="finalist-drawer__body">
        <p className="eyebrow">#{finalist.rank} in the group tally · {finalist.points} points</p>
        <h2 id="finalist-drawer-title">{finalist.name}</h2>
        <p className="finalist-drawer__country">{finalist.country}</p>
        <dl>
          <div><dt>November feel</dt><dd>{finalist.context.novemberWeather}</dd></div>
          <div><dt>Travel effort</dt><dd>{finalist.context.travelFriction}/5</dd></div>
        </dl>
        <p className="finalist-drawer__effort-note">1 is an easier journey; 5 is a bigger expedition. It is context, not a recommendation.</p>
        {!decisionRecorded && <button className="lgs-button lgs-button--primary" onClick={() => onChoose(finalist.id)}>Champion {finalist.name}</button>}
      </div>
    </aside>
  );
}
