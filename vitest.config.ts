import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  // Lets component tests import .vue files. Tests run in Node unless a file asks for a page
  // with a `// @vitest-environment happy-dom` comment.
  plugins: [vue()],
  test: {
    include: ['server/**/*.test.ts', 'shared/**/*.test.ts', 'client/src/**/*.test.ts'],
  },
});
