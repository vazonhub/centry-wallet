import * as A11y from 'expo-accessibility-plus';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, PixelRatio } from 'react-native';

/**
 * Live accessibility settings (ported from Bsuir Time). Cross-platform flags
 * (`screenReader`, `reduceMotion`) come from RN's `AccessibilityInfo`; the
 * iOS-only flags (`boldText`, `darkerSystemColors`, `differentiateWithoutColor`)
 * come from `expo-accessibility-plus`. Centry is iOS-only, so there are no
 * in-app Android overrides — everything reflects the system settings live.
 */
export interface AccessibilitySettings {
  isScreenReaderEnabled: boolean;
  isReduceMotionEnabled: boolean;
  isBoldTextEnabled: boolean;
  isDarkerSystemColorsEnabled: boolean;
  /** Font scale from system Dynamic Type (1.0 = default). */
  fontScale: number;
  /** iOS "Differentiate Without Color". */
  isDifferentiateWithoutColorEnabled: boolean;
}

const defaults: AccessibilitySettings = {
  isScreenReaderEnabled: false,
  isReduceMotionEnabled: false,
  isBoldTextEnabled: false,
  isDarkerSystemColorsEnabled: false,
  fontScale: 1.0,
  isDifferentiateWithoutColorEnabled: false,
};

export function useAccessibility(): AccessibilitySettings {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    const base = { ...defaults, fontScale: PixelRatio.getFontScale() };
    // iOS-only flags: batch-read via snapshot() (one native round-trip).
    if (!A11y.isAvailable) return base;
    const snap = A11y.snapshot();
    return {
      ...base,
      isBoldTextEnabled: snap.boldText,
      isDarkerSystemColorsEnabled: snap.darkerSystemColors,
      isDifferentiateWithoutColorEnabled: snap.shouldDifferentiateWithoutColor,
    };
  });

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then((v) =>
      setSettings((s) => ({ ...s, isScreenReaderEnabled: v })),
    );
    AccessibilityInfo.isReduceMotionEnabled().then((v) =>
      setSettings((s) => ({ ...s, isReduceMotionEnabled: v })),
    );

    const rnSubs = [
      AccessibilityInfo.addEventListener('screenReaderChanged', (v) =>
        setSettings((s) => ({ ...s, isScreenReaderEnabled: v })),
      ),
      AccessibilityInfo.addEventListener('reduceMotionChanged', (v) =>
        setSettings((s) => ({ ...s, isReduceMotionEnabled: v })),
      ),
    ];

    // iOS-only flags — only subscribe when the native module is present (it is
    // absent on a dev client built before expo-accessibility-plus was added).
    const a11ySub = A11y.isAvailable
      ? A11y.addChangeListener(({ flag, value }) => {
          if (typeof value !== 'boolean') return;
          switch (flag) {
            case 'boldText':
              setSettings((s) => ({ ...s, isBoldTextEnabled: value }));
              break;
            case 'darkerSystemColors':
              setSettings((s) => ({ ...s, isDarkerSystemColorsEnabled: value }));
              break;
            case 'shouldDifferentiateWithoutColor':
              setSettings((s) => ({ ...s, isDifferentiateWithoutColorEnabled: value }));
              break;
            default:
              break;
          }
        })
      : null;

    // Re-read Dynamic Type when returning from background (it may have changed).
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const next = PixelRatio.getFontScale();
        setSettings((s) => (s.fontScale === next ? s : { ...s, fontScale: next }));
      }
    });

    return () => {
      rnSubs.forEach((s) => s.remove());
      a11ySub?.remove();
      appStateSub.remove();
    };
  }, []);

  return settings;
}

/** `true` when VoiceOver is active. */
export function useIsScreenReader(): boolean {
  return useAccessibility().isScreenReaderEnabled;
}

/** `true` when the system Reduce Motion setting is on. */
export function useReduceMotion(): boolean {
  return useAccessibility().isReduceMotionEnabled;
}

/** `true` when iOS "Increase Contrast / Darken Colors" is on. */
export function useIncreasedContrast(): boolean {
  return useAccessibility().isDarkerSystemColorsEnabled;
}
