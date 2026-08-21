import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@components/AppIcon';
import { openCategoryEditor } from '@components/categoryEditorRef';
import { ScreenHeader } from '@components/ScreenHeader';
import { usePalette } from '@hooks/usePalette';
import type { Category, CategoryKind } from '@models';
import { useDataStore } from '@stores/data.store';
import type { Palette } from '@theme';
import { Radius, Spacing, Typography } from '@theme';
import { hexToRgba } from '@utils/color';
import { hapticLight } from '@utils/haptics';

export function CategoriesScreen() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const categories = useDataStore((s) => s.categories);

  const groups = useMemo(
    () => ({
      expense: categories.filter((c) => c.kind === 'expense'),
      income: categories.filter((c) => c.kind === 'income'),
    }),
    [categories],
  );

  const renderSection = (title: string, kind: CategoryKind, list: Category[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>
        {list.map((c) => (
          <Pressable
            key={c.id}
            style={styles.row}
            onPress={() => {
              openCategoryEditor(c);
            }}
          >
            <View style={[styles.badge, { backgroundColor: hexToRgba(c.color, 0.2) }]}>
              <AppIcon name={c.icon} color={c.color} size={18} />
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {c.name}
            </Text>
            <AppIcon name="chevron-forward" color={palette.dim2} size={16} />
          </Pressable>
        ))}
        <Pressable
          style={styles.row}
          onPress={() => {
            hapticLight();
            openCategoryEditor({ kind });
          }}
        >
          <Text style={styles.action}>＋ Добавить категорию</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.canvas}>
      <ScreenHeader title="Категории" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {renderSection('РАСХОДЫ', 'expense', groups.expense)}
        {renderSection('ДОХОДЫ', 'income', groups.income)}
      </ScrollView>
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    canvas: { flex: 1, backgroundColor: p.canvasBase },
    scroll: { padding: Spacing.screenPadding, gap: Spacing.xl },
    section: { gap: Spacing.md },
    sectionTitle: {
      color: p.dim,
      fontSize: 13,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    card: {
      backgroundColor: p.glassBg,
      borderColor: p.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.card,
      paddingHorizontal: Spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    badge: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: { flex: 1, color: p.ink, fontSize: Typography.body.fontSize },
    action: { color: p.pos, fontSize: Typography.body.fontSize },
  });
