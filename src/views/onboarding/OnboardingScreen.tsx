import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BudgetPlanEditor } from '@components/BudgetPlanEditor';
import { usePalette } from '@hooks/usePalette';
import { useSettingsStore, waitForSettingsHydration } from '@stores/settings.store';
import type { Palette } from '@theme';
import { Radius, ScreenTitle, Spacing, Typography } from '@theme';
import { type BudgetPlan, defaultBudgetPlan } from '@utils/budget';
import { hapticLight, hapticSuccess } from '@utils/haptics';

/**
 * Optional, always-skippable first-launch card (B11): sets up the payout
 * schedule the "можно сегодня" number needs, so the app is useful from the
 * first screen. Everything is editable later in Settings → Деньги. Self-gates:
 * renders nothing once completed/skipped.
 */
export function OnboardingScreen() {
  const { t } = useTranslation();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const onboardingDone = useSettingsStore((s) => s.onboardingDone);
  const baseCurrency = useSettingsStore((s) => s.baseCurrency);
  const setBudgetPlan = useSettingsStore((s) => s.setBudgetPlan);
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);

  const [hydrated, setHydrated] = useState(false);
  const [plan, setPlan] = useState<BudgetPlan>(() => defaultBudgetPlan(baseCurrency));

  useEffect(() => {
    void waitForSettingsHydration().then(() => setHydrated(true));
  }, []);

  if (!hydrated || onboardingDone) return null;

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
          <Text style={styles.title}>{t('onboarding.title')}</Text>
          <Text style={styles.lead}>{t('onboarding.lead')}</Text>

          <BudgetPlanEditor value={plan} onChange={setPlan} baseCurrency={baseCurrency} />
        </ScrollView>

        <View style={styles.actions}>
          <Pressable onPress={onStart} style={styles.primary}>
            <Text style={styles.primaryText}>{t('onboarding.start')}</Text>
          </Pressable>
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
