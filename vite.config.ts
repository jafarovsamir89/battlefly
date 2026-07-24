import { defineConfig } from 'vite';

export default defineConfig({
  clearScreen: false,
  server: {
    host: true,
  },
  build: {
    target: 'es2020',
  },
});
