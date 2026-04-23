/**
 * vite.config.ts
 * Build and development server configuration for AuraFlow.
 *
 * Responsibilities:
 *  - Configuring vite-plugin-pwa to auto-generate the Service Worker
 *    via Workbox, replacing the hand-written service-worker.js
 *  - Setting up path aliases so src/ modules import cleanly
 *  - Splitting vendor chunks to improve caching across deploys
 *  - Configuring the dev server for local HTTPS (required by getUserMedia
 *    on some browsers when not on localhost)
 *
 * Why vite-plugin-pwa instead of a hand-written SW?
 *  Workbox handles cache versioning, stale-while-revalidate strategies,
 *  and precache manifest generation automatically. A hand-written SW
 *  must be updated manually on every build — a common source of bugs
 *  where stale assets are served after a deploy.
 */

import { defineConfig }  from 'vite';
import { VitePWA }       from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import { resolve }       from 'node:path';

// ─── Path helpers ─────────────────────────────────────────────────────────────

const root = fileURLToPath(new URL('.', import.meta.url));
const src  = resolve(root, 'src');

// ─── Config ───────────────────────────────────────────────────────────────────

export default defineConfig({

  // ── Path aliases ────────────────────────────────────────────────────────────
  // Allows imports like `import { clamp } from '@/utils/math'`
  // instead of fragile relative paths like `../../utils/math`.
  // Must be kept in sync with the `paths` entry in tsconfig.json.
  resolve: {
    alias: {
      '@': src,
    },
  },

  // ── Dev server ──────────────────────────────────────────────────────────────
  server: {
    port: 5173,

    /**
     * getUserMedia requires a secure context (HTTPS or localhost).
     * On localhost the browser grants camera access over plain HTTP,
     * so HTTPS is only needed when testing on a device via LAN IP.
     * Set VITE_HTTPS=true in .env.local to enable the built-in
     * Vite HTTPS dev server for LAN testing.
     */
    https: process.env.VITE_HTTPS === 'true' ? {} : undefined,

    /**
     * Expose the dev server on the local network (0.0.0.0) so the app
     * can be tested on a phone without a separate deployment step.
     * Access via https://<your-lan-ip>:5173 when VITE_HTTPS is enabled.
     */
    host: true,
  },

  // ── Build ───────────────────────────────────────────────────────────────────
  build: {
    /**
     * Target modern browsers that support the Web Audio API,
     * MediaPipe WASM, and ES2020 features used throughout the codebase.
     */
    target: 'es2020',

    /**
     * Emit source maps in production so errors reported from the field
     * can be traced back to the original TypeScript source.
     * Set to false if bundle size is a concern.
     */
    sourcemap: true,

    rollupOptions: {
      output: {
        /**
         * Split vendor dependencies into a separate chunk so that
         * a change in application code does not bust the MediaPipe
         * cache entry (which is large and changes infrequently).
         *
         * Chunk strategy:
         *  - mediapipe : @mediapipe/* packages (WASM + JS, ~2 MB total)
         *  - vendor    : all other node_modules
         *  - app       : src/ application code (smallest, changes most often)
         */
        manualChunks(id: string) {
          if (id.includes('@mediapipe')) return 'mediapipe';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },

  // ── PWA / Service Worker ────────────────────────────────────────────────────
  plugins: [
    VitePWA({
      /**
       * autoUpdate: the Service Worker updates itself in the background
       * whenever a new build is deployed. The user gets fresh assets on
       * the next page load without any manual intervention or prompts.
       */
      registerType: 'autoUpdate',

      /**
       * Do not inject a <link rel="manifest"> — the manifest is already
       * present in index.html and served from public/manifest.json by Vite.
       * Setting this to false prevents a duplicate or overwritten manifest.
       */
      manifest: false,

      /**
       * injectRegister: 'auto' — vite-plugin-pwa injects the SW registration
       * script into the built index.html automatically.
       * main.ts also registers the SW manually for finer control
       * (production-only, deferred to load event), so this is set to null
       * to avoid double registration.
       */
      injectRegister: null,

      workbox: {
        /**
         * Precache all built assets so the app works fully offline.
         * MP3 files are included so ambient samples play without a network.
         */
        globPatterns: ['**/*.{js,css,html,png,svg,mp3,woff2}'],

        /**
         * MediaPipe CDN assets (WASM, model files) are not bundled — they
         * are fetched at runtime from cdn.jsdelivr.net. Cache them with a
         * stale-while-revalidate strategy so they load instantly on repeat
         * visits while silently updating in the background.
         */
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@mediapipe\//,
            handler:    'StaleWhileRevalidate',
            options: {
              cacheName:   'mediapipe-cdn',
              expiration: {
                /**
                 * Keep at most 30 entries (one per model file variant)
                 * and expire them after 30 days to avoid stale WASM builds.
                 */
                maxEntries:       30,
                maxAgeSeconds:    30 * 24 * 60 * 60,
              },
            },
          },
        ],

        /**
         * Suppress the "navigationFallback" warning — AuraFlow is a
         * single-page app with no server-side routing, so all navigation
         * should fall back to index.html.
         */
        navigateFallback: 'index.html',

        /**
         * Exclude the ?debug route from the navigate fallback so that
         * opening /?debug=true always fetches a fresh shell rather than
         * serving a potentially cached version that might be stale.
         */
        navigateFallbackDenylist: [/\?debug/],
      },

      /**
       * devOptions: enable the Service Worker in the Vite dev server so
       * PWA behaviour (offline, install prompt) can be tested locally
       * without a production build.
       * Disabled by default to avoid confusing cache behaviour during
       * normal development — enable manually when testing SW specifics.
       */
      devOptions: {
        enabled: false,
        type:    'module',
      },
    }),
  ],
});