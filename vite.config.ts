import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
// vitest's defineConfig is vite's, widened to accept the `test` block.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// The app is deployed to a project subpath on GitHub Pages, but runs from the
// root during local development. BASE_PATH lets CI override it.
const base = process.env.BASE_PATH ?? '/'

const { version } = createRequire(import.meta.url)('./package.json') as {
  version: string
}

export default defineConfig({
  base,
  // Keeps the version shown in Settings tied to package.json rather than a
  // second copy that quietly goes stale.
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // Everything the app needs is precached, so a cold start with no
        // network is identical to a warm one. This is the whole point.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Baby Tracker',
        short_name: 'Baby',
        description:
          'A private, offline-first baby tracker. Feeds, sleep and diapers in one tap.',
        theme_color: '#1b2a4a',
        background_color: '#1b2a4a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        categories: ['health', 'lifestyle', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
})
