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
      resize: 'body',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['alert', 'badge', 'sound'],
    },
  },
};

export default config;
