import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** API local (dev). Se usar outra porta: `VITE_PROXY_API=http://127.0.0.1:3220 npm run dev` */
const proxyTarget = (process.env.VITE_PROXY_API || 'http://127.0.0.1:3210').replace(/\/$/, '');

const proxyPaths = [
  '/auth',
  '/menu',
  '/settings',
  '/clients',
  '/drivers',
  '/orders',
  '/kds',
  '/dispatch',
  '/integrations',
  '/routing',
  '/ops',
  '/health',
  '/metrics',
  '/ai',
  '/ws',
];

/** Base relativa para `electron/main.cjs` carregar `dist/index.html` com `loadFile`. */
const electronBase = process.env.ELECTRON_BUILD === '1' ? './' : '/';

export default defineConfig({
  base: electronBase,
  plugins: [
    react({
      jsxRuntime: 'automatic',
      jsxImportSource: 'react',
    }),
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    proxy: Object.fromEntries(
      proxyPaths.map((p) => [
        p,
        { target: proxyTarget, changeOrigin: true, ...(p === '/ws' ? { ws: true } : {}) },
      ]),
    ),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('firebase')) return 'vendor-firebase';
          if (id.includes('@react-google-maps')) return 'vendor-maps';
          if (
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/react/')
          ) {
            return 'vendor-react';
          }
          return 'vendor';
        },
      },
    },
  },
});
