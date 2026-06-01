import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ginx.app',
  appName: 'Ginx',
  webDir: 'dist',
  ios: {
    // Prevent WKWebView from auto-zooming when inputs are focused
    contentInset: 'automatic',
    scrollEnabled: true,
  },
  plugins: {
    Keyboard: {
      // Keep the viewport stable when the keyboard appears — no zoom
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
