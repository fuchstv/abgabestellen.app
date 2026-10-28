import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@server': path.resolve(__dirname, 'src/server'),
      '@client': path.resolve(__dirname, 'src/client'),
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  }
});
