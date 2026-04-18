import { StyleSheet, View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Custom User Agents to bypass the Google "disallowed_useragent" WebView error
const CUSTOM_USER_AGENT = Platform.OS === 'android'
  ? 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36'
  : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';

export default function WebApp() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 
        Setting style to 'light' makes the status bar text/icons white. 
        Because the container is #000000, it creates a seamless dark mode look.
      */}
      <StatusBar style="light" backgroundColor="#000000" />
      
      <WebView
        source={{ uri: 'https://bodookhrang.com' }}
        sharedCookiesEnabled={true}
        userAgent={CUSTOM_USER_AGENT}
        style={styles.webview}
        // Allows for hardware acceleration and proper session management
        originWhitelist={['*']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // A pure black background to blend seamlessly with the website's dark mode
    backgroundColor: '#000000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
