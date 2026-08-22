import type { AttributeKey, RosterUser } from '@lgs/shared';
import { moodLabel, moodPortraitManifest } from '../moods.js';

type Props = {
  traveler: RosterUser;
  dimension: AttributeKey;
  size?: 'medallion' | 'card' | 'lead';
  decorative?: boolean;
  className?: string;
};

/** A post-choice illustration of a real, named preference dimension. */
export function MoodPortrait({ traveler, dimension, size = 'medallion', decorative = false, className = '' }: Props) {
  const label = moodLabel[dimension];
  return <img
    className={`mood-portrait mood-portrait--${size} ${className}`}
    src={moodPortraitManifest[traveler][dimension]}
    alt={decorative ? '' : `${label} illustration for ${traveler}`}
    aria-hidden={decorative || undefined}
    decoding="async"
  />;
}
