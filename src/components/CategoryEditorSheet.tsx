import { useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { AppIcon } from '@components/AppIcon';
import {
  categoryEditorRef,
  type CategoryEditorHandle,
  type CategoryEditorTarget,
} from '@components/categoryEditorRef';
import { CATEGORY_COLOR_CHOICES } from '@constants/categories';
import { CATEGORY_ICON_CHOICES, DEFAULT_CATEGORY_ICON } from '@constants/icons';
import { CategoriesController } from '@controllers/categories.controller';
import { usePalette } from '@hooks/usePalette';
import type { Category, CategoryKind } from '@models';
import type { Palette } from '@theme';
import { Radius, Spacing, Typography } from '@theme';
import { hexToRgba } from '@utils/color';
import { displayCategoryName } from '@utils/displayName';
import { hapticLight, hapticSuccess } from '@utils/haptics';

const DEFAULT_COLOR = CATEGORY_COLOR_CHOICES[0] ?? '#9AA1AD';

function isExisting(t: CategoryEditorTarget): t is Category {
  return 'id' in t;
}

/**
 * Create / edit a category — icon, name and colour (owner request). Rendered
 * once at the app root; opened imperatively via {@link openCategoryEditor} from
 * the input sheet's "add category" button and the settings category list.
 * System categories can be edited but not deleted (rule 10 soft-delete only).
 */
export function CategoryEditorSheet() {
  const { t } = useTranslation();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const sheetRef = useRef<BottomSheetModal>(null);

  const [editing, setEditing] = useState<Category | null>(null);
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(DEFAULT_CATEGORY_ICON);
  const [color, setColor] = useState<string>(DEFAULT_COLOR);

  const open = useCallback(
    (target: CategoryEditorTarget) => {
      if (isExisting(target)) {
        setEditing(target);
        setKind(target.kind);
        setName(displayCategoryName(target));
        setIcon(target.icon);
        setColor(target.color);
      } else {
        setEditing(null);
        setKind(target.kind);
        setName('');
        setIcon(DEFAULT_CATEGORY_ICON);
        setColor(DEFAULT_COLOR);
      }
      sheetRef.current?.present();
      hapticLight();
    },
    [sheetRef],
  );

  useImperativeHandle(categoryEditorRef, (): CategoryEditorHandle => ({ open }), [open]);

  const onSave = useCallback(async () => {
    if (editing) {
      // Unchanged localized name → keep the original stored name (preserve i18n
      // of a system seed); a real edit stores the typed name.
      const resolvedName = name.trim() === displayCategoryName(editing) ? editing.name : name;
      await CategoriesController.updateCategory(editing.id, { name: resolvedName, icon, color });
    } else {
      await CategoriesController.createCategory({ name, icon, color, kind });
    }
    sheetRef.current?.dismiss();
    hapticSuccess();
  }, [editing, name, icon, color, kind, sheetRef]);

  const onDelete = useCallback(() => {
    if (!editing) return;
    Alert.alert(t('categoryEditor.deleteTitle'), t('categoryEditor.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await CategoriesController.deleteCategory(editing.id);
          sheetRef.current?.dismiss();
        },
      },
    ]);
  }, [editing, sheetRef, t]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['70%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetScrollView contentContainerStyle={styles.container}>
        <View style={styles.previewRow}>
          <View style={[styles.previewBadge, { backgroundColor: hexToRgba(color, 0.2) }]}>
            <AppIcon name={icon} color={color} size={24} />
          </View>
          <Text style={styles.heading}>
            {editing
              ? t('categoryEditor.heading')
              : kind === 'income'
                ? t('categoryEditor.newIncome')
                : t('categoryEditor.newExpense')}
          </Text>
        </View>

        <BottomSheetTextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('categoryEditor.namePlaceholder')}
          placeholderTextColor={palette.dim2}
        />

        <Text style={styles.label}>{t('categoryEditor.colorLabel')}</Text>
        <View style={styles.colorRow}>
          {CATEGORY_COLOR_CHOICES.map((c) => (
            <Pressable
              key={c}
              onPress={() => {
                setColor(c);
                hapticLight();
              }}
              style={[
                styles.colorDot,
                { backgroundColor: c },
                c === color && styles.colorDotActive,
              ]}
            />
          ))}
        </View>

        <Text style={styles.label}>{t('categoryEditor.iconLabel')}</Text>
        <View style={styles.iconGrid}>
          {CATEGORY_ICON_CHOICES.map((ic) => {
            const active = ic === icon;
            return (
              <Pressable
                key={ic}
                onPress={() => {
                  setIcon(ic);
                  hapticLight();
                }}
                style={[
                  styles.iconCell,
                  { backgroundColor: active ? hexToRgba(color, 0.2) : palette.glassLightBg },
                ]}
              >
                <AppIcon name={ic} color={active ? color : palette.dim} size={22} />
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={onSave} style={styles.save}>
          <Text style={styles.saveText}>
            {editing ? t('common.save') : t('categoryEditor.create')}
          </Text>
        </Pressable>
        {editing && (
          <Pressable onPress={onDelete} style={styles.delete}>
            <Text style={styles.deleteText}>{t('categoryEditor.deleteButton')}</Text>
          </Pressable>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    sheetBg: { backgroundColor: p.sheetBg },
    handle: { backgroundColor: p.dim2 },
    container: {
      paddingHorizontal: Spacing.screenPadding,
      paddingBottom: Spacing.xxxl,
      gap: Spacing.md,
    },
    previewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    previewBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heading: { color: p.ink, fontSize: Typography.title.fontSize, fontWeight: '600' },
    input: {
      color: p.ink,
      fontSize: Typography.body.fontSize,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.md,
      backgroundColor: p.glassLightBg,
    },
    label: {
      color: p.dim,
      fontSize: Typography.micro.fontSize,
      fontWeight: '700',
      letterSpacing: 1,
    },
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    colorDot: { width: 30, height: 30, borderRadius: 15 },
    colorDotActive: { borderWidth: 3, borderColor: p.ink },
    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    iconCell: {
      width: 46,
      height: 46,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    save: {
      backgroundColor: p.btnBg,
      borderRadius: Radius.inputButton,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    saveText: { color: p.btnInk, fontSize: Typography.headline.fontSize, fontWeight: '600' },
    delete: { paddingVertical: Spacing.md, alignItems: 'center' },
    deleteText: { color: p.neg, fontSize: Typography.body.fontSize },
  });
