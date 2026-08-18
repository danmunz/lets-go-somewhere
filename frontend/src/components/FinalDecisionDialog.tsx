import { useEffect, useRef } from 'react';

type Props = {
  open: boolean;
  choiceLabel: string;
  isSaving?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Native dialog semantics are retained here so OT-16 can attach mutation state
 * without reimplementing focus management.
 */
export function FinalDecisionDialog({ open, choiceLabel, isSaving = false, error, onCancel, onConfirm }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!dialog.current) return;
    if (open && !dialog.current.open) dialog.current.showModal();
    if (!open && dialog.current.open) dialog.current.close();
  }, [open]);

  return (
    <dialog ref={dialog} className="final-decision-dialog" data-testid="final-decision-dialog" aria-labelledby="final-decision-title" onCancel={(event) => { event.preventDefault(); onCancel(); }}>
      <h2 id="final-decision-title">Lock in your take?</h2>
      <p>This records what you want the crew to investigate next. It does not change the trip ranking, and it can’t be edited.</p>
      {error && <p className="final-decision-dialog__error" role="alert">{error}</p>}
      <div className="final-decision-dialog__actions">
        <button autoFocus className="lgs-button lgs-button--secondary" onClick={onCancel} disabled={isSaving}>Not yet</button>
        <button className="lgs-button lgs-button--primary" onClick={onConfirm} disabled={isSaving}>{isSaving ? 'Recording…' : `Record ${choiceLabel}`}</button>
      </div>
    </dialog>
  );
}
