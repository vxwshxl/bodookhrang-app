import { StyleSheet, View, Platform, BackHandler } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRef, useCallback, useEffect, useState } from 'react';

// Custom User Agents to bypass the Google "disallowed_useragent" WebView error
const CUSTOM_USER_AGENT = Platform.OS === 'android'
  ? 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36'
  : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';

const HOME_DOMAIN = 'bodookhrang.com';

export default function WebApp() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  // Track whether we're currently on the home domain
  const isOnHomeDomain = useRef(true);
  // Track whether the WebView can go back
  const canGoBack = useRef(false);
  // iOS: controls swipe-back gesture reactively (needs state to trigger re-render)
  const [swipeBackEnabled, setSwipeBackEnabled] = useState(false);

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    canGoBack.current = navState.canGoBack;
    try {
      const url = new URL(navState.url);
      const onHome = url.hostname === HOME_DOMAIN || url.hostname.endsWith(`.${HOME_DOMAIN}`);
      isOnHomeDomain.current = onHome;
      // Enable swipe-back on iOS only when off the home domain and can actually go back
      if (Platform.OS === 'ios') {
        setSwipeBackEnabled(!onHome && navState.canGoBack);
      }
    } catch {
      isOnHomeDomain.current = true;
      if (Platform.OS === 'ios') setSwipeBackEnabled(false);
    }
  }, []);

  // Android hardware back button handler
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onBackPress = () => {
      // Only intercept if we're NOT on the home domain and the WebView can go back
      if (!isOnHomeDomain.current && canGoBack.current) {
        webViewRef.current?.goBack();
        return true; // Consumed — don't exit the app
      }
      return false; // Let the OS handle it (exit app) when on home domain
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 
        Setting style to 'light' makes the status bar text/icons white. 
        Because the container is #000000, it creates a seamless dark mode look.
      */}
      <StatusBar style="light" backgroundColor="#000000" />
      
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://bodookhrang.com' }}
        sharedCookiesEnabled={true}
        userAgent={CUSTOM_USER_AGENT}
        style={styles.webview}
        // Allows for hardware acceleration and proper session management
        originWhitelist={['*']}
        onNavigationStateChange={handleNavigationStateChange}
        // Swipe-back on iOS: enabled only when off bodookhrang.com
        allowsBackForwardNavigationGestures={swipeBackEnabled}
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
