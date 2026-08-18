import type { GroupFinalist } from '@lgs/shared';
import { MediaImage } from './MediaImage.js';

type Props = {
  finalist: GroupFinalist | undefined;
  onClose: () => void;
  onChoose: (destinationId: string) => void;
  decisionRecorded: boolean;
};

/** Post-gate detail sheet; it uses only named finalist data from the reveal DTO. */
export function FinalistDrawer({ finalist, onClose, onChoose, decisionRecorded }: Props) {
  if (!finalist) return null;
  const consensusCopy = {
    'broad-consensus': 'Broad crew fit',
    mixed: 'A lively mix of takes',
    polarized: 'A real conversation starter',
  } as const;

  return (
    <aside className="finalist-drawer" aria-labelledby="finalist-drawer-title">
      <button className="finalist-drawer__close" onClick={onClose} aria-label="Close finalist details">×</button>
      <MediaImage className="finalist-drawer__image" src={finalist.imageUrl} alt={`A view from ${finalist.name}`} fallbackLabel="Photo unavailable" />
      <div className="finalist-drawer__body">
        <p className="eyebrow">#{finalist.rank} finalist · {consensusCopy[finalist.consensus]}</p>
        <h2 id="finalist-drawer-title">{finalist.name}</h2>
        <p className="finalist-drawer__country">{finalist.country}</p>
        <dl>
          <div><dt>November feel</dt><dd>{finalist.context.novemberWeather}</dd></div>
          <div><dt>Travel effort</dt><dd>{finalist.context.travelFriction}/5</dd></div>
        </dl>
        <p className="finalist-drawer__effort-note">1 is an easier journey; 5 is a bigger expedition. It is context, not a recommendation.</p>
        {!decisionRecorded && <button className="lgs-button lgs-button--primary" onClick={() => onChoose(finalist.id)}>Choose this as my next step</button>}
      </div>
    </aside>
  );
}
