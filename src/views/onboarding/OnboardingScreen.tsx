import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScheduleEditor } from '@components/ScheduleEditor';
import { usePalette } from '@hooks/usePalette';
import { useSettingsStore, waitForSettingsHydration } from '@stores/settings.store';
import type { Palette } from '@theme';
import { Radius, ScreenTitle, Spacing, Typography } from '@theme';
import { hapticLight, hapticSuccess } from '@utils/haptics';
import { defaultSchedule, type PayoutSchedule } from '@utils/schedule';

/**
 * Optional, always-skippable first-launch card (B11): sets up the payout
 * schedule the "можно сегодня" number needs, so the app is useful from the
 * first screen. Everything is editable later in Settings → Деньги. Self-gates:
 * renders nothing once completed/skipped.
 */
export function OnboardingScreen() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const onboardingDone = useSettingsStore((s) => s.onboardingDone);
  const baseCurrency = useSettingsStore((s) => s.baseCurrency);
  const setPayoutSchedule = useSettingsStore((s) => s.setPayoutSchedule);
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);

  const [hydrated, setHydrated] = useState(false);
  const [schedule, setSchedule] = useState<PayoutSchedule>(() => defaultSchedule());

  useEffect(() => {
    void waitForSettingsHydration().then(() => setHydrated(true));
  }, []);

  if (!hydrated || onboardingDone) return null;

  const onStart = () => {
    setPayoutSchedule(schedule);
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
          <Text style={styles.title}>Добро пожаловать в Centry</Text>
          <Text style={styles.lead}>
            Centry показывает одну цифру — сколько можно потратить сегодня. Она считается просто:
            ожидаемая выплата делится на дни периода до следующей выплаты. Настройте выплату — это
            всегда можно изменить позже.
          </Text>

          <ScheduleEditor value={schedule} onChange={setSchedule} baseCurrency={baseCurrency} />
        </ScrollView>

        <View style={styles.actions}>
          <Pressable onPress={onStart} style={styles.primary}>
            <Text style={styles.primaryText}>Начать</Text>
          </Pressable>
          <Pressable onPress={onSkip} style={styles.skip}>
            <Text style={styles.skipText}>Пропустить</Text>
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
