/**
 * Screen router (store-driven; no navigation library needed). Wraps content
 * in a safe-area view so the OS status bar (top) and navigation bar (bottom)
 * never cover the UI — the PASS button and other bottom controls sit above
 * the Android nav bar.
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { palette } from './theme';
import { useAppStore } from './store';
import { DeckBuilderScreen } from './screens/DeckBuilderScreen';
import { GameScreen } from './screens/GameScreen';
import { GameSetupScreen } from './screens/GameSetupScreen';
import { HomeScreen } from './screens/HomeScreen';
import { HowToPlayScreen } from './screens/HowToPlayScreen';
import { MulliganScreen } from './screens/MulliganScreen';
import { OnlineScreen } from './screens/OnlineScreen';
import { PrivacyScreen } from './screens/PrivacyScreen';
import { ResultScreen } from './screens/ResultScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StyleGalleryScreen } from './screens/StyleGalleryScreen';

export function Root(): React.JSX.Element {
  const screen = useAppStore((s) => s.screen);
  const session = useAppStore((s) => s.session);

  let content: React.JSX.Element;
  if (screen === 'decks') {
    content = <DeckBuilderScreen />;
  } else if (screen === 'setup') {
    content = <GameSetupScreen />;
  } else if (screen === 'online') {
    content = <OnlineScreen />;
  } else if (screen === 'settings') {
    content = <SettingsScreen />;
  } else if (screen === 'gallery') {
    content = <StyleGalleryScreen />;
  } else if (screen === 'guide') {
    content = <HowToPlayScreen />;
  } else if (screen === 'home' || session === null) {
    content = <HomeScreen />;
  } else if (session.state.phase === 'finished') {
    content = <ResultScreen />;
  } else if (session.handoffTo !== null) {
    content = <PrivacyScreen />;
  } else if (session.state.phase === 'mulligan') {
    content = <MulliganScreen />;
  } else {
    content = <GameScreen />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style="light" />
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.bg,
  },
});
