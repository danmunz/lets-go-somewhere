export const DESKTOP_FONT_FLOOR_PX = 20;
export const MOBILE_TARGET_FLOOR_PX = 44;

export type VisualAuditItem = {
  label: string;
  kind: 'text' | 'control';
  fontSizePx?: number;
  widthPx?: number;
  heightPx?: number;
  visible?: boolean;
  focusVisible?: boolean;
};

export type VisualAuditIssue = { label: string; message: string };

/** Pure, browser-harness friendly measurement policy for OT-24 visual QA. */
export function auditVisualAccessibility(items: readonly VisualAuditItem[], viewport: 'desktop' | 'mobile'): VisualAuditIssue[] {
  const issues: VisualAuditIssue[] = [];
  for (const item of items) {
    if (item.visible === false) continue;
    if (viewport === 'desktop' && item.fontSizePx !== undefined && item.fontSizePx < DESKTOP_FONT_FLOOR_PX) {
      issues.push({ label: item.label, message: `Visible desktop text is ${item.fontSizePx}px; minimum is ${DESKTOP_FONT_FLOOR_PX}px.` });
    }
    if (viewport === 'mobile' && item.kind === 'control' && ((item.widthPx ?? 0) < MOBILE_TARGET_FLOOR_PX || (item.heightPx ?? 0) < MOBILE_TARGET_FLOOR_PX)) {
      issues.push({ label: item.label, message: `Mobile target is ${item.widthPx ?? 0}×${item.heightPx ?? 0}px; minimum is ${MOBILE_TARGET_FLOOR_PX}×${MOBILE_TARGET_FLOOR_PX}px.` });
    }
    if (item.kind === 'control' && item.focusVisible === false) {
      issues.push({ label: item.label, message: 'Keyboard focus is not visibly indicated.' });
    }
  }
  return issues;
}

export function motionIsReduced(matches: boolean | undefined): boolean {
  return matches === true;
}
