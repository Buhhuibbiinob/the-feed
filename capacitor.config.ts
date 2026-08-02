import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mythefeed.app',
  appName: 'Feedback',
  // This app relies on Next.js Server Actions, SSR, and middleware (Supabase
  // auth cookies) - none of which survive a static `next export` bundle. So
  // instead of shipping a local web build, the native WebView loads the
  // real production site directly. One codebase: every web deploy updates
  // the app instantly too, no App Store review needed for content changes.
  webDir: 'www',
  server: {
    url: 'https://mythefeed.com',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
