/**
 * A slim position indicator for horizontal carousels (deck pickers, the hand)
 * that otherwise give no hint they can be swiped. `useScrollHint` returns props
 * to spread onto the ScrollView; `<ScrollHint>` renders the track + thumb and
 * hides itself when the content doesn't overflow.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { color, radius } from '../tokens';

export interface ScrollMetrics {
  offset: number;
  content: number;
  layout: number;
}

export function useScrollHint(): {
  scrollProps: {
    scrollEventThrottle: number;
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onContentSizeChange: (w: number) => void;
    onLayout: (e: LayoutChangeEvent) => void;
  };
  metrics: ScrollMetrics;
} {
  const [metrics, setMetrics] = useState<ScrollMetrics>({ offset: 0, content: 0, layout: 0 });
  return {
    metrics,
    scrollProps: {
      scrollEventThrottle: 16,
      onScroll: (e) => {
        const offset = e.nativeEvent.contentOffset.x;
        setMetrics((p) => (p.offset === offset ? p : { ...p, offset }));
      },
      onContentSizeChange: (w) => setMetrics((p) => (p.content === w ? p : { ...p, content: w })),
      onLayout: (e) => {
        const layout = e.nativeEvent.layout.width;
        setMetrics((p) => (p.layout === layout ? p : { ...p, layout }));
      },
    },
  };
}

export function ScrollHint({ metrics }: { metrics: ScrollMetrics }): React.JSX.Element | null {
  const { offset, content, layout } = metrics;
  if (content <= layout + 1) {
    return null; // nothing to scroll → no indicator
  }
  const thumbFrac = Math.max(0.12, Math.min(1, layout / content));
  const maxOffset = content - layout;
  const pos = maxOffset > 0 ? Math.max(0, Math.min(1, offset / maxOffset)) : 0;
  return (
    <View style={styles.track}>
      <View
        style={[
          styles.thumb,
          { width: `${thumbFrac * 100}%`, left: `${pos * (1 - thumbFrac) * 100}%` },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: color.line,
    overflow: 'hidden',
    marginTop: 6,
    alignSelf: 'stretch',
  },
  thumb: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: radius.pill,
    backgroundColor: color.accent,
  },
});
