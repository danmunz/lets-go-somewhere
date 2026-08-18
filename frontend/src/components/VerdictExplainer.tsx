import type { ResultConfidence } from '@lgs/shared';

type Props = { confidence: ResultConfidence };

const labels = {
  'clear-favorite': 'Broad consensus',
  'close-call': 'Close call',
} as const;

/** Renders server-provided qualitative confidence without numerical claims. */
export function VerdictExplainer({ confidence }: Props) {
  return (
    <section className="verdict-explainer" aria-label="How to read the verdict">
      <h2>How to read this</h2>
      <p><strong>{labels[confidence.label]}.</strong> {confidence.summary}</p>
    </section>
  );
}
