/* eslint-disable react-hooks/immutability, react-hooks/refs, react-hooks/preserve-manual-memoization --
   Reanimated shared values are intentionally mutable: their `.value` is written
   on the UI thread inside worklets, and read there to drive animations. This file
   also hand-manages its memoization (stable useCallback handlers whose refs the
   compiler can't fully infer). The React Compiler rules model neither and
   false-positive here. Scoped to this file, the only imperative-worklet module. */
import type { ReactNode } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  LinearTransition,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { hapticMedium } from '@utils/haptics';

/** Hold this long before a press turns into a drag (tap still opens the item). */
const LONG_PRESS_MS = 200;
/** Glide duration for both the neighbour reflow and the drop settle. */
const REORDER_DURATION = 180;

interface DragSortListProps<T> {
  data: T[];
  keyExtractor: (item: T) => string;
  /** Item body — renders its own Pressable; a quick tap passes straight through. */
  renderItem: (item: T) => ReactNode;
  /** Called on drop with the new full order of keys (only when it changed). */
  onReorder: (orderedKeys: string[]) => void;
  /** Lay items out in a row (horizontal drag) instead of a column. */
  horizontal?: boolean;
  /** Gap between items — must match the visual layout for correct offsets. */
  gap?: number;
  /** Static trailing element (e.g. an "add" button) — not draggable. */
  footer?: ReactNode;
  /** Fires true on pickup / false on drop so the host can freeze its scroll view. */
  onDragStateChange?: (dragging: boolean) => void;
  /** Drop-shadow colour for the lifted item (a palette token from the host). */
  liftShadowColor?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Long-press-to-reorder list on the existing Reanimated + Gesture Handler stack
 * (no extra dependency). The dragged item floats under the finger via a transform
 * while its flow slot stays put, so neighbours reflow around it with a layout
 * animation; on drop the new key order is handed back to the caller.
 *
 * Reorder math is scroll-independent: item slot offsets are derived from measured
 * sizes + gap in the current order, and the gesture translation is a pure delta,
 * so this works whether or not the host wraps it in a horizontal ScrollView.
 */
export function DragSortList<T>({
  data,
  keyExtractor,
  renderItem,
  onReorder,
  horizontal = false,
  gap = 0,
  footer,
  onDragStateChange,
  liftShadowColor,
  style,
}: DragSortListProps<T>) {
  const [order, setOrder] = useState<string[]>(() => data.map(keyExtractor));
  const orderRef = useRef(order);
  orderRef.current = order;

  // Measured main-axis extent per key (width when horizontal, else height).
  const sizes = useRef<Record<string, number>>({});
  const dataRef = useRef(data);
  dataRef.current = data;

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const activeKeyRef = useRef<string | null>(null);

  // Latest-callback refs so the gesture handlers below stay referentially stable
  // (the host passes these inline). Rebuilding gestures mid-drag — which a stale
  // dependency would force when the host re-renders on pickup — cancels the drag.
  const cb = useRef({ onReorder, onDragStateChange, keyExtractor });
  cb.current = { onReorder, onDragStateChange, keyExtractor };

  // UI-thread drag state: which key is lifted, its finger delta, and how much its
  // flow home shifted from mid-drag reorders (subtracted so it tracks the finger).
  const translate = useSharedValue(0);
  const homeShift = useSharedValue(0);
  const activeKeySV = useSharedValue<string>('');

  const keysSig = useMemo(() => data.map(keyExtractor).join(' '), [data, keyExtractor]);

  // Reconcile the local order with the data set (React's "adjust state during
  // render" pattern — cheaper than an effect and runs before paint).
  //   • members changed (add/remove): survivors keep their order, newcomers append;
  //   • same members, different sequence, and not mid-drag: adopt the incoming
  //     order — this keeps the same list in sync across screens (e.g. reordering
  //     accounts on Home is reflected in Settings and vice versa).
  // A reorder we just persisted comes back with the same order, so this no-ops.
  const prevSig = useRef(keysSig);
  if (prevSig.current !== keysSig) {
    prevSig.current = keysSig;
    const keys = keysSig ? keysSig.split(' ') : [];
    const sameMembers = keys.length === order.length && keys.every((k) => order.includes(k));
    if (!sameMembers) {
      const wanted = new Set(keys);
      const kept = order.filter((k) => wanted.has(k));
      const added = keys.filter((k) => !kept.includes(k));
      const next = [...kept, ...added];
      orderRef.current = next;
      setOrder(next);
    } else if (!activeKeyRef.current && keys.some((k, i) => k !== order[i])) {
      orderRef.current = keys;
      setOrder(keys);
    }
  }

  const offsetsFor = useCallback(
    (ord: string[]): Record<string, number> => {
      const offsets: Record<string, number> = {};
      let acc = 0;
      for (const k of ord) {
        offsets[k] = acc;
        acc += (sizes.current[k] ?? 0) + gap;
      }
      return offsets;
    },
    [gap],
  );

  const onMeasure = useCallback((key: string, size: number) => {
    sizes.current[key] = size;
  }, []);

  const onBegin = useCallback((key: string) => {
    activeKeyRef.current = key;
    setActiveKey(key);
    cb.current.onDragStateChange?.(true);
    hapticMedium();
  }, []);

  const onMove = useCallback(
    (raw: number) => {
      const ak = activeKeyRef.current;
      if (!ak) return;
      const ord = orderRef.current;
      const activeIdx = ord.indexOf(ak);
      if (activeIdx < 0) return;

      const offsets = offsetsFor(ord);
      const activeSize = sizes.current[ak] ?? 0;
      const projectedCenter = offsets[ak]! + activeSize / 2 + (raw - homeShift.value);

      // Insertion index = how many *other* items have their centre before us.
      let targetIdx = 0;
      for (const k of ord) {
        if (k === ak) continue;
        const center = offsets[k]! + (sizes.current[k] ?? 0) / 2;
        if (projectedCenter > center) targetIdx++;
      }

      const next = ord.filter((k) => k !== ak);
      next.splice(targetIdx, 0, ak);
      if (next.every((k, i) => k === ord[i])) return; // no change

      // Compensate the item's new flow home so it stays under the finger.
      const newOffsets = offsetsFor(next);
      homeShift.value += newOffsets[ak]! - offsets[ak]!;
      orderRef.current = next;
      setOrder(next);
    },
    [offsetsFor, homeShift],
  );

  const endDrag = useCallback(() => {
    if (!activeKeyRef.current) return;
    const finalOrder = [...orderRef.current];
    activeKeyRef.current = null;
    setActiveKey(null);
    activeKeySV.value = '';
    translate.value = 0;
    homeShift.value = 0;
    cb.current.onDragStateChange?.(false);

    const current = dataRef.current.map(cb.current.keyExtractor);
    const unchanged =
      finalOrder.length === current.length && finalOrder.every((k, i) => k === current[i]);
    if (!unchanged) cb.current.onReorder(finalOrder);
  }, [activeKeySV, translate, homeShift]);

  const map = useMemo(() => {
    const m = new Map<string, T>();
    for (const it of data) m.set(keyExtractor(it), it);
    return m;
  }, [data, keyExtractor]);

  const ordered = useMemo(
    () => order.map((k) => map.get(k)).filter((it): it is T => it != null),
    [order, map],
  );

  const containerStyle = useMemo<ViewStyle>(
    () => ({ flexDirection: horizontal ? 'row' : 'column', gap }),
    [horizontal, gap],
  );

  return (
    <View style={[containerStyle, style]}>
      {ordered.map((item) => {
        const key = keyExtractor(item);
        return (
          <DraggableRow
            key={key}
            itemKey={key}
            active={activeKey === key}
            horizontal={horizontal}
            translate={translate}
            homeShift={homeShift}
            activeKeySV={activeKeySV}
            onBegin={onBegin}
            onMove={onMove}
            endDrag={endDrag}
            onMeasure={onMeasure}
            shadowColor={liftShadowColor}
          >
            {renderItem(item)}
          </DraggableRow>
        );
      })}
      {footer}
    </View>
  );
}

interface DraggableRowProps {
  itemKey: string;
  active: boolean;
  horizontal: boolean;
  translate: SharedValue<number>;
  homeShift: SharedValue<number>;
  activeKeySV: SharedValue<string>;
  onBegin: (key: string) => void;
  onMove: (raw: number) => void;
  endDrag: () => void;
  onMeasure: (key: string, size: number) => void;
  shadowColor?: string;
  children: ReactNode;
}

function DraggableRow({
  itemKey,
  active,
  horizontal,
  translate,
  homeShift,
  activeKeySV,
  onBegin,
  onMove,
  endDrag,
  onMeasure,
  shadowColor,
  children,
}: DraggableRowProps) {
  // Each row owns its own gesture, keyed on its stable `itemKey`. Building it per
  // row (rather than in a shared parent map that must grow as items are added)
  // means a newly added item always has a live gesture, and — since itemKey and
  // the callbacks are stable — the active row's gesture never changes mid-drag.
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(LONG_PRESS_MS)
        .onStart(() => {
          translate.value = 0;
          homeShift.value = 0;
          activeKeySV.value = itemKey;
          runOnJS(onBegin)(itemKey);
        })
        .onUpdate((e) => {
          translate.value = horizontal ? e.translationX : e.translationY;
          runOnJS(onMove)(translate.value);
        })
        .onFinalize(() => {
          translate.value = withTiming(homeShift.value, { duration: REORDER_DURATION }, (done) => {
            if (done) runOnJS(endDrag)();
          });
        }),
    [itemKey, horizontal, onBegin, onMove, endDrag, translate, homeShift, activeKeySV],
  );

  const animStyle = useAnimatedStyle(() => {
    const isActive = activeKeySV.value === itemKey;
    const offset = isActive ? translate.value - homeShift.value : 0;
    return {
      transform: [
        { translateX: horizontal ? offset : 0 },
        { translateY: horizontal ? 0 : offset },
        { scale: withTiming(isActive ? 1.04 : 1, { duration: 120 }) },
      ],
      zIndex: isActive ? 999 : 0,
      shadowOpacity: isActive ? 0.22 : 0,
    };
  });

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      onMeasure(itemKey, horizontal ? width : height);
    },
    [itemKey, horizontal, onMeasure],
  );

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        onLayout={handleLayout}
        layout={active ? undefined : LinearTransition.duration(REORDER_DURATION)}
        // Shadow geometry is static; only its opacity animates (in animStyle) so
        // the lift reads clearly. Colour comes from a palette token via the host.
        style={[{ shadowColor, shadowRadius: 12, shadowOffset: SHADOW_OFFSET }, animStyle]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const SHADOW_OFFSET = { width: 0, height: 6 } as const;
