import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SegmentedControl from '@react-native-segmented-control/segmented-control';

import { BudgetPlanEditor } from '@components/BudgetPlanEditor';
import { SpendAccountsPicker } from '@components/SpendAccountsPicker';
import type { ThemeChoice } from '@constants/settings';
import { useIsDark, usePalette } from '@hooks/usePalette';
import type { LanguageChoice } from '@i18n';
import { useSettingsStore, waitForSettingsHydration } from '@stores/settings.store';
import type { Palette } from '@theme';
import { Radius, ScreenTitle, Spacing, Typography } from '@theme';
import { type BudgetPlan, defaultBudgetPlan } from '@utils/budget';
import { hapticLight, hapticSuccess } from '@utils/haptics';

const THEME_VALUES: ThemeChoice[] = ['system', 'light', 'dark'];
const LANGUAGE_VALUES: LanguageChoice[] = ['ru', 'en'];

/**
 * Optional, always-skippable first-launch flow (B11). Two steps:
 *   1. language + appearance — offered first, since the app defaults to English/
 *      light and a Russian user may prefer to switch before reading anything;
 *   2. the budget plan the "можно сегодня" number needs + which accounts count.
 * Everything is editable later in Settings. Self-gates: renders nothing once
 * completed/skipped. Theme/language changes apply live, so the flow itself
 * re-skins as you pick.
 */
export function OnboardingScreen() {
  const { t } = useTranslation();
  const palette = usePalette();
  const isDark = useIsDark();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const onboardingDone = useSettingsStore((s) => s.onboardingDone);
  const baseCurrency = useSettingsStore((s) => s.baseCurrency);
  const setBudgetPlan = useSettingsStore((s) => s.setBudgetPlan);
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);

  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<0 | 1>(0);
  const [plan, setPlan] = useState<BudgetPlan>(() => defaultBudgetPlan(baseCurrency));

  useEffect(() => {
    void waitForSettingsHydration().then(() => setHydrated(true));
  }, []);

  if (!hydrated || onboardingDone) return null;

  const themeLabels = [
    t('settings.themeSystem'),
    t('settings.themeLight'),
    t('settings.themeDark'),
  ];
  const languageLabels = [t('settings.languageRu'), t('settings.languageEn')];

  const onStart = () => {
    setBudgetPlan(plan);
    completeOnboarding();
    hapticSuccess();
  };

  const onSkip = () => {
    completeOnboarding();
    hapticLight();
  };

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {step === 0 ? (
            <>
              <Text style={styles.title}>{t('onboarding.langThemeTitle')}</Text>
              <Text style={styles.lead}>{t('onboarding.langThemeLead')}</Text>

              <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
              <SegmentedControl
                values={languageLabels}
                selectedIndex={Math.max(0, LANGUAGE_VALUES.indexOf(language))}
                appearance={isDark ? 'dark' : 'light'}
                onChange={(e) => {
                  const value = LANGUAGE_VALUES[e.nativeEvent.selectedSegmentIndex];
                  if (value) {
                    setLanguage(value);
                    hapticLight();
                  }
                }}
              />

              <Text style={styles.sectionTitle}>{t('settings.theme')}</Text>
              <SegmentedControl
                values={themeLabels}
                selectedIndex={Math.max(0, THEME_VALUES.indexOf(theme))}
                appearance={isDark ? 'dark' : 'light'}
                onChange={(e) => {
                  const value = THEME_VALUES[e.nativeEvent.selectedSegmentIndex];
                  if (value) {
                    setTheme(value);
                    hapticLight();
                  }
                }}
              />
            </>
          ) : (
            <>
              <Text style={styles.title}>{t('onboarding.title')}</Text>
              <Text style={styles.lead}>{t('onboarding.lead')}</Text>

              <BudgetPlanEditor value={plan} onChange={setPlan} baseCurrency={baseCurrency} />

              <Text style={styles.sectionTitle}>{t('money.spendAccounts')}</Text>
              <SpendAccountsPicker />
            </>
          )}
        </ScrollView>

        <View style={styles.actions}>
          {step === 0 ? (
            <Pressable
              onPress={() => {
                setStep(1);
                hapticLight();
              }}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>{t('onboarding.continue')}</Text>
            </Pressable>
          ) : (
            <>
              <Pressable onPress={onStart} style={styles.primary}>
                <Text style={styles.primaryText}>{t('onboarding.start')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setStep(0);
                  hapticLight();
                }}
                style={styles.skip}
              >
                <Text style={styles.skipText}>{t('onboarding.back')}</Text>
              </Pressable>
            </>
          )}
          <Pressable onPress={onSkip} style={styles.skip}>
            <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: p.canvasBase, zIndex: 100 },
    safe: { flex: 1, paddingHorizontal: Spacing.screenPadding },
    body: { paddingTop: Spacing.xl, paddingBottom: Spacing.lg, gap: Spacing.md },
    title: { ...ScreenTitle, color: p.ink },
    lead: {
      color: p.dim,
      fontSize: Typography.body.fontSize,
      lineHeight: 22,
      marginBottom: Spacing.lg,
    },
    sectionTitle: {
      color: p.dim,
      fontSize: 13,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      marginTop: Spacing.sm,
    },
    actions: { gap: Spacing.sm, paddingVertical: Spacing.md },
    primary: {
      backgroundColor: p.btnBg,
      borderRadius: Radius.inputButton,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
    },
    primaryText: { color: p.btnInk, fontSize: Typography.headline.fontSize, fontWeight: '600' },
    skip: { paddingVertical: Spacing.md, alignItems: 'center' },
    skipText: { color: p.dim, fontSize: Typography.body.fontSize },
  });
