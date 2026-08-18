import { describe, expect, it } from 'vitest';
import { auditVisualAccessibility, DESKTOP_FONT_FLOOR_PX, MOBILE_TARGET_FLOOR_PX, motionIsReduced } from './visualAccessibility.js';

describe('visual accessibility measurement policy', () => {
  it('enforces the agreed desktop text floor without applying it to mobile', () => {
    expect(DESKTOP_FONT_FLOOR_PX).toBe(20);
    expect(auditVisualAccessibility([{ label: 'Atlas credit', kind: 'text', fontSizePx: 19 }], 'desktop')).toHaveLength(1);
    expect(auditVisualAccessibility([{ label: 'Atlas credit', kind: 'text', fontSizePx: 19 }], 'mobile')).toHaveLength(0);
  });

  it('enforces 44px mobile targets and visible keyboard focus', () => {
    expect(MOBILE_TARGET_FLOOR_PX).toBe(44);
    const issues = auditVisualAccessibility([{ label: 'Retry map', kind: 'control', fontSizePx: 20, widthPx: 40, heightPx: 44, focusVisible: false }], 'mobile');
    expect(issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
      expect.stringContaining('minimum is 44×44px'),
      expect.stringContaining('Keyboard focus'),
    ]));
  });

  it('treats reduced motion as an explicit boolean policy', () => {
    expect(motionIsReduced(true)).toBe(true);
    expect(motionIsReduced(false)).toBe(false);
    expect(motionIsReduced(undefined)).toBe(false);
  });
});
