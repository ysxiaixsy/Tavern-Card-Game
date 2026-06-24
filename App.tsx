import React from 'react';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Root } from './src/ui/Root';

export default function App(): React.JSX.Element | null {
  // Load only the design-system weights we use (Cinzel display, Spectral body),
  // straight from assets/fonts so the bundle ships 4 files, not every weight.
  // The keys here ARE the fontFamily names referenced by the type tokens.
  const [fontsReady, fontError] = useFonts({
    Cinzel_400Regular: require('./assets/fonts/Cinzel_400Regular.ttf'),
    Cinzel_700Bold: require('./assets/fonts/Cinzel_700Bold.ttf'),
    Spectral_400Regular: require('./assets/fonts/Spectral_400Regular.ttf'),
    Spectral_500Medium: require('./assets/fonts/Spectral_500Medium.ttf'),
  });
  if (!fontsReady && !fontError) {
    return null; // native splash stays up briefly while fonts load
  }

  // SafeAreaProvider feeds real device insets to Root (status bar + nav bar).
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}
