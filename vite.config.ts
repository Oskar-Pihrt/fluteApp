import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        // The ear trainer's piano samples (~1 MB) are precached so it works offline.
        // The note detector's network (~0.3 MB) too, so detection works offline.
        globPatterns: ['**/*.{js,css,html,svg,png,m4a,woff2,woff}', 'omr/detector.{json,bin}'],
        // Instrument data is not: a player downloads only the instruments they
        // chose, and each is cached on first fetch instead. The app keeps that
        // cache in step with their choice — src/platform/instrumentCache.ts.
        globIgnores: ['**/instrument-*.js'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/instrument-[^/]+\.js$/,
            handler: 'CacheFirst',
            options: { cacheName: 'timbremap-instruments' },
          },
        ],
      },
      manifest: {
        name: 'TimbreMap — fingerings for wind instruments',
        short_name: 'TimbreMap',
        description:
          'Fingering lookup, note library, sheet music and ear training for wind instrument players.',
        theme_color: '#191A19',
        background_color: '#191A19',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Padded so Android's adaptive-icon crop doesn't clip the flute.
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // One recognisable chunk per instrument data module, so the service
        // worker can leave them out of the precache (see `globIgnores`).
        chunkFileNames: (chunk) => {
          const module = /\/src\/instruments\/(\w+)\/data\.ts$/.exec(chunk.facadeModuleId ?? '')?.[1]
          return module ? `assets/instrument-${module}-[hash].js` : 'assets/[name]-[hash].js'
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // The OMR eval and training folders hold thousands of generated pages; the
  // dev server has no business watching them.
  server: { watch: { ignored: ['**/omr-eval/**', '**/omr-train/**'] } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
