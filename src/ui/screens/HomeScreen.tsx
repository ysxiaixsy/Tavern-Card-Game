/**
 * The tavern door — mode selection only. Faction, leader and card choices
 * all live in the deck builder; seat assignments happen on the setup screen.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { color, space } from '../tokens';
import { useAppStore } from '../store';
import { feedback } from '../feedback';
import { Appear } from '../components/anim';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Text } from '../components/Text';
import { isOnlineConfigured } from '../../online/supabase';

export function HomeScreen(): React.JSX.Element {
  const beginSetup = useAppStore((s) => s.beginSetup);
  const openDecks = useAppStore((s) => s.openDecks);
  const openOnline = useAppStore((s) => s.openOnline);
  const openSettings = useAppStore((s) => s.openSettings);
  const openGuide = useAppStore((s) => s.openGuide);
  const openGallery = useAppStore((s) => s.openGallery);
  const deckCount = useAppStore((s) => s.customDecks.length);

  const go = (action: () => void): (() => void) => () => {
    feedback.tap();
    action();
  };

  return (
    <View style={styles.screen}>
      <Pressable
        style={styles.settingsButton}
        onPress={go(openSettings)}
        onLongPress={go(openGallery)}
        hitSlop={10}
      >
        <Icon name="gear" size={22} color={color.inkDim} />
      </Pressable>

      <Appear distance={4} duration={400} style={styles.titleBlock}>
        <Text variant="label" tone="dim" caps>
          The Witcher 3 Tavern Game
        </Text>
        <Text variant="hero" tone="accentBright" style={styles.title}>
          GWENT
        </Text>
      </Appear>

      <Appear delay={120} style={styles.menu}>
        <Button
          label="Hot-seat"
          onPress={go(() => beginSetup('hotseat'))}
          icon={<Icon name="sword" size={18} color={color.inkOnAccent} />}
        />
        <Button
          label="Versus AI"
          onPress={go(() => beginSetup('ai'))}
          icon={<Icon name="helm" size={18} color={color.inkOnAccent} />}
        />
        <Button
          label={`Deck Builder${deckCount > 0 ? ` · ${deckCount}` : ''}`}
          variant="ghost"
          onPress={go(openDecks)}
          icon={<Icon name="deck" size={18} color={color.accentBright} />}
        />
        {isOnlineConfigured ? (
          <Button
            label="Online"
            onPress={go(openOnline)}
            icon={<Icon name="globe" size={18} color={color.inkOnAccent} />}
          />
        ) : (
          <Button label="Online — add Supabase keys" disabled />
        )}
        <Button
          label="How to Play"
          variant="ghost"
          onPress={go(openGuide)}
          icon={<Icon name="star" size={18} color={color.accentBright} />}
        />
      </Appear>

      <Text variant="caption" tone="dim" style={styles.footer}>
        Fan-made, non-commercial.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  settingsButton: {
    position: 'absolute',
    top: space.md,
    right: space.lg,
    padding: space.sm,
  },
  titleBlock: {
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: space.xxl,
  },
  title: {
    fontSize: 56,
    letterSpacing: 8,
    marginVertical: space.xs,
  },
  menu: {
    gap: space.md,
    alignSelf: 'stretch',
  },
  footer: {
    position: 'absolute',
    bottom: space.xl,
    textAlign: 'center',
  },
});
