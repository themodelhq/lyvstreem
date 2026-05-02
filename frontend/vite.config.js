import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Use our hand-crafted SW in public/sw.js
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      registerType: 'prompt',         // Show "update available" prompt, don't auto-update
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'offline.html',
        'icons/*.png',
        'icons/*.svg',
      ],
      manifest: {
        name: 'LyvStreem - Stream Your World',
        short_name: 'LyvStreem',
        description: 'Live streaming with gifts, PK battles, audio & video rooms',
        theme_color: '#d946ef',
        background_color: '#0a0a0f',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-72x72.png',   sizes: '72x72',   type: 'image/png' },
          { src: '/icons/icon-96x96.png',   sizes: '96x96',   type: 'image/png' },
          { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
          { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
          { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Go Live',        url: '/go-live',        icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }] },
          { name: 'Discover',       url: '/discover',       icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }] },
          { name: 'Host Dashboard', url: '/host-dashboard', icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }] },
          { name: 'Buy Coins',      url: '/coins',          icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }] },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:5000', ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          socket: ['socket.io-client'],
          icons: ['react-icons'],
        },
      },
    },
  },
});
