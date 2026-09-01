import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@components/AppIcon';
import { openCategoryEditor } from '@components/categoryEditorRef';
import { DragSortList } from '@components/DragSortList';
import { ScreenHeader } from '@components/ScreenHeader';
import { CategoriesController } from '@controllers/categories.controller';
import { usePalette } from '@hooks/usePalette';
import type { Category, CategoryKind } from '@models';
import { useDataStore } from '@stores/data.store';
import type { Palette } from '@theme';
import { Radius, Spacing, TAB_BAR_HEIGHT, Typography } from '@theme';
import { hexToRgba } from '@utils/color';
import { displayCategoryName } from '@utils/displayName';

export function CategoriesScreen() {
  const { t } = useTranslation();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const categories = useDataStore((s) => s.categories);
  // Freeze the page scroll while a card is being dragged.
  const [dragging, setDragging] = useState(false);

  const groups = useMemo(
    () => ({
      expense: categories.filter((c) => c.kind === 'expense'),
      income: categories.filter((c) => c.kind === 'income'),
    }),
    [categories],
  );

  // Each category is its own glass card (grab-and-move like the Accounts screen);
  // a quick tap opens the editor, a long-press starts a drag to reorder.
  const renderCategory = (c: Category) => (
    <Pressable style={styles.card} onPress={() => openCategoryEditor(c)}>
      <View style={styles.labelRow}>
        <AppIcon name="reorder-three" color={palette.dim2} size={20} />
        <View style={[styles.badge, { backgroundColor: hexToRgba(c.color, 0.2) }]}>
          <AppIcon name={c.icon} color={c.color} size={18} />
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {displayCategoryName(c)}
        </Text>
      </View>
      <AppIcon name="chevron-forward" color={palette.dim2} size={16} />
    </Pressable>
  );

  const renderSection = (title: string, kind: CategoryKind, list: Category[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <DragSortList
        data={list}
        keyExtractor={(c) => c.id}
        renderItem={renderCategory}
        onReorder={(ids) => void CategoriesController.reorderCategories(ids)}
        onDragStateChange={setDragging}
        liftShadowColor={palette.ink}
        gap={Spacing.sm}
        footer={
          <Pressable style={styles.addCard} onPress={() => openCategoryEditor({ kind })}>
            <Text style={styles.action}>{t('categoriesScreen.addCategory')}</Text>
          </Pressable>
        }
      />
    </View>
  );

  return (
    <View style={styles.canvas}>
      <ScreenHeader title={t('categoriesScreen.title')} />
      <ScrollView
        scrollEnabled={!dragging}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {renderSection(t('categoriesScreen.expenses'), 'expense', groups.expense)}
        {renderSection(t('categoriesScreen.incomes'), 'income', groups.income)}
      </ScrollView>
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    canvas: { flex: 1, backgroundColor: p.canvasBase },
    scroll: {
      paddingTop: Spacing.screenPadding,
      paddingHorizontal: Spacing.screenPadding,
      gap: Spacing.xl,
    },
    section: { gap: Spacing.md },
    sectionTitle: {
      color: p.dim,
      fontSize: 13,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    card: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: p.glassBg,
      borderColor: p.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.card,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexShrink: 1 },
    badge: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: { flexShrink: 1, color: p.ink, fontSize: Typography.body.fontSize },
    addCard: {
      alignItems: 'center',
      backgroundColor: p.glassLightBg,
      borderColor: p.glassLightBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.card,
      paddingVertical: Spacing.lg,
      marginTop: Spacing.xs,
    },
    action: { color: p.pos, fontSize: Typography.body.fontSize },
  });
