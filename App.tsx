import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Root } from './src/ui/Root';

export default function App(): React.JSX.Element {
  // SafeAreaProvider feeds real device insets to Root (status bar + nav bar).
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}
