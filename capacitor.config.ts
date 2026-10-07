import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.quickchat.preview',
  appName: 'Quick Chat',
  webDir: 'dist/public',
  server: { androidScheme: 'https' },
};
export default config;
