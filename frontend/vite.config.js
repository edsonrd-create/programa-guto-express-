import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** API local (dev). Se usar outra porta: `VITE_PROXY_API=http://127.0.0.1:3220 npm run dev` */
const proxyTarget = (process.env.VITE_PROXY_API || 'http://127.0.0.1:3210').replace(/\/$/, '');

const proxyPaths = [
  '/auth',
  '/menu',
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

export default defineConfig({
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
});
