import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  root: 'client',
  plugins: [vue()],
  server: {
    // Fail rather than quietly moving to another port if this one is taken.
    port: 5173,
    strictPort: true,
    // Forward API calls to the Hono server so the page, API and event stream share one origin.
    proxy: { '/v1': 'http://localhost:3000' },
  },
});
