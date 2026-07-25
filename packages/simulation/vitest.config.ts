import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

const workspace = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@battlefly/shared-types': workspace('../shared-types/src/index.ts'),
      '@battlefly/game-rules': workspace('../game-rules/src/index.ts'),
    },
  },
});

