import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const workspace = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  clearScreen: false,
  server: {
    host: '0.0.0.0',
  },
  resolve: {
    alias: {
      '@battlefly/shared-types': workspace('../../packages/shared-types/src/index.ts'),
      '@battlefly/game-rules': workspace('../../packages/game-rules/src/index.ts'),
      '@battlefly/networking': workspace('../../packages/networking/src/index.ts'),
      '@battlefly/input': workspace('../../packages/input/src/index.ts'),
      '@battlefly/ui-core': workspace('../../packages/ui-core/src/index.ts'),
      '@battlefly/simulation': workspace('../../packages/simulation/src/index.ts'),
    },
  },
  build: {
    target: 'es2022',
  },
});

