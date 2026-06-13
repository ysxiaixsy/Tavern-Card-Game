import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Root } from './src/ui/Root';

export default function App(): React.JSX.Element {
  // GestureHandlerRootView must wrap the whole tree for drag gestures;
  // SafeAreaProvider feeds real device insets to Root (status bar + nav bar).
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Root />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
