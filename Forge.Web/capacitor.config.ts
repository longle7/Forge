import type { CapacitorConfig } from '@capacitor/cli'

// The iPhone app: this web app in a native shell, built and uploaded by .github/workflows/testflight.yml (no Mac
// needed). appId is the App Store bundle ID and can't change after the first upload.
const config: CapacitorConfig = {
  appId: 'com.longledev.forge',
  appName: 'Forge',
  webDir: 'dist',
  backgroundColor: '#fff7f0', // the cream canvas, so launch and overscroll never flash white
}

export default config
