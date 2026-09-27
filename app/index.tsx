import { StyleSheet, View, Platform, BackHandler, Linking } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRef, useCallback, useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as SystemUI from 'expo-system-ui';
import { LinearGradient } from 'expo-linear-gradient';

WebBrowser.maybeCompleteAuthSession();


// ─── Constants ────────────────────────────────────────────────────────────────

const HOME_DOMAIN = 'okhrang.com';
// App scheme used as Supabase's final redirect — Supabase (not Google)
// performs this redirect, so Google's "no custom scheme" policy never applies.
const APP_AUTH_CALLBACK = 'bodookhrang://';
// Website page that exchanges the Supabase auth code for a session.
const WEB_AUTH_CALLBACK = `https://${HOME_DOMAIN}/auth/callback`;
// Status bar colors mirror okhrang.com (app/globals.css): the page is --ds-bg
// with the --ds-accent (#ffc700) glow behind the nav — warm white at the edges,
// gold in the middle. Dark values follow the site's .dark tokens.
const LIGHT_SHELL_COLOR = '#ffffff';
const LIGHT_STATUS_BAR_GRADIENT = ['#fff8e8', '#fae7bc', '#fff8e8'] as const;
const DARK_SHELL_COLOR = '#0a0a0a';
const DARK_STATUS_BAR_GRADIENT = ['#0a0a0a', '#241d06', '#0a0a0a'] as const;

// The site's theme switcher (next-themes) toggles `dark` on <html>; report it
// so the native status bar matches the page.
const THEME_BRIDGE_JS = `(function () {
  var root = document.documentElement;
  var last;
  function send() {
    var dark = root.classList.contains('dark');
    if (dark === last || !window.ReactNativeWebView) return;
    last = dark;
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'THEME', dark: dark }));
  }
  new MutationObserver(send).observe(root, { attributes: true, attributeFilter: ['class'] });
  send();
})(); true;`;

// Spoof a real mobile browser so Google doesn't reject sign-in with
// "disallowed_useragent" when the auth page briefly renders in WebView.
// The trailing "OkhrangApp" token lets the website detect the native app even
// when __BODO_APP__ misses the document (Android injects it on page start).
const CUSTOM_USER_AGENT = Platform.OS === 'android'
  ? 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 OkhrangApp'
  : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1 OkhrangApp';

// ─── Component ────────────────────────────────────────────────────────────────

export default function WebApp() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const isOnHomeDomain = useRef(true);
  const canGoBack = useRef(false);
  const [swipeBackEnabled, setSwipeBackEnabled] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  // ── Navigation state tracking ──────────────────────────────────────────────

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    canGoBack.current = navState.canGoBack;
    try {
      const url = new URL(navState.url);
      const onHome =
        url.hostname === HOME_DOMAIN || url.hostname.endsWith(`.${HOME_DOMAIN}`);
      isOnHomeDomain.current = onHome;
      if (Platform.OS === 'ios') {
        setSwipeBackEnabled(!onHome && navState.canGoBack);
      }
    } catch {
      isOnHomeDomain.current = true;
      if (Platform.OS === 'ios') setSwipeBackEnabled(false);
    }
  }, []);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(isDarkTheme ? DARK_SHELL_COLOR : LIGHT_SHELL_COLOR);
  }, [isDarkTheme]);

  // ── Android hardware back button ───────────────────────────────────────────

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onBackPress = () => {
      if (!isOnHomeDomain.current && canGoBack.current) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  // ── Native Deep Link listener (Crucial for Android) ────────────────────────
  //
  // On Android, Custom Tabs routing back to "bodookhrang://" often wakes up
  // the MainActivity directly via OS intents. This means openAuthSessionAsync's
  // Promise returns { type: 'dismiss' } empty-handed, and the URL is handed
  // directly to the app. We use React Native Linking to reliably catch it.
  
  useEffect(() => {
    const handleDeepLink = (url: string | null) => {
      if (!url) return;
      try {
        const urlObj = new URL(url);
        // If it's our deep link and has a PKCE auth code from Supabase
        if (urlObj.protocol === 'bodookhrang:' && urlObj.searchParams.has('code')) {
          const callbackUrl = `${WEB_AUTH_CALLBACK}${urlObj.search}`;
          // Wait briefly to ensure WebView is ready
          setTimeout(() => {
            webViewRef.current?.injectJavaScript(
              `window.location.href = ${JSON.stringify(callbackUrl)}; true;`
            );
          }, 300);
        }
      } catch {
        // Ignore parse errors
      }
    };

    // Listen for URLs while app is running
    const subscription = Linking.addEventListener('url', (event) => handleDeepLink(event.url));
    
    // Check if app was launched via URL
    Linking.getInitialURL().then(handleDeepLink);

    return () => subscription.remove();
  }, []);

  // ── Google Sign-In bridge ─────────────────────────────────────────────────
  //
  // HOW IT WORKS
  // ─────────────
  // The website detects window.ReactNativeWebView and, instead of doing a
  // full-page redirect, calls supabase.auth.signInWithOAuth({ skipBrowserRedirect: true })
  // which returns the auth URL without navigating. It then posts:
  //   { type: "SUPABASE_GOOGLE_AUTH", url: "https://supabase.okhrang.com/auth/v1/authorize?…" }
  //
  // We receive that URL here, then:
  //   1. Open it with openAuthSessionAsync — this uses ASWebAuthenticationSession
  //      (iOS) or Chrome Custom Tab (Android), both of which share the native
  //      browser's cookie store, so Google shows saved accounts ✅
  //   2. Supabase ultimately redirects to bodookhrang://auth-callback?code=…
  //      The custom scheme is watched by ASWebAuthenticationSession → browser
  //      auto-closes ✅
  //   3. We strip the app scheme and hand the code to the website's own
  //      /auth/callback page. The Supabase JS client there has the PKCE
  //      code_verifier in localStorage (stored before skipBrowserRedirect
  //      returned) and completes the code exchange → session established ✅
  //
  // PREREQUISITE
  // ─────────────
  // Add to your self-hosted Supabase environment (GoTrue service):
  //   GOTRUE_EXTRA_REDIRECT_URLS=bodookhrang://
  // Then restart the auth service. Without this, Supabase validates and rejects
  // bodookhrang:// as a redirect URL at the server level.

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === 'THEME') {
        setIsDarkTheme(msg.dark === true);
        return;
      }

      if (msg.type === 'SUPABASE_GOOGLE_AUTH' && msg.url) {
        WebBrowser.openAuthSessionAsync(msg.url, APP_AUTH_CALLBACK).then((result) => {
          // If iOS/Android successfully populated the url inside the promise, handle it here.
          // Note: On Android, this might just return { type: 'dismiss' } and the URL
          // will be caught by the Linking listener above instead.
          if (result.type === 'success' && result.url) {
            try {
              const parsedUrl = new URL(result.url);
              if (parsedUrl.searchParams.has('code')) {
                const callbackUrl = `${WEB_AUTH_CALLBACK}${parsedUrl.search}`;
                webViewRef.current?.injectJavaScript(
                  `window.location.href = ${JSON.stringify(callbackUrl)}; true;`
                );
              }
            } catch {
              // Ignore
            }
          }
        });
      }
    } catch {
      // Ignore non-JSON or unrelated messages
    }
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar style={isDarkTheme ? 'light' : 'dark'} />

      <View
        style={[
          styles.statusBarGlass,
          { height: insets.top, backgroundColor: isDarkTheme ? DARK_SHELL_COLOR : LIGHT_SHELL_COLOR },
        ]}
      >
        <LinearGradient
          colors={isDarkTheme ? DARK_STATUS_BAR_GRADIENT : LIGHT_STATUS_BAR_GRADIENT}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.statusBarGradient}
        />
      </View>

      <WebView
        ref={webViewRef}
        source={{ uri: 'https://okhrang.com' }}
        sharedCookiesEnabled={true}
        userAgent={CUSTOM_USER_AGENT}
        style={[styles.webview, { marginTop: insets.top }]}
        originWhitelist={['*']}
        onNavigationStateChange={handleNavigationStateChange}
        allowsBackForwardNavigationGestures={swipeBackEnabled}
        onMessage={handleMessage}
        // Inject a reliable flag BEFORE page scripts run so the website
        // can detect it's inside the native app (UA is spoofed for Google sign-in).
        injectedJavaScriptBeforeContentLoaded={`window.__BODO_APP__ = true; true;`}
        injectedJavaScript={THEME_BRIDGE_JS}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LIGHT_SHELL_COLOR,
  },
  statusBarGlass: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    backgroundColor: LIGHT_SHELL_COLOR,
    zIndex: 2,
  },
  statusBarGradient: {
    ...StyleSheet.absoluteFill,
  },
  webview: {
    flex: 1,
    backgroundColor: LIGHT_SHELL_COLOR,
  },
});
