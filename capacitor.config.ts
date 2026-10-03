import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nalammesh.app',
  appName: 'NalamMesh',
  webDir: 'out',
  server: {
    // http://localhost, not https://localhost: the facility relay is plain HTTP on
    // the LAN, and an https page may not call it (mixed content). localhost is
    // still a secure context, so WebCrypto, the microphone and the service
    // worker work; cleartext is limited to the hosts in
    // android/app/src/main/res/xml/network_security_config.xml, generated per
    // build by scripts/android-network-config.mts.
    androidScheme: 'http'
  }
};

export default config;
