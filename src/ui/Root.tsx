/**
 * Screen router (store-driven; no navigation library needed for four screens).
 * Priority: home → result → privacy gate → mulligan → battle.
 */

import React from 'react';
import { Platform, SafeAreaView, StatusBar as RNStatusBar, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { palette } from './theme';
import { useAppStore } from './store';
import { DeckBuilderScreen } from './screens/DeckBuilderScreen';
import { GameScreen } from './screens/GameScreen';
import { GameSetupScreen } from './screens/GameSetupScreen';
import { HomeScreen } from './screens/HomeScreen';
import { MulliganScreen } from './screens/MulliganScreen';
import { OnlineScreen } from './screens/OnlineScreen';
import { PrivacyScreen } from './screens/PrivacyScreen';
import { ResultScreen } from './screens/ResultScreen';

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
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.bg,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
});
