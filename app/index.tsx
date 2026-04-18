import { StyleSheet, View, Platform, BackHandler } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRef, useState, useEffect } from 'react';

// Custom User Agents to bypass the Google "disallowed_useragent" WebView error
const CUSTOM_USER_AGENT = Platform.OS === 'android'
  ? 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36'
  : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';

export default function WebApp() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  // Hook into Android's native back gesture (which includes swiping from edges)
  useEffect(() => {
    if (Platform.OS === 'android') {
      const onAndroidBackPress = () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true; // strict override -> prevents exiting the app!
        }
        return false; // let the app close if we are at the very first page
      };
      
      BackHandler.addEventListener('hardwareBackPress', onAndroidBackPress);
      return () => {
        BackHandler.removeEventListener('hardwareBackPress', onAndroidBackPress);
      };
    }
  }, [canGoBack]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://bodookhrang.com' }}
        sharedCookiesEnabled={true}
        userAgent={CUSTOM_USER_AGENT}
        style={styles.webview}
        originWhitelist={['*']}
        
        // This single prop magically handles native left/right swiping for iOS devices
        allowsBackForwardNavigationGestures={true}
        
        // Update our state whenever the browser navigates to know if we CAN go back
        onNavigationStateChange={(navState) => {
          setCanGoBack(navState.canGoBack);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webview: {
    flex: 1,
  },
});
