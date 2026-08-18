import { useState, type ImgHTMLAttributes } from 'react';
import './mediaImage.css';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'onError'> & {
  /** Destination names are permitted only in post-completion/reveal contexts. */
  fallbackLabel?: string;
  onLoadError?: () => void;
};

/**
 * A dimension-stable photo frame for atlas and reveal use. It intentionally
 * cannot expose source or photographer metadata in an image error state.
 */
export function MediaImage({ alt, className = '', fallbackLabel, onLoadError, ...props }: Props) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className={`media-image media-image--fallback ${className}`} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
    <span aria-hidden="true">✦</span>
    {fallbackLabel && <strong>{fallbackLabel}</strong>}
  </div>;
  return <img {...props} className={`media-image ${className}`} alt={alt} onError={() => { setFailed(true); onLoadError?.(); }} />;
}
