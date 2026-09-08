import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const resolvePath = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolvePath('./src'),
      '@assets': resolvePath('./src/assets'),
      '@components': resolvePath('./src/components'),
      '@context': resolvePath('./src/context'),
      '@hooks': resolvePath('./src/hooks'),
      '@lib': resolvePath('./src/lib'),
      '@pages': resolvePath('./src/pages'),
      '@routes': resolvePath('./src/routes'),
      '@services': resolvePath('./src/services'),
      '@styles': resolvePath('./src/styles'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Lets every module write `@use 'tokens' as tokens;` from any depth,
        // without alias resolution inside the Sass importer.
        loadPaths: [resolvePath('./src/styles')],
      },
    },
    modules: {
      // styles.tableWrapper instead of styles['table-wrapper']
      localsConvention: 'camelCaseOnly',
      // readable, debuggable class names in devtools
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
