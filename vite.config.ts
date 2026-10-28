import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  root: 'src/client',
  resolve: {
    alias: {
      '@client': path.resolve(__dirname, 'src/client'),
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  },
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
});
