import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.nalammesh.app',
  appName: 'NalamMesh',
  webDir: 'out',
  backgroundColor: '#F7F9FB',
  ios: {
    // Web content draws edge-to-edge; safe areas are handled in CSS (--sat/--sab).
    contentInset: 'never',
    backgroundColor: '#F7F9FB',
  },
  android: {
    backgroundColor: '#F7F9FB',
    // The mesh server (server/mesh-server.ts) runs over plain HTTP on the LAN.
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      launchFadeOutDuration: 250,
      backgroundColor: '#055643',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: false,
      splashImmersive: false,
    },
    Keyboard: {
      // Resize the WebView so 100dvh layouts and the tab bar sit above the keyboard.
      resize: KeyboardResize.Native,
      resizeOnFullScreen: true,
    },
    SystemBars: {
      insetsHandling: 'css',
      style: 'LIGHT',
    },
  },
};

export default config;
