import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // Android identifies the app by this id: changing it later makes a new app
  // and installs lose their data.
  appId: 'app.snekapp',
  appName: 'snekapp',
  webDir: 'dist',
  android: {
    backgroundColor: '#06120d',
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'DARK', // dark UI, light status bar icons
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_snek',
      iconColor: '#5be37d',
    },
  },
}

export default config
