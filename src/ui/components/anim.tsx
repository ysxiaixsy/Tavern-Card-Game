/**
 * Lightweight animation primitives built on React Native's built-in Animated
 * API — no extra dependency, bundles cleanly, and every animation collapses
 * to an instant transition when the `animations` preference is off (also the
 * right thing for reduced-motion users).
 *
 * Kept deliberately small: an entrance wrapper and a value-change pulse cover
 * the brief's "card play / weather / scorch" polish without gesture libraries.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, type ViewStyle } from 'react-native';
import { useAppStore } from '../store';

/** Fade + slight rise on mount. Instant when animations are disabled. */
export function Appear({
  children,
  style,
  delay = 0,
  distance = 8,
  duration = 220,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  delay?: number;
  distance?: number;
  duration?: number;
}): React.JSX.Element {
  const animate = useAppStore((s) => s.prefs.animations);
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [animate, delay, duration, progress]);

  return (
    <Animated.View
      style={[
        style as ViewStyle,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Briefly scales its children up when `trigger` changes (e.g. a score tick). */
export function Pulse({
  trigger,
  children,
  style,
  scale = 1.18,
}: {
  trigger: number | string;
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  scale?: number;
}): React.JSX.Element {
  const animate = useAppStore((s) => s.prefs.animations);
  const value = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return; // don't pulse on initial mount
    }
    if (!animate) {
      return;
    }
    const anim = Animated.sequence([
      Animated.timing(value, { toValue: scale, duration: 120, useNativeDriver: true }),
      Animated.spring(value, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [trigger, animate, scale, value]);

  return (
    <Animated.View style={[style as ViewStyle, { transform: [{ scale: value }] }]}>
      {children}
    </Animated.View>
  );
}
