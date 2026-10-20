import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // Kept from the FluteApp days: changing it would make Android treat the
  // renamed app as a different one, and installs would lose their data.
  appId: 'app.flute.fingerings',
  appName: 'TimbreMap',
  webDir: 'dist',
  android: {
    // The app is a dark-UI reference tool; a light WebView flash on launch is
    // jarring next to it.
    backgroundColor: '#191A19',
  },
}

export default config
