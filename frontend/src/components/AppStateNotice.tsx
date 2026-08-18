type Props = {
  tone: 'loading' | 'error' | 'sealed';
  title: string;
  children?: React.ReactNode;
  action?: { label: string; onClick: () => void };
};

/** A single semantic notice primitive for async and gate states. */
export function AppStateNotice({ tone, title, children, action }: Props) {
  const isError = tone === 'error';
  return (
    <section className={`app-state-notice app-state-notice--${tone}`} role={isError ? 'alert' : 'status'} aria-live={isError ? 'assertive' : 'polite'}>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action && <button className="lgs-button lgs-button--secondary" onClick={action.onClick}>{action.label}</button>}
    </section>
  );
}
