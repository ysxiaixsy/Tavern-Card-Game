/**
 * Tactile feedback. Centralizes every haptic so it can be gated by the
 * `haptics` preference and so the call sites read as intent ("a card was
 * played") rather than mechanism.
 *
 * Why haptics and not sound: this is a placeholder-only project (no CDPR
 * assets, see docs/BRIEF.md) and bundling authored audio is out of scope.
 * Haptics give the "feel" polish the brief's sound line was reaching for,
 * with zero assets. If real sound is added later, mirror each call here —
 * the `// sound:` markers show where each cue would play.
 */

import * as Haptics from 'expo-haptics';
import { useAppStore } from './store';

function enabled(): boolean {
  return useAppStore.getState().prefs.haptics;
}

/** Fire-and-forget; haptics can reject on web/unsupported devices. */
function safe(run: () => Promise<void>): void {
  if (!enabled()) {
    return;
  }
  void run().catch(() => undefined);
}

export const feedback = {
  /** UI taps: selecting a card, opening a sheet. */
  tap(): void {
    safe(() => Haptics.selectionAsync()); // sound: soft click
  },
  /** A card hits the board / a leader fires. */
  play(): void {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)); // sound: card thud
  },
  /** A destructive board event — scorch, a unit dying. */
  impactHeavy(): void {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)); // sound: flames
  },
  /** Passing the turn. */
  pass(): void {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)); // sound: chime
  },
  /** A round or match won. */
  success(): void {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)); // sound: fanfare
  },
  /** A round tied / a gentle warning. */
  warning(): void {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)); // sound: low horn
  },
  /** A rejected move / illegal action. */
  error(): void {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)); // sound: buzz
  },
};
