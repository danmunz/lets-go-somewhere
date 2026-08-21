type Props = { complete?: boolean };

/**
 * An intentional bridge after the final blind choice. It does not claim that
 * a calculation is happening and does not delay a later action.
 */
export function CompletedTransition({ complete = false }: Props) {
  return (
    <section className="completed-transition" role="status" aria-live="polite" aria-atomic="true">
      <p className="eyebrow">Choices complete</p>
      <h1>{complete ? 'Your choices are in.' : 'Putting your choices together…'}</h1>
    </section>
  );
}
