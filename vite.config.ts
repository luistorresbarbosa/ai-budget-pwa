import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'AI Budget',
        short_name: 'AI Budget',
        description: 'Gestão inteligente de despesas pessoais com apoio AI.',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'https://cdn.jsdelivr.net/npm/lucide-static@0.360.0/icons/wallet.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'https://cdn.jsdelivr.net/npm/lucide-static@0.360.0/icons/piggy-bank.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 5173
  },
  preview: {
    port: 4173
  },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts'
  }
});
