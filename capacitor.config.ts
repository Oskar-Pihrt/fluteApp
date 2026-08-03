import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.flute.fingerings',
  appName: 'FluteApp',
  webDir: 'dist',
  android: {
    // The app is a dark-UI reference tool; a light WebView flash on launch is
    // jarring next to it.
    backgroundColor: '#0b1020',
  },
}

export default config
