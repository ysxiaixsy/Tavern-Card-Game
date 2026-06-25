/**
 * Settings: persisted preferences (animations, haptics, pass confirmation,
 * AI speed) plus deck data management. All state lives in the zustand store
 * and survives restarts via AsyncStorage.
 */

import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { border, color, radius, sp } from '../tokens';
import { feedback } from '../feedback';
import { useAppStore, type AiSpeed, type Prefs } from '../store';
import { Appear } from '../components/anim';
import { Icon } from '../components/Icon';
import { Text } from '../components/Text';

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text variant="bodyStrong">{label}</Text>
        <Text variant="caption" tone="dim">
          {hint}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: color.line, true: color.accent }}
        thumbColor={value ? color.accentBright : color.inkDim}
      />
    </View>
  );
}

const AI_SPEEDS: { key: AiSpeed; label: string }[] = [
  { key: 'fast', label: 'Fast' },
  { key: 'normal', label: 'Normal' },
  { key: 'slow', label: 'Slow' },
];

export function SettingsScreen(): React.JSX.Element {
  const prefs = useAppStore((s) => s.prefs);
  const setPref = useAppStore((s) => s.setPref);
  const goHome = useAppStore((s) => s.goHome);
  const customDeckCount = useAppStore((s) => s.customDecks.length);
  const deleteDeck = useAppStore((s) => s.deleteDeck);
  const customDecks = useAppStore((s) => s.customDecks);

  const set = <K extends keyof Prefs>(key: K, value: Prefs[K]): void => {
    setPref(key, value);
    feedback.tap();
  };

  const clearDecks = (): void => {
    Alert.alert('Delete all custom decks?', `${customDeckCount} deck(s) will be removed. Starter decks stay.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete all',
        style: 'destructive',
        onPress: () => customDecks.forEach((d) => deleteDeck(d.id)),
      },
    ]);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={goHome} hitSlop={10} style={styles.back}>
          <Icon name="back" size={16} color={color.accent} />
          <Text variant="label" tone="accent" caps>
            Home
          </Text>
        </Pressable>
        <Text variant="title" tone="accentBright">
          Settings
        </Text>
        <View style={styles.back} />
      </View>

      <Appear>
        <Text variant="label" tone="dim" caps style={styles.sectionLabel}>
          Gameplay
        </Text>
        <ToggleRow
          label="Animations"
          hint="Card and screen transitions"
          value={prefs.animations}
          onChange={(v) => set('animations', v)}
        />
        <ToggleRow
          label="Haptic feedback"
          hint="Vibration on plays, passes and round results"
          value={prefs.haptics}
          onChange={(v) => set('haptics', v)}
        />
        <ToggleRow
          label="Confirm before passing"
          hint="Ask before you lock yourself out of the round"
          value={prefs.confirmPass}
          onChange={(v) => set('confirmPass', v)}
        />

        <Text variant="label" tone="dim" caps style={styles.sectionLabel}>
          AI thinking speed
        </Text>
        <View style={styles.segment}>
          {AI_SPEEDS.map((s) => {
            const selected = prefs.aiSpeed === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => set('aiSpeed', s.key)}
                style={[styles.segmentButton, selected && styles.segmentSelected]}
              >
                <Text variant="label" tone={selected ? 'accentBright' : 'dim'} caps>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text variant="label" tone="dim" caps style={styles.sectionLabel}>
          Data
        </Text>
        <Pressable
          style={[styles.dangerButton, customDeckCount === 0 && styles.dangerDisabled]}
          disabled={customDeckCount === 0}
          onPress={clearDecks}
        >
          <Text variant="label" caps color={customDeckCount === 0 ? color.inkDim : color.sealRedBright}>
            {customDeckCount === 0
              ? 'No custom decks saved'
              : `Delete all ${customDeckCount} custom deck(s)`}
          </Text>
        </Pressable>
      </Appear>

      <Text variant="caption" tone="dim" style={styles.footer}>
        GWENT — fan-made recreation of The Witcher 3's tavern game.{'\n'}
        Non-commercial.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: color.bg,
  },
  screen: {
    padding: sp(4),
    paddingBottom: sp(10),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp(4),
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(1),
    minWidth: 64,
  },
  sectionLabel: {
    marginTop: sp(5),
    marginBottom: sp(1),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: sp(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  rowText: {
    flex: 1,
    paddingRight: sp(3),
    gap: 1,
  },
  segment: {
    flexDirection: 'row',
    gap: sp(2),
  },
  segmentButton: {
    flex: 1,
    borderWidth: border.thin,
    borderColor: color.line,
    borderRadius: radius.lg,
    paddingVertical: sp(2),
    alignItems: 'center',
  },
  segmentSelected: {
    borderColor: color.accentBright,
    backgroundColor: color.surfaceRaised,
  },
  dangerButton: {
    borderWidth: border.thin,
    borderColor: color.sealRed,
    borderRadius: radius.lg,
    paddingVertical: sp(3),
    alignItems: 'center',
  },
  dangerDisabled: {
    borderColor: color.line,
    opacity: 0.6,
  },
  footer: {
    textAlign: 'center',
    marginTop: sp(8),
    lineHeight: 16,
  },
});
